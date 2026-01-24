import { MongoClient, ServerApiVersion } from 'mongodb';
import DataStoreCollection from './collection.js';
import config from '../../config.js';

export class DataStore {
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
    this.themes = new DataStoreCollection(db, 'themes');
    this.maps = new DataStoreCollection(db, 'maps');
    this.connections = new DataStoreCollection(db, 'connections');
    this.comments = new DataStoreCollection(db, 'comments');
  }

  async addTheme(text){
    await this.themes.create({ text });
  }

  async connect(){
    return this.client.connect();
  }

  async close(){
    return this.client.close();
  }
}

const datastore = new DataStore(config.database);

export default datastore;