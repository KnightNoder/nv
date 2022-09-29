const { get_connection } = require('../../connection');
const { Sequelize, QueryTypes } = require('sequelize');

query = {
    fetchStatusId: async (req, res) => {
        let status;
        let sqlConn = await get_connection();
        try {
            status = await sqlConn.query(`SELECT * FROM status s WHERE s.type = '${req.type}' AND s.status = '${req.status}' AND s.isDeleted=false`, { type: QueryTypes.SELECT });
            return status;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = query;