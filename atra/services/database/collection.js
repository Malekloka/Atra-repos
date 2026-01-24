const { ObjectId } = require('mongodb');

const fuzzySearchFields = [
  'fullname', 'text'
]

class DataStoreCollection {
  constructor(db, collectionName){
    this.collection = db.collection(collectionName);

    // const fuzzyTextIndexes = {};
    // fuzzySearchFields.forEach(field => {
    //   fuzzyTextIndexes[field] = 'text';
    // });

    // this.collection.createIndex( fuzzyTextIndexes)
  }

  async create(index){
    const operation = await this.collection.insertOne({
      createdAt: new Date(),
      published: false,
      isDraft: true,
      index: index
    });


    return operation.insertedId;
  }

  remove(itemId){
    return this.update(itemId, {deleted: true});
  }

  async get(itemIdOrQuery){
    if(typeof itemIdOrQuery === 'string'){
      itemIdOrQuery = new ObjectId(itemIdOrQuery);
    }

    if(itemIdOrQuery instanceof ObjectId){
      return this.collection.findOne({ _id: itemIdOrQuery });
    }

    return this.collection.findOne(itemIdOrQuery);
  }

  async update(itemId, values, options = {}){
    if(!options.silent){
      values.updatedAt = new Date();
    }

    return this.collection.findOneAndUpdate(
      { _id: new ObjectId(itemId) },
      { $set: values }
    );
  }

  async publish(itemId){
    return this.update(itemId, { published: true, publishedAt: new Date() });
  }

  allItems(){
    return this.collection.find({}).sort({updatedAt: -1}).toArray();
  }

  async textSearch(searchText, fields, filters){
    const query = {isDraft:false, deleted: {$exists: false}};
    const regex = new RegExp(searchText.trim(), 'i');
    fields = fields ?? fuzzySearchFields;
    if(searchText.length){
      if(fields.length > 1){
        query['$or'] = [];
        fields.forEach(field => query['$or'].push({[field]: regex}));
        query['$or'].push({'index': parseInt(searchText)})
      } else {
        query[fields[0]] = regex;
      }
    }

    const dateFilter = {};

    if(filters && filters != {}){
      for(const filter in filters){
        if(filter === 'startDate'){
          dateFilter['$gte'] = new Date(filters[filter]);
        } else  if(filter === 'endDate'){
          dateFilter['$lte'] = new Date(filters[filter]);
        }
        else if(filters[filter] === 'empty'){
          filters[filter] = ''
        } else if(filters[filter] === 'not-empty'){
          filters[filter] = {$ne: ''}
        } else {
          query[filter] = filters[filter];
        }
      }
    }

    if(dateFilter['$gte'] || dateFilter['$lte']){
      query['updatedAt'] = dateFilter;
    }

    return this.collection.find( query ).sort({updatedAt: -1}).toArray();
  }
}

module.exports = DataStoreCollection;