const { Sequelize, QueryTypes } = require('sequelize');
const MongoClient = require("mongodb").MongoClient;

module.exports = {
    get_connection: async function() {
        let sequelize = new Sequelize(`mysql://${process.env.dbUser}:${process.env.dbPassword}@${process.env.dbHost}:${process.env.dbPort}/ghc`);
        try {
            await sequelize.authenticate();
            console.log('Connection has been established successfully.');
            return sequelize;
        } catch (error) {
            throw error;
        }
    },
    
    db:new Sequelize(`mysql://${process.env.dbUser}:${process.env.dbPassword}@${process.env.dbHost}:${process.env.dbPort}/ghc`),

    getMongoConnection:async(req)=>{
        try {
            console.log('connecting to Mongo DB');
            return MongoClient.connect(`${process.env.mongodbUrl}`, {
              useUnifiedTopology: true
            });
          } catch (error) {
            console.log(error)
          }
    },

    closeMongoConnection:async(db)=> {
        console.log('closing connection to DB');
        return db.close();
      }
    
   
}