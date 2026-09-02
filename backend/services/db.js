/**
 * MongoDB connection service using Mongoose.
 * Provides connectDB() and disconnectDB() for server lifecycle management.
 */
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

// Disable command buffering globally — operations throw immediately when not connected
mongoose.set('bufferCommands', false);

async function connectDB() {

  mongoose.connection.on('connected', () =>
    logger.info(`MongoDB connected: ${config.mongodbUri}`)
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );
  mongoose.connection.on('error', (err) =>
    logger.error(`MongoDB error: ${err.message}`)
  );

  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });
}

async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}

module.exports = { connectDB, disconnectDB };
