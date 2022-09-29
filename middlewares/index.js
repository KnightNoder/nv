var middlewareConfig = require('../config/middlewares');
var verifyToken = require('./verifyToken');
var middlewares = {verifyToken};
module.exports = async function (req, res, next) {
    try{
        let middlwareConfigString = req.path.substr(1).replace(/[0-9]{1,100}/g, "*");
        let path = middlewareConfig.hasOwnProperty(middlwareConfigString) ? middlewareConfig[middlwareConfigString] : middlewareConfig['*'];
        let runtimeMiddlewares = path.length ? path.split(',')  : [];
        for(let middleware of runtimeMiddlewares) {
            req = middlewares[middleware](req, res, next);
        }
        next();
    } catch(e) {
        return res.status(500).send(e);
    }
}