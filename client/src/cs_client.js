import io from 'socket.io-client';
const axios = require('axios');

// function socket_client = function(socket_io){
//   socket_io
//
//
// }



export default function (extConfig) {
  const defConfig = {
    socket_url: "http://ws.nexmo.com",
    cs_url: "/cs",
    hooks: {
      onHttpResponse: () => { }
    }
  }
  const config = {
    ...defConfig,
    ...extConfig
  }

  let STATE = {};

  const initSocket = () => {
    const socket = io.connect(config.socket_url, {
      path: "/rtc",
      forceNew: false,
      reconnection: false,
      autoConnect: true,
    });
    require('socketio-wildcard')(io.Manager)(socket)

    const onEvent = (callback) => {
      socket.on('*', (packet) => {
        callback(packet.data)
      })
    }


    const sendEvent = (event) => {
      const { type, data } = event
      socket.emit(type, data)
    }

    return { onEvent, sendEvent };
  }

  const csRequest = ({ method, url, data, headers, request_label, method_params }) => {
    const request = {
      method, url, data,
      headers: {
        ...headers
      }
    }

    return axios(request)
      .then((response) => {
        // const {data,status} = response
        config.hooks.onHttpResponse({ request, response, request_label, method_params })
        return response.data;
      })
      .catch(err => {
        return Promise.reject(err)
      })
  }


  const initHttpClient = ({ token, session }) => {
    const { id, user_id } = session;
    const headers = {
      "Authorization": `Bearer ${token}`,
      "X-Nexmo-SessionId": id
    }

    const getConversations = () => csRequest({
      "request_label": "user:conversations",
      "method": "GET",
      "url": `${config.cs_url}/beta/users/${user_id}/conversations`,
      headers
    })

    const createConversation = ({ name, display_name }) => csRequest({
      "request_label": "new:conversation",
      "method": "POST",
      "url": `${config.cs_url}/beta/conversations`,
      data: { name, display_name },
      headers
    })

    const createConversationMember = ({ conversation_id, action, user_id, member_id, channel = { type: "app" } }) => csRequest({
      "request_label": `${action === "join" ? "conversation:join" : "conversation:invite"}`,
      "method": "POST",
      "url": `${config.cs_url}/beta/conversations/${conversation_id}/members`,
      data: { action, user_id, member_id, channel },
      headers
    })
    const getConversation = (method_params) => {
      const { conversation_id } = method_params;
      return csRequest({
        method_params,
        "request_label": `conversation:get`,
        "method": "GET",
        "url": `${config.cs_url}/beta/conversations/${conversation_id}`,
        headers
      })
    }

    const getConversationEvents = (method_params) => {
      const { conversation_id } = method_params;
      return csRequest({
        method_params,
        "request_label": `conversation:events`,
        "method": "GET",
        "url": `${config.cs_url}/beta/conversations/${conversation_id}/events`,
        headers
      })
    }

    return {
      getConversations,
      createConversation,
      createConversationMember,
      getConversation,
      getConversationEvents
    }

  }


  const login = ({ token }) => {
    return new Promise((resolve) => {
      const socket_client = initSocket()
      socket_client.sendEvent({
        "type": "session:login",
        "data": {
          "body": {
            "device_id": "666",
            "device_type": "js",
            "token": token
          }
        }
      })
      socket_client.onEvent((event) => {
        if (event[0] === "session:success") {
          const session = event[1].body
          const httpClient = initHttpClient({ token, session })
          resolve({
            httpClient,
            session,
            onEvent: socket_client.onEvent
          })
        }
      })
    })
  }

  return {
    login
  }

}