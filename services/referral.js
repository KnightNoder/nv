const axios = require('axios');
const { createUser, checkUserWithCustomerId, checkUserWithReferralCode, createLedger, fetchLedgerwithCustomerId, fetchLedgerwithOrderId, updateLedger, markLedgerDeleted } = require('../db/Query/referral/query');
const { fetchStatusIdService } = require('../services/status')
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.mail_user,
        pass: process.env.mail_app_password,
    },
});

service = {
    createReferallService: async function (req, res, next) {
        let userExist, newUser, referralCode, discountCode, result;
        try {
            userExist = await checkUserWithCustomerId(req);
            if (userExist.length) {
                return { customer_id: userExist[0].user_id, referral_code: userExist[0].referral_code }
            } else {
                newUser = await service.fetchUserwithCustomerId(req);
                if (!newUser.length) throw `could not find customer with customer_id: ${req.customer_id}`
                referralCode = newUser[0].first_name + newUser[0].id.toString().slice(-6);
                discountCode = await service.createDiscountCode({ code: referralCode });
                await createUser({ customer_id: newUser[0].id, discountCode: discountCode.code });
                return { customer_id: newUser[0].id, referral_code: discountCode.code }
            }
        } catch (error) {
            throw error;
        }
    },

    fetchUserwithCustomerId: async function (req, res, next) {
        let user, config;
        try {
            config = {
                method: 'get',
                url: `https://${process.env.shopifyAPIkey}:${process.env.shopifyAPISecret}@${process.env.shopifyHost}/admin/api/2021-10/customers.json?ids=${req.customer_id}`,
                headers: {}
            };
            user = await axios(config);
            return user.data.customers;
        } catch (error) {
            throw error.response.data.errors;
        }
    },

    createDiscountCode: async function (req, res, next) {
        let data;
        try {
            data = JSON.stringify({
                "discount_code": {
                    "code": req.code
                }
            });
            var config = {
                method: 'post',
                url: `https://${process.env.shopifyAPIkey}:${process.env.shopifyAPISecret}@${process.env.shopifyHost}/admin/api/2020-07/price_rules/${process.env.price_rule_id}/discount_codes.json`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: data
            };
            res = await axios(config);
            return res.data.discount_code;
        } catch (error) {
            throw error.response.data.errors
        }
    },

    checkBalanceService: async function (req, res, next) {
        let result, ledger, availableBalance, lifetime, rewardedLedger, statusRejected, statusRewarded;
        try {
            ledger = await fetchLedgerwithCustomerId(req);
            statusRewarded = await fetchStatusIdService({ type: 'ledger', status: 'rewarded' });
            statusRejected = await fetchStatusIdService({ type: 'ledger', status: 'rejected' });
            lifetime = ledger.reduce((acc, curr) => {
                if (curr.type == 'credit' && curr.statusId != statusRejected) {
                    acc += curr.value
                }
                return acc;
            }, 0);
            availableBalance = ledger.reduce((acc, curr) => {
                if (curr.type == 'credit' && curr.statusId == statusRewarded) {
                    acc += curr.value
                }
                return acc;
            }, 0);
            return result = { ledger: ledger, balance: availableBalance, lifetime: lifetime };
        } catch (error) {
            throw error;
        }
    },

    addtoLedgerService: async function (req, res, next) {
        let user, status, ledger;
        try {
            user = await checkUserWithReferralCode(req.discount_codes[0]);
            if (!user.length) return;
            ledger = await fetchLedgerwithOrderId({ order_number: req.order_number });
            if (ledger.length) return;
            status = await fetchStatusIdService({ type: 'ledger', status: 'pending' });
            await createLedger({ customer_id: user[0].user_id, value: 100, type: 'credit', status: status, order: req.order_number })
            return;
        } catch (error) {
            throw error
        }
    },

    redeemBalanceService: async function (req, res, next) {
        let statusRewarded, ledger, availableBalance, rewardedLedger, statusRedeemed, pointsToRedeem, statusPending;
        try {
            pointsToRedeem = parseInt(req.redeem / 100) * 100;
            if (pointsToRedeem == 0) throw 'Please enter points in multiple of 500'
            ledger = await fetchLedgerwithCustomerId(req);
            [statusRewarded, statusRedeemed, statusPending] = await Promise.all([fetchStatusIdService({ type: 'ledger', status: 'rewarded' }), fetchStatusIdService({ type: 'ledger', status: 'redeemed' }), fetchStatusIdService({ type: 'ledger', status: 'pending' })]);
            availableBalance = ledger.reduce((acc, curr) => {
                if (curr.type == 'credit' && curr.statusId == statusRewarded) {
                    acc += curr.value
                }
                return acc;
            }, 0);
            if (pointsToRedeem > availableBalance) throw `Insufficient Balance: Please enter point within available balance, ${availableBalance}`;
            rewardedLedger = ledger.filter((item) => item.statusId == statusRewarded && item.type == 'credit').sort((a, b) => a.createdAt - b.createdAt);
            let promiseArray = []
            for (let i = 0; i < pointsToRedeem / 100; i++) {
                promiseArray = promiseArray.concat([createLedger({ customer_id: rewardedLedger[i].user, value: rewardedLedger[i].value, type: rewardedLedger[i].type, status: statusRedeemed, order: rewardedLedger[i].order }), markLedgerDeleted({ id: rewardedLedger[i].id })]);
            }
            await Promise.all(promiseArray)
            await createLedger({ customer_id: req.customer_id, value: pointsToRedeem, type: 'debit', status: statusPending, order: null });
            ledger = await fetchLedgerwithCustomerId(req);
            availableBalance = ledger.reduce((acc, curr) => {
                if (curr.type == 'credit' && curr.statusId == statusRewarded) {
                    acc += curr.value
                }
                return acc;
            }, 0);
            return { ledger: ledger, balance: availableBalance };
        } catch (error) {
            throw error;
        }
    },

    updateOrderService: async function (req, res, next) {
        let result, ledger, status;
        try {
            ledger = await fetchLedgerwithOrderId(req);
            if (!ledger.length) return;
            status = req.status == 'delivered' ? await fetchStatusIdService({ type: 'ledger', status: 'rewarded' }) : await fetchStatusIdService({ type: 'ledger', status: 'rejected' });
            await createLedger({ customer_id: ledger[0].user, value: ledger[0].value, type: ledger[0].type, status: status, order: ledger[0].order });
            await markLedgerDeleted({ id: ledger[0].id });
            return;
        } catch (error) {
            throw error;
        }
    },

    redeemMcashService: async function (req, res, next) {
        let userExist, user, html, message;
        let type = "redeemMcash";
        let mailSubject = "Your Amazon Voucher is on the way!";
        try {
            userExist = await checkUserWithCustomerId(req, res);
            user = await shopifyCustomerDetails(userExist[0].user_id, req.brand);
            if (userExist.length && user.data.customer.phone || user.data.customer.default_address.phone) {

                message = await generateMessageTemplate(req, type, user.data);
                html = await generateEmailTemplate(req, type);
                await whatsapp(message);
                await email(user.data, html, mailSubject);
                return;
            }
        } catch (error) {
            throw error;
        }
    },

    addVoucherService: async function (req, res, next) {
        let userExist, user, html, message;
        let type = "addVoucher";
        let mailSubject = "Amazon voucher code generated successfully";
        try {
            userExist = await checkUserWithCustomerId(req, res);
            user = await shopifyCustomerDetails(userExist[0].user_id, req.brand);
            if (userExist.length && user.data.customer.phone || user.data.customer.default_address.phone) {

                message = await generateMessageTemplate(req, type, user.data);
                html = await generateEmailTemplate(req, type);
                await whatsapp(message);
                await email(user, html, mailSubject);
                return;
            }
        } catch (error) {
            throw error;
        }
    }
}

