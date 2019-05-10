const axios = require('axios');

module.exports = function({logger}){

  const csRequest = ({method, url, data, headers, token }) => {
    const request = {
      method, url, data,
      headers:{
        ...headers,
        "Authorization": `Bearer ${token}`
      }
    }

    logger.info({request}, "csRequest() start")
    return axios(request)
      .then((response) => {
        const {data,status} = response
        logger.info({request, data,status}, "csRequest() success")
        return response
      })
      .catch(err => {
        logger.warn({request, err}, "csRequest() fail")
        return Promise.reject(err)
      })
  }

  const createUser = ({data, token}) => csRequest({
    method:"POST",
    url: `https://api.nexmo.com/beta/users`,
    data,
    token
  })

  const getUsers = ({token}) => csRequest({
    method:"GET",
    url: `https://api.nexmo.com/beta/users`,
    token
  })

  return {
    createUser,
    getUsers
  }

}