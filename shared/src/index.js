/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/index.js – public exports of the shared package
 */
const config = require('./config');
const ApiError = require('./ApiError');
const auth = require('./auth');
const db = require('./db');
const validation = require('./validate');
const errors = require('./errorHandler');
const { createLogger } = require('./logger');
const { callService, SERVICE_LABELS } = require('./serviceClient');
const { createServiceApp, startService } = require('./serviceApp');

/** Wraps async route handlers so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  config,
  ApiError,
  ...auth,
  ...db,
  ...validation,
  ...errors,
  createLogger,
  callService,
  SERVICE_LABELS,
  createServiceApp,
  startService,
  asyncHandler,
};
