// add all route that will not use the verifyToken middleware here
// Incase you don't want to use any middleware, assign empty string (path: '')
// In case you want to use multiple middlwares, assign comma-separated names of middlewares (path: 'middleware1,middleware2')
module.exports = {
    'auth': '',
    'auth/': '',
    'auth/signIn': '',
    'referral/createReferral':'',
    'referral/checkBalance':'',
    'referral/orderWebhook':'',
    'referral/redeem':'',
    'referral/redeemMcash':'',
    'referral/voucherAdded': '',
    'referral/shiprocketWebhook':'',
    '*': 'verifyToken'
}