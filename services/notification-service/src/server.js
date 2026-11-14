/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/server.js – starts the Notification Service
 */
const { config, startService } = require('@fleet/shared');
const app = require('./app');

startService(app, { name: 'notification-service', port: config.servicePort('notification') }).catch((err) => {
  console.error('notification-service failed to start:', err);
  process.exit(1);
});
