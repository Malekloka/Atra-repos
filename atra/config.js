module.exports = {
  database: {
    connectionString: process.env.MONGODB_URI,
    dbName: process.env.DB_NAME || 'box'
  }
};
