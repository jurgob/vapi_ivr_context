const axios = require('axios');
// function axios(){
//   return Promise.resolve();
// }

const ApiClient = function(){

  const csRequest = ({method, url, data, headers, token }) => {
    const request = {
      method, url, data,
      headers:{
        ...headers,
        "Authorization": `Bearer ${token}`
      }
    }

    return axios(request)
      .then((response) => {
        // const {data,status} = response
        return response
      })
      .catch(err => {
        return Promise.reject(err)
      })
  }


  const login = ({user_name, password}) => csRequest({
    method:"POST",
    url: `/login`,
    data:{user_name, password},
  });

  return {
    login,
  }

}

export default ApiClient;