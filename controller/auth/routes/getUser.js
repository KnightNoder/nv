var { checkUserExist } = require('../../../services/signIn');

route = {
    getUser: async function (req, res, next) {
        try {
            let userExist = await checkUserExist(req);
            if (!userExist)
                return res.status(404).send('User do not Exist');
            else
                return res.status(200).send({ results: userExist });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = route;