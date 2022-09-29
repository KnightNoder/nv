const router = require("express").Router();
var {createReferall, checkBalance, orderCreations, redeemBalance, redeemMcash, voucherAdded, orderUpdate} = require('./referral');

router.post('/createReferral', createReferall);
router.post('/checkBalance', checkBalance);
router.post('/redeem', redeemBalance);

router.post('/redeemMcash', redeemMcash);
router.post('/voucherAdded', voucherAdded);

router.post('/orderWebhook', orderCreations);
router.post('/shiprocketWebhook', orderUpdate);

module.exports = router;