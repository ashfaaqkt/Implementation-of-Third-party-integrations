/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : scripts/dev.js – `npm run dev`: starts MongoDB (if needed), the 5 services and the gateway
 */
const path = require('path');
const concurrentlyModule = require('concurrently');
const { config, ensureDevMongo } = require('@fleet/shared');

const concurrently = concurrentlyModule.concurrently || concurrentlyModule.default || concurrentlyModule;
const root = path.resolve(__dirname, '..');

const PROCESSES = [
  { name: 'users', command: 'node services/user-service/src/server.js', prefixColor: 'cyan' },
  { name: 'vehicles', command: 'node services/vehicle-service/src/server.js', prefixColor: 'green' },
  { name: 'telemetry', command: 'node services/telemetry-service/src/server.js', prefixColor: 'magenta' },
  { name: 'geo', command: 'node services/geo-service/src/server.js', prefixColor: 'blue' },
  { name: 'notify', command: 'node services/notification-service/src/server.js', prefixColor: 'yellow' },
  { name: 'gateway', command: 'node gateway/src/server.js', prefixColor: 'white.bold' },
];

async function main() {
  // One shared MongoDB for all services: the configured MONGO_URI, or the
  // zero-setup local database (mongodb-memory-server) kept alive by this process.
  let mongoUri = config.mongoUri();
  if (!mongoUri) {
    mongoUri = await ensureDevMongo();
    console.log(`🗄️  MONGO_URI not set – using local dev database at ${mongoUri}`);
  }

  const { result } = concurrently(
    PROCESSES.map((p) => ({ ...p, env: { MONGO_URI: mongoUri } })),
    { cwd: root, prefix: 'name', restartTries: 0 }
  );

  const shutdown = () => process.exit(0);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await result.catch(() => {});
}

main().catch((err) => {
  console.error('Failed to start dev environment:', err);
  process.exit(1);
});
