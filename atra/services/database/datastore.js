const { MongoClient, ServerApiVersion } = require('mongodb');
const DataStoreCollection = require('./collection');


class DataStore {
  constructor(config){
    const { connectionString, dbName = 'box' } = config;
    
    const client = new MongoClient(
      connectionString, 
      { 
        useNewUrlParser: true, 
        useUnifiedTopology: true, 
        serverApi: ServerApiVersion.v1 
      });

    this.client = client;
    
    const db = client.db(dbName);
    this.db = db;

    this.items = new DataStoreCollection(db, 'items');
    this.counters = db.collection('counters');
  }

  createItemId(tenantId = 'default'){
    return this.counters.findOneAndUpdate(
      { name: 'itemsCounter', tenantId },
      { $setOnInsert: { createdAt: new Date() }, $inc: { value: 1 } },
      { returnDocument: 'after', upsert: true }
    );
  }

  async connect(){
    return this.client.connect();
  }

  async close(){
    return this.client.close();
  }
}

module.exports = DataStore;