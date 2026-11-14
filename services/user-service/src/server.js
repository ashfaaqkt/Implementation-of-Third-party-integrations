/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/user-service/src/server.js – starts the User Service
 */
const { config, startService } = require('@fleet/shared');
const app = require('./app');

startService(app, { name: 'user-service', port: config.servicePort('user') }).catch((err) => {
  console.error('user-service failed to start:', err);
  process.exit(1);
});
