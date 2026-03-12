const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'box';

const locations = [
  { key: 'haifa', en: 'Haifa', he: 'חיפה', ar: 'حيفا' },
  { key: 'jerusalem', en: 'Jerusalem', he: 'ירושלים', ar: 'القدس' },
  { key: 'tel-aviv', en: 'Tel-Aviv', he: 'תל אביב', ar: 'تل أبيب' },
  { key: 'arad', en: 'Arad', he: 'ערד', ar: 'عراد' }
];

const run = async () => {
  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection('locations');

  for (const location of locations) {
    await collection.updateOne(
      { key: location.key },
      { $set: { ...location, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  await client.close();
  console.log('Seeded locations:', locations.map((l) => l.key).join(', '));
};

run().catch((error) => {
  console.error('Failed to seed locations:', error);
  process.exit(1);
});
