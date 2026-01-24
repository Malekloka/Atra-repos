export default {
  database: {
    connectionString: process.env.MONGODB_URI,
    dbName: process.env.DB_NAME || 'box'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  }
};