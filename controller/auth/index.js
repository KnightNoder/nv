var router = require('express').Router();
var { signIn } = require('./routes/signIn');
var { getUser } = require('./routes/getUser');

router.get('/', async (req, res, next) => {
    try {
        return res.json({
            status_code: 200,
            data: "Ok"
        });
    }
    catch (e) {
        throw e;
    }
});

router.post('/signIn', signIn);
router.get('/getUser', getUser);

module.exports = router;