async function generateMessageTemplate(req, type, user) {
    let template
    if (type == 'redeemMcash') {
        return template = JSON.stringify({
            "userDetails": {
                "number": user.customer.phone ? user.customer.phone : user.customer.default_address.phone 
                // "number": "919694224021"
            },
            "notification": {
                "type": process.env.yellow_messenger_message_type,
                "sender": process.env.yellow_messenger_sender,
                "templateId": req.brand == 'saturn' ? `${process.env.redeem_mcash_template_id}` : `${process.env.redeem_mcash_template_id}`,
                "params": {
                    "amount": req.redeem,
                    "quickReplies": {
                        "ctaUrlParam": "bLTYHFb"
                    },
                    "media": {
                        "mediaLink": "https://cdn.shopify.com/s/files/1/0612/7747/0942/files/Referal_order_placed.png?v=1664185729"
                    }
                }
            }
        });
    } else {
        return template = JSON.stringify({
            "userDetails": {
                "number": user.customer.phone ? user.customer.phone : user.customer.default_address.phone 
                // "number": "919694224021"
            },
            "notification": {
                "type": process.env.yellow_messenger_message_type,
                "sender": process.env.yellow_messenger_sender,
                "templateId": req.brand == 'saturn' ? `${process.env.voucher_created_template_id}` : `${process.env.voucher_created_template_id}`,
                "params": {
                    "amount": req.amount,
                    "voucherCode": req.voucher_code,
                    "link": "https://www.amazon.in/g/U4F8M5TT97GJ52B3?_encoding=UTF8&asin=B00KGE2ER2",
                    "quickReplies": {
                        "ctaUrlParam": "bLTYHFb"
                    },
                    "media": {
                        "mediaLink": "https://cdn.shopify.com/s/files/1/0612/7747/0942/files/Referal_order_placed.png?v=1664185729"
                    }
                }
            }
        });
    }
}

