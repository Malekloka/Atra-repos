import { ObjectId } from 'mongodb';

const eligibleItemsQuery = {  
  isDraft: false,
  deleted: {$exists: false}
}

export default class DataStoreCollection {
  constructor(db, collectionName){
    this.collection = db.collection(collectionName);
  }

  async create(initialValues){
    const operation = await this.collection.insertOne({
      createdAt: new Date(),
      ...initialValues
    });

    return operation.insertedId;
  }

  async getPublished(query){
    query = {
      ...eligibleItemsQuery,
      ...query
    };

    return this.get(query);
  }

  async get(itemIdOrQuery, options = {}){
    if(typeof itemIdOrQuery === 'string'){
      itemIdOrQuery = new ObjectId(itemIdOrQuery);
    }

    if(itemIdOrQuery instanceof ObjectId){
      const query = { _id: itemIdOrQuery };
      if (options.tenantId) {
        query.tenantId = options.tenantId;
      }
      return this.collection.findOne(query);
    }

    return this.collection.findOne(itemIdOrQuery);
  }

  async collect(query, details){
    let op = this.collection.find(query);
    if(details){
      op = op.project(details);
    }
    return op.toArray();
  }

  delete(itemId){
    if(typeof itemId === 'string'){
      itemId = new ObjectId(itemId);
    }

    return this.collection.deleteOne({ _id: itemId }); 
  }

  deleteMany(query){
    return this.collection.deleteMany(query);
  }

  async collectPublished(query, details){
    query = {
      ...eligibleItemsQuery,
      ...query
    };
    
    return this.collect(query, details);
  }

  async update(itemId, values, options = {}){
    if(!options.silent){
      values.updatedAt = new Date();
    }

    return this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(itemId),
        ...(options.tenantId ? { tenantId: options.tenantId } : {})
      },
      { $set: values },
      { returnDocument: 'after' }
    );
  }

  async upsert(query, values){
    return this.collection.updateOne(
      query,
      { $set: {
        ...values, 
        ...query
      } },
      { upsert: true }
    );
  }

  async bulkUpsert(items){
    const operations = items.map(item => ({
      updateOne: {
        filter: item,
        update: { $set: item },
        upsert: true
      }
    }));

    return this.collection.bulkWrite(operations);
  }

  async saveItem(item){
    return this.update(item._id, item, {
      silent: true,
      ...(item.tenantId ? { tenantId: item.tenantId } : {})
    });
  }
}