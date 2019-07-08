import React, { Component } from 'react';
import { Route, Switch } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import List from './pages/List';
import { Formik } from 'formik';
import ApiClient from './api_client';
import CSClient from './cs_client';
const apiClient = ApiClient();


window.apiClient = apiClient;


function StateUtils() {

  const DEF_STATE = {
    error: "",
    login: {},
    conversations: {},
    socket_events: [],
    http_responses: []
  }
  const concatInState = (state, prop, val) => {
    return {
      ...state,
      [prop]: state[prop].concat(val)
    };
  }

  const addConversationEvents = (conversation_id, events) => (state, props) => {
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [conversation_id]: {
          ...state.conversations[conversation_id],
          events
        }
      }
    }

  }

  const addConversations = (conversations = []) => (state, props) => {

    const oldConversations = { ...state.conversations }
    const newConversations = conversations.reduce((acc, cur) => {
      acc[cur.id] = {
        id: cur.id,
        ...acc[cur.id],
        info: cur

      };
      return acc;

    }, oldConversations)

    return {
      ...state,
      conversations: newConversations,
    }
  }

  const getConversations = (state) => {
    return Object.keys(state.conversations || {}).map((conv_id) => { return state.conversations[conv_id] })
  }

  const addSocketEvent = (event) => (state, props) => concatInState(state, "socket_events", event)

  const addHttpResponse = (httpResponse) => (state, props) => concatInState(state, "http_responses", httpResponse)

  const addLoginInfo = (login) => (state, props) => {
    return {
      ...state,
      login
    };
  }

  return {
    DEF_STATE,
    addConversations,
    getConversations,
    addConversationEvents,
    addSocketEvent,
    addHttpResponse,
    addLoginInfo,


  }

}

const stateUtils = StateUtils()


const MyInfo = ({ user_id, user_name, token }) => {
  return (
    <div>
      <h2>My Info</h2>
      <div><b>user_id:</b> {user_id}</div>
      <div><b>user_name:</b> {user_name} </div>
      <div><b>my token:</b> {token}</div>
    </div>
  )
}

const MyConversations = ({ conversations }) => {
  return (
    <div>
      <h2>My Conversation</h2>
      <div>
        {conversations.map(conv => {
          return (
            <div key={conv.id} > <DebugJson json={conv} /> </div>
          )
        })}
      </div>
    </div>
  )
}

const DebugForm = ({ fields, onSubmit, title }) => {
  const initialValues = fields.reduce((cum, { name, initialValue }) => ({ ...cum, [name]: initialValue }), {})
  return (
    <div>
      <h2>{title}</h2>
      <Formik
        initialValues={initialValues}
        onSubmit={onSubmit}

        render={props => {
          const { values, handleChange, handleSubmit } = props
          return (
            <div>
              <form onSubmit={handleSubmit}>
                {(fields.map((el => {
                  return <span key={el.name} >
                    <label  >{el.label || el.placeholder} </label>
                    <input
                      name={el.name}
                      placeholder={el.placeholder}
                      type="text"
                      value={values[el.name]}
                      onChange={handleChange}
                    />
                  </span>
                })))}
                <button type="submit" >
                  Submit
                </button>
              </form>
            </div>
          )
        }}
      />
    </div>
  )
}

const DebugJson = ({ json }) => {
  return <pre>{JSON.stringify(json, ' ', ' ')}</pre>
}


class App extends Component {
  state = stateUtils.DEF_STATE
  cs_user_client = null
  componentDidMount() {
    apiClient.login({
      "user_name": "test",
      "password": "pass"
    })
      .then(({ data }) => {
        this.setState(stateUtils.addLoginInfo(data))
        const csClient = CSClient({
          hooks: {
            onHttpResponse: ({ request, response, request_label, method_params }) => {
              const { data, status, headers } = response
              const reqRes = {
                request,
                response: {
                  data, status, headers
                },
                request_label
              }
              this.setState(stateUtils.addHttpResponse(reqRes))// this.reqRes

              if (request_label === 'user:conversations') {
                this.setState(stateUtils.addConversations(reqRes.response.data))// this.reqRes
              } else if (request_label === 'conversation:events') {
                this.setState(stateUtils.addConversationEvents(method_params.conversation_id, reqRes.response.data))

              }

            }
          }
        });
        csClient.login({ token: data.token })
          .then((cs_user_client) => {
            this.cs_user_client = cs_user_client;
            // const { httpClient } = cs_user_client;
            // httpClient.getConversations()
            //   .then((res) => {
            //     console.log(res)
            //   })
          })
      })
  }
  render() {
    const login = this.state.login;
    const conversations = stateUtils.getConversations(this.state);
    return (
      <div>
        {(login && login.user) && <MyInfo user_id={login.user.id} user_name={login.user.name} token={login.token} />}
        {conversations && <MyConversations conversations={conversations} />}
        <div style={{ marginTop: "5px", borderTop: "2px solid black", padding: "0px 10px 10px 10px" }} >
          <h2 div style={{ border: " solid black", borderWidth: "0px 1px 1px 1px", padding: "10px", marginTop: "0px", display: "inline-block" }}  >Http Actions:</h2>
          <DebugForm
            title="Create Conversation"
            onSubmit={(values, { setSubmitting }) => {
              this.cs_user_client.httpClient.createConversation(values)
            }}

            fields={[
              {
                name: "name",
                placeholder: "Conversation Name",
                initialValue: '',
              },
              {
                name: "display_name",
                placeholder: "Display Name",
                initialValue: '',
              }
            ]}
          />
          <DebugForm
            title="Join Conversation"
            onSubmit={(values, { setSubmitting }) => {
              this.cs_user_client.httpClient.createConversationMember(values)
            }}

            fields={[
              {
                name: "conversation_id",
                placeholder: "Conversation Id (CON-...)",
                initialValue: '',
              },
              {
                name: "action",
                placeholder: "join or invite",
                initialValue: 'join',
              },
              {
                name: "user_id",
                placeholder: "user id",
                initialValue: '',
              }

            ]}
          />

          <DebugForm
            title="Get My Conversations"
            onSubmit={(values, { setSubmitting }) => {
              this.cs_user_client.httpClient.getConversations()
            }}

            fields={[
            ]}
          />

          <DebugForm
            title="Get Conversations Details"
            onSubmit={(values, { setSubmitting }) => {
              this.cs_user_client.httpClient.getConversation(values)
            }}

            fields={[
              {
                name: "conversation_id",
                placeholder: "Conversation id",
                initialValue: '',
              }
            ]}
          />

          <DebugForm
            title="Get Conversations Events"
            onSubmit={(values, { setSubmitting }) => {
              this.cs_user_client.httpClient.getConversationEvents(values)
            }}

            fields={[
              {
                name: "conversation_id",
                placeholder: "Conversation id",
                initialValue: '',
              }
            ]}
          />
        </div>
        {/* <Switch>
          <Route exact path='/' component={Home} />
          <Route path='/list' component={List} />
        </Switch> */}
        <h2 style={{ borderTop: "2px solid black" }} >Debug state:</h2>
        <DebugJson json={this.state} />
      </div>
    )
  }
}

export default App;
