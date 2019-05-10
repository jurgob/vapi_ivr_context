module.exports = function(){
  const STATE = {
    users: null
  }

  function hasUsers(){
    return (STATE.users !== null)
  }

  function setUsers(users){
    STATE.users = users
  }

  function getUser({name}){
    const user = STATE.users.find(usr => usr.name === name)
    return user ? Promise.resolve(user) : Promise.reject({msg:"user not found"})
  }

  return {
    setUsers,
    getUser,
    hasUsers
  }

}