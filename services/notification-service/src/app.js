/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/app.js – Notification Service Express app (exported for tests)
 */
const { createServiceApp } = require('@fleet/shared');
const router = require('./routes');

module.exports = createServiceApp({ name: 'notification-service', mountPath: '/notifications', router });
