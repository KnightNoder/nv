const { db, get_connection } = require('../../connection');
const { Sequelize, QueryTypes } = require('sequelize');

query = {
    createUser : async (req, res)=>{
        let user;
        let sqlConn = await get_connection();
        try{
            user = await sqlConn.query(`INSERT INTO users (user_id, referral_code) VALUES (${req.customer_id}, '${req.discountCode}')`, {type: QueryTypes.INSERT});
            return user;
        }catch(error){
            throw error;
        }
    },

    checkUserWithCustomerId : async (req, res)=>{
        let user;
        let sqlConn = await get_connection();
        try{
            user = await sqlConn.query(`select * from users u where u.user_id = ${req.customer_id} AND u.isDeleted=false`, {type: QueryTypes.SELECT});
            return user;
        }catch(error){
            throw error;
        }
    },

    fetchLedgerwithCustomerId:async (req, res)=>{
        let ledger;
        let sqlConn = await get_connection();
        try{
            ledger = await sqlConn.query(
            `SELECT l.id, l.createdAt, l.value, l.\`type\`, s.\`status\`, s.id statusId, l.voucher_code, l.\`order\`, l.user FROM ledger l
            LEFT OUTER JOIN status s ON s.id = l.\`status\` AND s.isDeleted = FALSE 
            WHERE l.user = ${req.customer_id} AND l.isDeleted = FALSE 
                        ORDER BY l.createdAt DESC`, {type: QueryTypes.SELECT});
            return ledger;
        }catch(error){
            throw error;
        }
    },

    checkUserWithReferralCode:async(req, res)=>{
        let user;
        let sqlConn = await get_connection();
        try{
            user = await sqlConn.query(`SELECT * FROM users u WHERE u.referral_code = '${req.code}' AND u.isDeleted = false`, {type: QueryTypes.SELECT})
            return user;
        }catch(error){
            throw error;
        }
    },

    createLedger:async(req, res)=>{
        let ledger;
        let sqlConn = await get_connection();
        try{
            ledger = await sqlConn.query(`INSERT INTO ledger (USER, VALUE, TYPE, status, \`order\`) VALUES (${req.customer_id}, ${req.value}, '${req.type}', ${req.status}, ${req.order})`, {type: QueryTypes.INSERT})
            return ledger;
        }catch(error){
            throw error;
        }
    },

    fetchLedgerwithOrderId:async(req, res)=>{
        let ledger;
        let sqlConn = await get_connection();
        try{
            ledger = await sqlConn.query(`SELECT * FROM ledger l WHERE l.\`order\` = ${req.order_number} AND l.isDeleted = false`, {type: QueryTypes.SELECT})
            return ledger;
        }catch(error){
            throw error;
        }
    },

    updateLedger:async(req, res)=>{
        let ledger;
        let sqlConn = await get_connection();
        try{
            ledger = await sqlConn.query(`UPDATE ledger l SET l.\`status\`= ${req.status} WHERE l.id = ${req.id} AND l.isDeleted = false`, {type: QueryTypes.UPDATE})
        }catch(error){
            throw error;
        }
    },

    markLedgerDeleted:async(req, res)=>{
        let ledger;
        let sqlConn = await get_connection();
        try{
            ledger = await sqlConn.query(`UPDATE ledger l SET l.isDeleted = true WHERE l.id = ${req.id}`, {type: QueryTypes.UPDATE})
        }catch(error){
            throw error;
        }
    }
}

module.exports = query;
