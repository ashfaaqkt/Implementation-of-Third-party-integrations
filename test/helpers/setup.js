/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/helpers/setup.js – Mocha root hooks: in-memory MongoDB, all services on random ports, no real network
 */

// --- Test environment (must be set BEFORE any project module is loaded) ----
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-jwt-secret',
  JWT_EXPIRES_IN: '1h',
  INTERNAL_SERVICE_TOKEN: 'test-internal-token',
  API_KEYS: 'devkey123:standard,partnerkey456:premium,demokey789:demo',
  GEO_PROVIDER: 'mock',
  NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
  SMS_PROVIDER: 'stub',
  SMS_STUB_FAIL_RATE: '0',
  LOW_BATTERY_VOLTAGE: '11.5',
  ENGINE_TEMP_MAX: '110',
  RATE_LIMIT_MAX: '1000',
  MONGO_URI: '',
});

const nock = require('nock');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('@fleet/shared');

const SERVICES = {
  user: require('../../services/user-service/src/app'),
  vehicle: require('../../services/vehicle-service/src/app'),
  telemetry: require('../../services/telemetry-service/src/app'),
  geo: require('../../services/geo-service/src/app'),
  notification: require('../../services/notification-service/src/app'),
};

let mongo;
const servers = [];

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

exports.mochaHooks = {
  async beforeAll() {
    this.timeout(120000);

    // Tests must never touch the real internet (Nominatim, Google, Twilio).
    nock.disableNetConnect();
    nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);

    mongo = await MongoMemoryServer.create();
    await connectDatabase(mongo.getUri());

    // Every service runs for real on a random port so service-to-service
    // HTTP calls (vehicle → geo, telemetry → notification, ...) are exercised.
    for (const [key, app] of Object.entries(SERVICES)) {
      // eslint-disable-next-line no-await-in-loop
      const server = await listen(app);
      servers.push(server);
      process.env[`${key.toUpperCase()}_SERVICE_URL`] = `http://127.0.0.1:${server.address().port}`;
    }
  },

  afterEach() {
    nock.cleanAll();
  },

  async afterAll() {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    await disconnectDatabase();
    if (mongo) await mongo.stop();
    nock.enableNetConnect();
  },
};

exports.SERVICES = SERVICES;
