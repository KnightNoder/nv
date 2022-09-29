var jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  try {
    if (req.headers.token) {
      jwt.verify(req.headers.token, process.env.secret, function (err, decoded) {
        if (err) {
          throw "Token expired"
        }
        return req;
      })
    }
    else
      throw "Missing token"
  } catch (error) {
    throw error
    next(error)
  }
}