async function generateEmailTemplate(req, type) {
    let html
    if (type == 'redeemMcash') {
        return html = req.brand == 'saturn' ? 
        `<html>
        <head>
            <link href="http://fonts.cdnfonts.com/css/inter" rel="stylesheet">
            <title></title>
            <style type="text/css">
                body {
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    background-color: #eeeeee;
                    font-family: 'Inter', sans-serif;
                }
        
                body,
                table,
                td,
                a {
                    -webkit-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }
        
                table,
                td {
                    mso-table-lspace: 0pt;
                    mso-table-rspace: 0pt;
                }
        
                table {
                    border-collapse: collapse !important;
                }
        
                body {
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                }
        
                .success {
                    padding: 20px;
                }
        
                .success h3 {
                    color: #975169;
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0 13%;
                    text-align: center
                }
        
                tbody {
                    position: relative;
                }
        
                a {
                    color: #975169;
                    font-weight: 600;
                }
        
                .voucher {
                    width: 25%;
                    border: 1px dashed lightgray;
                    padding: 10px;
                    border-radius: 5px;
                    display: flex;
                    justify-content: space-between;
                    background-color: white;
        
                }
        
                .voucher input {
                    margin: 0px;
                    background: transparent;
                    font-weight: 500;
                    border: none;
                    font-size: 16px;
                }
        
                @media screen and (max-width: 480px) {
                    .mobile-center {
                        text-align: center !important;
                    }
                }
        
                div[style*="margin: 16px 0;"] {
                    margin: 0 !important;
                }
            </style>
        </head>
        
        <body>
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="background-color: #eeeeee;" bgcolor="#eeeeee">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
                            <tr>
                                <td align="center" valign="top" style="font-size:0;" bgcolor="white">
                                    <div style="width:100%;">
                                        <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr style="display:grid;">
        
                                                <td align="left" class="mobile-center header">
                                                    <img style="width:100%; object-fit: cover;"
                                                        src="https://s3.ap-south-1.amazonaws.com/cdn.ghc.health/021b2380-2517-4756-99bd-22d44aabb731.png"
                                                        alt="order-placed" />
                                                </td>
                                                <td class="success">
                                                    <h3>Refer more &#x2192; Earn more &#x2192; Redeem more</h3>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px 50px; background-color: #FFEEF3;">
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
                                        style="max-width:600px;">
                                        <tr style="display:grid ;">
                                            <td class="content">
                                            <p style="margin-top: 0px;">Hi User,</p>
                                            <p>This is to confirm that your request for redemption of <a>${req.redeem} sCash</a> has been
                                                submitted successfully. You will soon receive your Amazon voucher code <a>worth
                                                Rs.${req.redeem * process.env.redemption_price}</a> via email and phone number.</p>
                                            <p>Check your <a>sCash rewards balance</a>. Refer more friends, earn and Redeem!</p>
                                            <p>Indulge in some selfcare, checkout our wellness range on <a style="color: #975169 !important; text-decoration: none !important" href="https://saturn.health/">saturn.health</a></p>
                                            <p style="margin-bottom: 5px;">Love,</p>
                                            <span>Saturn</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px; background-color: #ffffff;" bgcolor="#ffffff">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <table border="0" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style="color: #975169; font-size: 20px; text-align: center;">
                                                            <h3 style="margin-top: 0px">Check out your Rewards, Refer & Redeem</h3>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <table border="0" cellpadding="0" cellspacing="0" style="width: 50%">
                                                    <tr>
                                                        <td bgcolor="#F7E514" class="innertd buttonblock"
                                                            style=" border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; background-color: #F7E514;">
                                                            <a alias="" class="buttonstyles" conversion="false"
                                                                data-linkto="http://" href="https://prex-prex-prex.myshopify.com/pages/referral-new"
                                                                style=" font-size: 16px; color: white; text-decoration: none; display: block; text-align: center; background-color: #975169; padding: 15px 50px; border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; font-weight: 600;"
                                                                target="_blank" title="">REFER & EARN</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            </td>
            </tr>
            </table>
        </body>
        
        </html>` 
        : 
        `<html>
        <head>
            <link href="http://fonts.cdnfonts.com/css/inter" rel="stylesheet">
            <title></title>
            <style type="text/css">
                body {
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    background-color: #eeeeee;
                    font-family: 'Inter', sans-serif;
                }
        
                body,
                table,
                td,
                a {
                    -webkit-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }
        
                table,
                td {
                    mso-table-lspace: 0pt;
                    mso-table-rspace: 0pt;
                }
        
                table {
                    border-collapse: collapse !important;
                }
        
                body {
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                }
        
                .success {
                    padding: 20px;
                }
        
                .success h3 {
                    color: #FF8277;
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0 13%;
                    text-align: center
                }
        
                tbody {
                    position: relative;
                }
        
                a {
                    color: #FF8277;
                    font-weight: 600;
                }
        
                .voucher {
                    width: 25%;
                    border: 1px dashed lightgray;
                    padding: 10px;
                    border-radius: 5px;
                    display: flex;
                    justify-content: space-between;
                    background-color: white;
        
                }
        
                .voucher input {
                    margin: 0px;
                    background: transparent;
                    font-weight: 500;
                    border: none;
                    font-size: 16px;
                }
        
                @media screen and (max-width: 480px) {
                    .mobile-center {
                        text-align: center !important;
                    }
                }
        
                div[style*="margin: 16px 0;"] {
                    margin: 0 !important;
                }
            </style>
        </head>
        
        <body>
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="background-color: #eeeeee;" bgcolor="#eeeeee">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
                            <tr>
                                <td align="center" valign="top" style="font-size:0;" bgcolor="white">
                                    <div style="width:100%;">
                                        <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr style="display:grid;">
        
                                                <td align="left" class="mobile-center header">
                                                    <img style="width:100%; object-fit: cover;"
                                                        src="https://s3.ap-south-1.amazonaws.com/cdn.ghc.health/6492970d-d644-4daa-bd21-f0c52c91da51.png"
                                                        alt="order-placed" />
                                                </td>
                                                <td class="success">
                                                    <h3>Refer more &#x2192; Earn more &#x2192; Redeem more</h3>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px 50px; background-color: #FFE8D9AB;">
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
                                        style="max-width:600px;">
                                        <tr style="display:grid ;">
                                            <td class="content">
                                            <p style="margin-top: 0px;">Hi User,</p>
                                            <p>This is to confirm that your request for redemption of <a>${req.redeem} mCash</a> has been
                                                submitted successfully. You will soon receive your Amazon voucher code <a>worth
                                                Rs.${req.redeem * process.env.redemption_price}</a> via email and phone number.</p>
                                            <p>Check your <a>mCash rewards balance</a>. Refer more friends, earn and Redeem!</p>
                                            <p>Indulge in some selfcare, checkout our wellness range on <a style="color: #FF8277 !important; text-decoration: none !important" href="https://ghc.health/">ghc.health</a></p>
                                            <p style="margin-bottom: 5px;">Love,</p>
                                            <span>Mars</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px; background-color: #ffffff;" bgcolor="#ffffff">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <table border="0" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style="color: #FF8277; font-size: 20px; text-align: center;">
                                                            <h3 style="margin-top: 0px">Check out your Rewards, Refer & Redeem</h3>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <table border="0" cellpadding="0" cellspacing="0" style="width: 50%">
                                                    <tr>
                                                        <td bgcolor="#F7E514" class="innertd buttonblock"
                                                            style=" border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; background-color: #F7E514;">
                                                            <a alias="" class="buttonstyles" conversion="false"
                                                                data-linkto="http://" href="https://prex-prex-prex.myshopify.com/pages/referral-new"
                                                                style=" font-size: 16px; color: white; text-decoration: none; display: block; text-align: center; background-color: #FF8277; padding: 15px 50px; border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; font-weight: 600;"
                                                                target="_blank" title="">REFER & EARN</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            </td>
            </tr>
            </table>
        </body>
        
        </html>`
    } else {
        return html = req.brand == 'saturn' ? 
        `<html 
        <head>
        <link href="http://fonts.cdnfonts.com/css/inter" rel="stylesheet">
        <title></title>
        <style type="text/css">
            body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                background-color: #eeeeee;
                font-family: 'Inter', sans-serif;
            }
        
            body,
            table,
            td,
            a {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
        
            table,
            td {
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
            }
        
            table {
                border-collapse: collapse !important;
            }
        
            body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
            }
        
            tbody {
                position: relative;
            }
        
            a {
                color: #975169;
                font-weight: 600;
            }
        
            @media screen and (max-width: 480px) {
                .mobile-center {
                    text-align: center !important;
                }
            }
        
            div[style*="margin: 16px 0;"] {
                margin: 0 !important;
            }
        </style>
        </head>
        
        <body>
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="background-color: #eeeeee;" bgcolor="#eeeeee">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
                            <tr>
                                <td align="center" valign="top" style="font-size:0;" bgcolor="white">
                                    <div style="width:100%;">
                                        <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr style="display:grid;">
        
                                                <td align="left" class="mobile-center header">
                                                    <img style="width:100%; object-fit: cover;"
                                                        src="https://s3.ap-south-1.amazonaws.com/cdn.ghc.health/8693c9ac-431d-4d38-aee5-f582d1a2d085.png"
                                                        alt="order-placed" />
                                                </td>
                                                <td class="success" style=" padding: 20px;">
                                                    <h3 style="color: #975169;
                                                            font-size: 20px;
                                                            font-weight: 600;
                                                            margin: 0 13%;
                                                            text-align: center">You’ve earned it!</h3>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px 50px; background-color: #FFEEF3;">
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
                                        style="max-width:600px;">
                                        <tr style="display:grid ;">
                                            <td class="content">
        
                                                <p style="margin-top: 0px;">Hi User,</p>
                                                <p>The wait is over! Here’s your Amazon voucher code worth
                                                    Rs. ${req.amount}
                                                </p>
                                                <div class="voucher" style="  width: 35%;
                                                border: 1px dashed lightgray;
                                                padding: 10px;
                                                border-radius: 5px;
                                                display: flex;
                                                justify-content: space-between;
                                                background-color: white;">
                                                    <input style=" width: 100%;
                                                    margin: 0px;
                                                    background: transparent;
                                                    font-weight: 500;
                                                    border: none;
                                                    font-size: 16px;" value=${req.voucher_code} id="myInput" readonly />
                                                </div>
                                                <p>Check your <a>sCash balance, History and Vouchers</a>. Refer more friends,
                                                    earn and Redeem!
                                                </p>
                                                <p>Indulge in some selfcare, checkout our wellness range on <a
                                                        style="color: #975169 !important; text-decoration: none !important"
                                                        href="https://saturn.health/">saturn.health</a>
                                                </p>
                                                <p style="margin-bottom: 5px;">Love,</p>
                                                <span>Saturn</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px; background-color: #ffffff;" bgcolor="#ffffff">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <table border="0" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style="color: #975169; font-size: 20px; text-align: center;">
                                                            <h3 style="margin-top: 0px">Click on the link to add to Amazon Pay
                                                                balance</h3>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <table border="0" cellpadding="0" cellspacing="0" style="width: 50%">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style=" border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px;">
                                                            <a alias="" class="buttonstyles" conversion="false"
                                                                data-linkto="http://"
                                                                href="https://prex-prex-prex.myshopify.com/pages/referral-new"
                                                                style=" font-size: 16px; color: white; text-decoration: none; display: block; text-align: center; background-color: #975169; padding: 15px 50px; border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; font-weight: 600;"
                                                                target="_blank" title="">ADD TO AMAZON</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            </td>
            </tr>
            </table>
        </body>
        
        </html>`
        :
        `<html 
        <head>
        <link href="http://fonts.cdnfonts.com/css/inter" rel="stylesheet">
        <title></title>
        <style type="text/css">
            body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                background-color: #eeeeee;
                font-family: 'Inter', sans-serif;
            }
        
            body,
            table,
            td,
            a {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
        
            table,
            td {
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
            }
        
            table {
                border-collapse: collapse !important;
            }
        
            body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
            }
        
            tbody {
                position: relative;
            }
        
            a {
                color: #FF8277;
                font-weight: 600;
            }
        
            @media screen and (max-width: 480px) {
                .mobile-center {
                    text-align: center !important;
                }
            }
        
            div[style*="margin: 16px 0;"] {
                margin: 0 !important;
            }
        </style>
        </head>
        
        <body>
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="background-color: #eeeeee;" bgcolor="#eeeeee">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
                            <tr>
                                <td align="center" valign="top" style="font-size:0;" bgcolor="white">
                                    <div style="width:100%;">
                                        <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr style="display:grid;">
                                                <td align="left" class="mobile-center header">
                                                    <img style="width:100%; object-fit: cover;"
                                                        src="https://s3.ap-south-1.amazonaws.com/cdn.ghc.health/a262368d-cecf-437f-a2d0-11e76be775e9.png"
                                                        alt="order-placed" />
                                                </td>
                                                <td class="success" style="padding: 20px;">
                                                    <h3 style=" color: #FF8277;
                                                            font-size: 20px;
                                                            font-weight: 600;
                                                            margin: 0 13%;
                                                            text-align: center">You’ve earned it!</h3>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px 50px; background-color: #FFE8D9AB;
        ;">
                                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%"
                                        style="max-width:600px;">
                                        <tr style="display:grid ;">
                                            <td class="content">
        
                                                <p style="margin-top: 0px;">Hi User,</p>
                                                <p>The wait is over! Here’s your Amazon voucher code worth
                                                    Rs. ${req.amount}
                                                </p>
                                                <div class="voucher" style="width: 35%;
                                                        border: 1px dashed lightgray;
                                                        padding: 10px;
                                                        border-radius: 5px;
                                                        display: flex;
                                                        justify-content: space-between;
                                                        background-color: white;">
                                                    <input style="  width: 100%;
                                                            margin: 0px;
                                                            background: transparent;
                                                            font-weight: 500;
                                                            border: none;
                                                            font-size: 16px;" value=${req.voucher_code} id="myInput"
                                                        readonly />
                                                </div>
                                                <p>Check your <a>mCash balance, History and Vouchers</a>. Refer more friends,
                                                    earn and Redeem!
                                                </p>
                                                <p>Indulge in some selfcare, checkout our wellness range on <a
                                                        style="color: #FF8277 !important; text-decoration: none !important"
                                                        href="https://ghc.health/">ghc.health</a>
                                                </p>
                                                <p style="margin-bottom: 5px;">Love,</p>
                                                <span>Mars</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 35px; background-color: #ffffff;" bgcolor="#ffffff">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <table border="0" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style="color: #FF8277; font-size: 20px; text-align: center;">
                                                            <h3 style="margin-top: 0px">Click on the link to add to Amazon Pay
                                                                balance</h3>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <table border="0" cellpadding="0" cellspacing="0" style="width: 50%">
                                                    <tr>
                                                        <td class="innertd buttonblock"
                                                            style=" border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px;">
                                                            <a alias="" class="buttonstyles" conversion="false"
                                                                data-linkto="http://"
                                                                href="https://prex-prex-prex.myshopify.com/pages/referral-new"
                                                                style=" font-size: 16px; color: white; text-decoration: none; display: block; text-align: center; background-color: #FF8277; padding: 15px 50px; border-radius: 3px; -moz-border-radius: 3px; -webkit-border-radius: 3px; font-weight: 600;"
                                                                target="_blank" title="">ADD TO AMAZON</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            </td>
            </tr>
            </table>
        </body>
        
        </html>`
    }
}

async function shopifyCustomerDetails(user_id, brand) {
    try {
        let config = {
            method: 'get',
            url: brand == 'saturn' ? `${process.env.shopify_api_url}customers/${user_id}.json` : `${process.env.shopify_api_url}customers/${user_id}.json`,
            headers: {
                'X-Shopify-Access-Token': brand == 'saturn' ? `${process.env.shopify_access_token}` : `${process.env.shopify_access_token}`
            }
        };
        return await axios(config);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function whatsapp(body) {
    let result;
    try {
        let config = {
            method: 'post',
            url: process.env.yellow_messenger_api_url,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.yellow_messenger_api_key
            },
            data: body
        };

        result = await axios(config);
        return result.data;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function email(user, html, subject) {
    try {
        let mailOptions = {
            from: process.env.mail_user,
            to: "",
            subject: subject,
            text: ``,
            html: "",
        };
        mailOptions.html = html;
        mailOptions.to = user.data.customer.email ? user.data.customer.email : user.data.customer.default_address.email
        // mailOptions.to = "natasha.vyas@digi-prex.com";
        return await transporter.sendMail(mailOptions);

    } catch (error) {
        console.log(error);
    }
}

module.exports = service;