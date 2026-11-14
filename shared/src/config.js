/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/config.js – loads .env and exposes configuration getters
 */
const path = require('path');

// Load the single root-level .env file once (services, gateway, scripts share it).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const AUTHOR = Object.freeze({
  project: 'Fleet Management System – Third-party Integrations, API Gateway',
  author: 'Ashfaaq Feroz Muhammad',
  bitsId: '2023EBCS005',
  course: 'Backend and API Development – BITS Pilani',
  developedBy: 'Ashfaaq Feroz Muhammad (2023EBCS005)',
});

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== undefined ? n : fallback;
};

const DEFAULT_PORTS = {
  user: 4001,
  vehicle: 4002,
  telemetry: 4003,
  geo: 4004,
  notification: 4005,
};

/**
 * Values are read from process.env on every call (not cached) so tests can
 * point services at ephemeral ports by changing env vars at runtime.
 */
const config = {
  AUTHOR,
  env: () => process.env.NODE_ENV || 'development',
  jwtSecret: () => process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret',
  jwtExpiresIn: () => process.env.JWT_EXPIRES_IN || '1h',
  internalToken: () => process.env.INTERNAL_SERVICE_TOKEN || 'dev-only-internal-token',
  mongoUri: () => process.env.MONGO_URI || '',
  logLevel: () => process.env.LOG_LEVEL || 'info',
  num,

  /** Port a service listens on, e.g. servicePort('vehicle') → 4002 */
  servicePort(name) {
    return num(process.env[`${name.toUpperCase()}_SERVICE_PORT`], DEFAULT_PORTS[name]);
  },

  /** Base URL used to call another service, e.g. serviceUrl('geo') */
  serviceUrl(name) {
    return (
      process.env[`${name.toUpperCase()}_SERVICE_URL`] ||
      `http://localhost:${config.servicePort(name)}`
    ).replace(/\/+$/, '');
  },
};

module.exports = config;
