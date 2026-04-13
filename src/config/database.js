const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    console.log("database URI",config.mongodb.uri )
    const conn = await mongoose.connect(config.mongodb.uri);
    // const dbName = conn.connection.name;
    // console.log(`MongoDB Connected: ${conn.connection.host} [Database: ${dbName}]`);
    // Get all "tables" (collections) after connection
    // const collections = await mongoose.connection.db.listCollections().toArray();
    // console.log(
    //   'MongoDB Collections:',
    //   collections.map((col) => col.name)
    // );
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
