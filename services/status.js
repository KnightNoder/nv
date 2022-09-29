const {fetchStatusId} = require('../db/Query/status/query')

service = {
    fetchStatusIdService:async(req, res)=>{
        let result;
        try{
            result = await fetchStatusId({type:req.type, status:req.status});
            if(!result.length) throw `Could not find status with type: ${req.type} and status:${req.status}`;
            return result[0].id
        }catch(error){
            throw error
        }
    }
}

module.exports = service;