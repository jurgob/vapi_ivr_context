const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const bunyan = require('bunyan');
const jwt = require('jsonwebtoken');
const {scenarios,generateNccoMap} = require('./test_ncco_build');

const logger = bunyan.createLogger({name: 'myapp'});



var bodyParser = require('body-parser');


const forwardNexmoReq = res => promise => {

  return promise
    .then(({data,statusCode}) => {
      return res.json({data,statusCode})
    })
    .catch(({response}) => {

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
    logger.info( {query,baseUrl,originalUrl, url, method, statusCode, body} , "Request Logger:: ")
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


  app.post('/voiceEvent', (req, res) => res.json({body: req.body}))

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
    let {step_1} = req.params;
    const {to='unknown', from='unknown', dtmf = -1 } = req.query;

    logger.info({dtmf: dtmf})

    logger.info({step_1_pre: step_1})
    if(step_1 === null || step_1 === undefined || step_1 === "" ){
      step_1 = -1
    } else {
      step_1 = parseInt(step_1)
    }

    logger.info({step_1: step_1})

    const nccoMap = generateNccoMap(scenarios, {server_url})

    let currentNcco=null
    if(step_1 === -1 && dtmf === -1)
      currentNcco = nccoMap.child.ncco;
    if(step_1 === -1 && dtmf !== -1)
      currentNcco = nccoMap.child.children[dtmf - 1].ncco;
    if(step_1 !== -1 && dtmf !== -1)
      currentNcco = nccoMap.child.children[step_1].children[dtmf -1 ];

    if(currentNcco !== null)
      return res.json(currentNcco);
    else {
      res.status = 400
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
                          "address":`${ngrok_url}/ncco`,
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

function generateBEToken({config}){
  return jwt.sign(
    {
      "iat": 1556839380,
    	"nbf": 1556839380,
    	"exp": 1559839410,
    	"jti": 1556839410008,
    	"application_id": config.application_id,
    	"acl": {
    		"paths": {
    			"/**": {}
    		}
    	}
    },
    {
      key: config.private_key,
    },
    {
      algorithm: 'RS256',
    }
  )
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
