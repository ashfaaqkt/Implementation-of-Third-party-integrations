/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/vehicle-service/src/server.js – starts the Vehicle/Fleet Service
 */
const { config, startService } = require('@fleet/shared');
const app = require('./app');

startService(app, { name: 'vehicle-service', port: config.servicePort('vehicle') }).catch((err) => {
  console.error('vehicle-service failed to start:', err);
  process.exit(1);
});
