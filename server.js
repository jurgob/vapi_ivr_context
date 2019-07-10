const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const bunyan = require('bunyan');
const jwt = require('jsonwebtoken');
const {scenarios,generateNccoMap} = require('./test_ncco_build');
const logger = bunyan.createLogger({name: 'myapp'});
const dataService = require('./data_service')();
const csClient = require('./cs_client')({logger})




var bodyParser = require('body-parser');


const forwardNexmoReq = res => promise => {

  return promise
    .then(({data,statusCode, headers}) => {
      return res.json({data,statusCode, headers})
    })
    .catch((error) => {
      logger.warn(error)
      const {response} = error
      const {data,status} = response
      res.statusCode = status;
      return res.json(data)
    })
}






function createApp(config){

  const app = express()

  app.use(bodyParser.json())

  app.use((req, res, next) => {
    const {query,baseUrl,originalUrl, url, method, statusCode, body} = req
    logger.info( {query,baseUrl,originalUrl, url, method, statusCode, body} , "Request Logger:")
    next()
  })

  app.get('/', (req, res) => res.json({msg: 'Hello World!'}))

  app.get('/conversations', (req, res) => {
    const TOKEN_BE = generateBEToken({config})
    return forwardNexmoReq(res)(axios({
      method:"GET",
      url:"https://api.nexmo.com/beta/conversations",
      headers:{
        "Authorization": `Bearer ${TOKEN_BE}`
      }
    }))

  })

    app.get('/conversations/:conv_id', (req, res) => {
      const {conv_id} = req.params;
      const TOKEN_BE = generateBEToken({config})
      return forwardNexmoReq(res)(axios({
        method:"GET",
        url: `https://api.nexmo.com/beta/conversations/${conv_id}`,
        headers:{
          "Authorization": `Bearer ${TOKEN_BE}`
        }
      }))
    })

      app.get('/conversations/:conv_id/events', (req, res) => {
        const {conv_id} = req.params;
        const TOKEN_BE = generateBEToken({config})
        return forwardNexmoReq(res)(axios({
          method:"GET",
          url: `https://api.nexmo.com/beta/conversations/${conv_id}/events`,
          headers:{
            "Authorization": `Bearer ${TOKEN_BE}`
          }
        }))
      })

  app.delete('/conversations/:conv_id', (req, res) => {
    const {conv_id} = req.params;
    const TOKEN_BE = generateBEToken({config})
    return forwardNexmoReq(res)(axios({
      method:"DELETE",
      url: `https://api.nexmo.com/beta/conversations/${conv_id}`,
      headers:{
        "Authorization": `Bearer ${TOKEN_BE}`
      }
    }))
  })

  app.get('/conversations/:conv_id/events', (req, res) => {
    const {conv_id} = req.params;
    const TOKEN_BE = generateBEToken({config})
    return forwardNexmoReq(res)(axios({
      method:"GET",
      url: `https://api.nexmo.com/beta/conversations/${conv_id}/events`,
      headers:{
        "Authorization": `Bearer ${TOKEN_BE}`
      }
    }))
  })



  app.post('/login', (req, res) => {
    const {user_name, password} = req.body;
    if(!user_name || !password){
      res.status(404)
      return res.json({"msg": "missing user_name or password"});
    }

    const TOKEN_BE = generateBEToken({config})

    const loginProcess = () => Promise.resolve()
      .then(() => {
        if (!dataService.hasUsers() ) {
          return csClient.getUsers({
            token: TOKEN_BE
          })
          .then(({data}) => {
            dataService.setUsers(data)
            return undefined;
          })
        }
        return undefined;

      })
      .then(() => {
        return dataService.getUser({name: user_name})
      })
      .catch(() => {
        return csClient.createUser({
          data:{
            name: user_name
          },
          token: TOKEN_BE
        })
        .then(() => {
          return dataService.getUser({name: user_name})
        })
      })
      .then((user) => {
        res.json({
          user
        })
      })
      .catch((error) => {
        const {response} = error
        if(response){
          const {data,status} = response
          res.status(status)
          res.json(data)
        }
        res.status(500)
        res.json({error})
      })



    return loginProcess()
  })


  app.post('/voiceEvent', (req, res) => {
      console.log(`req.body`, req.body)
      if(req.body.type === 'transfer') {
        const {server_url} = config;
        const conversation_name = req.body.conversation_uuid_to;
        const nccoMap = generateNccoMap(conversation_name, scenarios, {server_url})
        const currentNcco = nccoMap.child.ncco
        const TOKEN_BE = generateBEToken({config})
        const request = {
          method: "PUT",
          url: `http://vapp1.wdc4.internal:5210/v1/conversations/${conversation_name}/ncco`,
          data: currentNcco,
          headers: {'Authorization': `bearer ${TOKEN_BE}`}
        }
        logger.info({request}, `NCCO UPDATE START!`)
        axios(request)
        .then(({data,status}) => {
          logger.info({data, status}, `NCCO UPDATE SUCCESS!`)
        })
        .catch((err) => {
          const toLog = err.statusCode ? {statusCode: err.statusCode, message: err.message} : {err}
          logger.error(toLog, `NCCO UPDATE FAILED!`)
        })

      }
    res.json({body: req.body})
  })

  app.post('/calls', (req, res) => {
    const TOKEN_BE = generateBEToken({config})
    return axios({
      method:"POST",
      url:"https://api.nexmo.com/v1/calls",
      data:req.body,
      headers:{
        "Authorization": `Bearer ${TOKEN_BE}`
      }
    })
    .then(({data,statusCode}) => {
      return res.json({data,statusCode})
    })
    .catch(({response}) => {

      const {data,status} = response
      res.statusCode = status;
      return res.json(data)
    })
    //
  })

  const nccoHandler = (req, res) => {
    const {server_url} = config;
    let {originalUrl, params, query} = req;
    let {step_1} = params;
    const {to='unknown', from='unknown', dtmf = -1 } = query;

    if(step_1 === null || step_1 === undefined || step_1 === "" ){
      step_1 = -1
    } if (step_1 === "redirect"){
      step_1 = "redirect";
    } else {
      step_1 = parseInt(step_1)
    }

    logger.info({dtmf: dtmf, step_1: step_1}, "ncco handler: ")

    const conversation_name = `nexmo_conversation__${to}___${from}`

    const nccoMap = generateNccoMap(conversation_name, scenarios, {server_url})

    let currentNcco = null
    if(step_1 === "redirect"){
      currentNcco = [
        {
          "action": "talk",
          "text": "we are transfering you in a better place"
        },
        {
          "action": "conversation",
          "name": `${conversation_name}`
        },
      ]
    } else if(step_1 === -1 && dtmf === -1) {
        currentNcco = nccoMap.child.ncco;
    } else if(step_1 === -1 && dtmf !== -1){
      currentNcco = nccoMap.child.children[dtmf - 1].ncco;
    } else if(step_1 !== -1 && dtmf !== -1) {
      currentNcco = nccoMap.child.children[step_1] && nccoMap.child.children[step_1].children[dtmf -1 ];
    }

  if(currentNcco !== null){
      logger.info({ncco: currentNcco, originalUrl}, 'NCCO')
      return res.json(currentNcco);
    } else {
      res.status(400)
      return res.json({msg:"wrong ncco request"})

    }

  }

  app.get('/ncco', nccoHandler)
  app.get('/ncco/:step_1', nccoHandler)

  return app;
}




