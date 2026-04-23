const mongoose = require('mongoose');
const config = require('./index');
const logger = require('./logger');

const connectDB = async () => {
  try {
    logger.info('Connecting to MongoDB');
    const conn = await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      waitQueueTimeoutMS: 10000,
    });
    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

module.exports = connectDB;
