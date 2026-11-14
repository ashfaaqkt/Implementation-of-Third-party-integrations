/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/server.js – starts the Geolocation Service
 */
const { config, startService } = require('@fleet/shared');
const app = require('./app');

startService(app, { name: 'geo-service', port: config.servicePort('geo') }).catch((err) => {
  console.error('geo-service failed to start:', err);
  process.exit(1);
});