function localDevSetup({config}){

  const ngrok = require('ngrok');

  dotenv.config();

  const {port, application_id} = config;
  const {MY_NEXMO_APP_API_KEY,MY_NEXMO_APP_API_SECRET} = process.env
  const dev_api_token = new Buffer(`${MY_NEXMO_APP_API_KEY}:${MY_NEXMO_APP_API_SECRET}`).toString('base64')

  let NGROK_URL;
  return ngrok.connect(port)
    .then((ngrok_url ) => {
    NGROK_URL = ngrok_url;
    return axios({
      method: "PUT",
      url: `https://api.nexmo.com/v2/applications/0443e6fd-f839-4377-999f-07fa193280cf`,
      data:{
      	"name":"ivr-state-test",
      	"capabilities": {
              "voice": {
                  "webhooks": {
                      "answer_url": {
                          "address":`${ngrok_url}/ncco/redirect`,
                          "http_method":"GET"
                      },
                      "event_url": {
                          "address":`${ngrok_url}/voiceEvent`,
                          "http_method":"POST"
                      }
                  }
              }
      	}
      },
      headers: {'Authorization': `basic ${dev_api_token}`}
    })
    .then(({data,status}) => {
      logger.info({data, status})
    })
      // return {
      //   config: {
      //     ...config,
      //     ngrok_url,
      //     dev_api_token
      //   }
      // }
    })
    .then(() => ({
        config: {
          ...config,
          server_url: NGROK_URL
        }
    }))
}

function generateToken({private_key, application_id, acl, sub}){
  if(!acl) {
    acl = {
      "paths": {
        "/**": {}
      }
    }
  }
  const offset = 100000000
  const props = {
    "iss": application_id,
    "iat": Math.floor(Date.now() / 1000) - 30,
    "nbf": Math.floor(Date.now() / 1000) - 30,
    "exp": Math.floor(Date.now() / 1000) + 30000,
    "jti": Date.now(),
    application_id,
    acl,
    sub
  }

  return jwt.sign(
    props,
    {
      key: private_key,
    },
    {
      algorithm: 'RS256',
    }
  )
}

function generateUserToken({config, user_name}){
  const {private_key, application_id} = config;
  return generateToken({
    	private_key,
      application_id,
      sub: user_name
    })
}

function generateBEToken({config}){
  const {private_key, application_id} = config;
  return generateToken({
    	private_key,
      application_id
    })
}

function getStaticConfig(env){
  const {MY_NEXMO_APP_PRIVATE_KEY, MY_NEXMO_APP_APPLICATION_ID,MY_NEXMO_APP_PHONE_NUMBER} = env
  const port  = 3000
  return {
    port,
    phone_number: MY_NEXMO_APP_PHONE_NUMBER,
    server_url_internal: `http://localhost:${port}`,
    server_url: `http://localhost:${port}`,
    private_key:MY_NEXMO_APP_PRIVATE_KEY,
    application_id: MY_NEXMO_APP_APPLICATION_ID
  }
}

function listenServer({app, config}){
  const {port} = config;
  return new Promise((resolve) => {
    return app.listen(port, () => resolve({config}))
  })
}


function startServer(){
  dotenv.config();
  const staticConfig = getStaticConfig(process.env)
  return Promise.resolve()
    .then(() => localDevSetup({config: staticConfig}))
    .then(({config}) =>{
        const app = createApp(config)
        return {config, app}
    })
    .then(({app, config}) => listenServer({app, config}) )
    .then(({config}) => {
      const {port} = config;
      logger.info(`config`, config)
      logger.info(`Example app listening on port ${port}!`)
    })
}

startServer()
  .catch(err => console.error(err))
