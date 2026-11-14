/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/db.js – MongoDB connection (real URI or zero-setup local fallback)
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const config = require('./config');
const { createLogger } = require('./logger');

const log = createLogger('db');
const DEV_DB_PORT = 27018;
const DEV_DB_PATH = path.resolve(__dirname, '../../.data/mongo');
let memoryServer = null;

/**
 * Each microservice owns its own logical database on the shared cluster
 * (fleet_users, fleet_vehicles, ...). useDb() shares the underlying client,
 * so one process can host several services (npm run start:all, tests).
 */
function getDb(dbName) {
  return mongoose.connection.useDb(dbName, { useCache: true });
}

async function canConnect(uri) {
  const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 800 });
  try {
    await conn.asPromise();
    return true;
  } catch {
    return false;
  } finally {
    await conn.close().catch(() => {});
  }
}

/**
 * Zero-setup fallback when MONGO_URI is empty: reuse the local dev database
 * on port 27018 if one is already running (started by `npm run dev`),
 * otherwise start mongodb-memory-server with data persisted to ./.data/mongo.
 */
async function ensureDevMongo() {
  const uri = `mongodb://127.0.0.1:${DEV_DB_PORT}/`;
  if (await canConnect(uri)) return uri;

  // eslint-disable-next-line global-require
  const { MongoMemoryServer } = require('mongodb-memory-server');
  fs.mkdirSync(DEV_DB_PATH, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    instance: { port: DEV_DB_PORT, dbPath: DEV_DB_PATH, storageEngine: 'wiredTiger' },
  });
  log.info(`Started local MongoDB (mongodb-memory-server) on port ${DEV_DB_PORT}, data in .data/mongo`);
  return memoryServer.getUri();
}

/** Resolve which MongoDB URI to use. */
async function resolveMongoUri() {
  return config.mongoUri() || ensureDevMongo();
}

async function connectDatabase(uri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const target = uri || (await resolveMongoUri());
  await mongoose.connect(target, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
    memoryServer = null;
  }
}

function dbStatus() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}

module.exports = {
  mongoose,
  getDb,
  connectDatabase,
  disconnectDatabase,
  resolveMongoUri,
  ensureDevMongo,
  dbStatus,
  DEV_DB_PORT,
};
