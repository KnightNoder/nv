const { db } = require('../../connection');
const { Sequelize, QueryTypes } = require('sequelize');
query = {
    verifyUserQuery: async function (req, res, next)  {
        try {

            let verifyUserQueryResult = await db.query(`select u.id as userId, u.restaurant_id as restaurantId,
             u.branch_id as branchId, u.username as username, p.name as profile 
              from user as u left outer join gender as g on g.id=u.gender_id left outer join profile as p on p.id=u.profile_id  where 
               u.email=?  and u.password=? and p.is_deleted=0 and g.is_deleted=0 and u.is_deleted=0`,
                { replacements: [req.body.email, req.body.password], type: QueryTypes.SELECT });
    
            if (verifyUserQueryResult.length)
                return verifyUserQueryResult;
            else
                return false;
        } catch (error) {
            throw "DB error"
        }
}
}
module.exports = query;