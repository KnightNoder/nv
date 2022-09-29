var jwt = require('jsonwebtoken');
require('dotenv').config();
const { verifyUserQuery } = require('./../db/Query/auth/query');

var checkUserExist = async function (req, res, next) {
  try {
    let userExist = await verifyUserQuery(req, res, next)
    if (userExist) {
      let token = jwt.sign({
        id: userExist[0].userId, profile: userExist[0].profile,
        branchId: userExist[0].branchId, restaurantId: userExist[0].restaurantId,
        username: userExist[0].username
      }, process.env.secret, {
        expiresIn: 864000// expires in 24 hours
      });
      userExist[0].token = token;
      return userExist;
    }
    else
      return false;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkUserExist: checkUserExist,
}
