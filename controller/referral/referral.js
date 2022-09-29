const fs = require('fs').promises;
const {createReferallService, checkBalanceService, addtoLedgerService, redeemBalanceService, updateOrderService, redeemMcashService, addVoucherService} = require('../../services/referral');

route = {
    createReferall: async function (req, res, next) {
        let result, request = req.body
        let response = {code:"OK", body:{}};
        try {
            if(!request.customer_id) throw 'Please enter the customer ID';
            result = await createReferallService(request);
            response.body = result
            return res.status(200).json(response);
        } catch (error) {
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    checkBalance:async function(req, res, next){
        let result, request = req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.customer_id) throw 'Please enter the customer ID';
            result = await checkBalanceService(request);
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    orderCreations:async function(req, res, next){
        let result, request = req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.discount_codes.length || !request.order_number) return res.status(200).json(response);
            result = await addtoLedgerService(request)
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    redeemBalance:async function(req, res, next){
        let result, request = req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.customer_id || !request.redeem) throw 'Please enter the customer ID and points to redeem';
            result = await redeemBalanceService(request);
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    orderUpdate:async function(req, res, next){
        let result, request=req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.order_number || !request.status) throw 'Please enter the order number and status';
            result = await updateOrderService(request);
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    redeemMcash: async function(req, res, next){
        let result, request = req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.customer_id || !request.redeem) throw 'Please enter the customer ID and points to redeem';
            result = await redeemBalanceService(request);
            whatsapp = await redeemMcashService(request);
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    },

    voucherAdded: async function(req, res, next){
        let result, request = req.body;
        let response = {code:"OK", body:{}};
        try{
            if(!request.customer_id || !request.voucher_code) throw 'Please enter customer ID and voucher code';
            result = await addVoucherService(request)
            response.body = result;
            return res.status(200).json(response);
        }catch(error){
            return res.status(400).send({ "error": error.message ? error.message : error });
        }
    }
}

module.exports = route;