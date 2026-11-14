/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : scripts/start-all.js – `npm run start:all`: every service + gateway in ONE process (fits one free Render web service)
 */
const { config, connectDatabase, createLogger } = require('@fleet/shared');

const log = createLogger('start-all');

const SERVICES = [
  { key: 'user', name: 'user-service', app: () => require('../services/user-service/src/app') },
  { key: 'vehicle', name: 'vehicle-service', app: () => require('../services/vehicle-service/src/app') },
  { key: 'telemetry', name: 'telemetry-service', app: () => require('../services/telemetry-service/src/app') },
  { key: 'geo', name: 'geo-service', app: () => require('../services/geo-service/src/app') },
  { key: 'notification', name: 'notification-service', app: () => require('../services/notification-service/src/app') },
];

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });
}

async function main() {
  await connectDatabase();

  // Services listen on localhost only – the gateway (public PORT) is the single entry point.
  for (const svc of SERVICES) {
    const port = config.servicePort(svc.key);
    // eslint-disable-next-line no-await-in-loop
    await listen(svc.app(), port, '127.0.0.1');
    // In one process every service is local – always use the IPv4 loopback
    // (avoids "localhost" resolving to ::1 where nothing listens).
    process.env[`${svc.key.toUpperCase()}_SERVICE_URL`] = `http://127.0.0.1:${port}`;
    log.raw(`✅ ${svc.name} started on port ${port} – by ${config.AUTHOR.developedBy}`);
  }

  // eslint-disable-next-line global-require
  const { startGateway } = require('../gateway/src/server');
  await startGateway();
}

main().catch((err) => {
  console.error('start:all failed:', err);
  process.exit(1);
});
