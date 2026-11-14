/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/errorHandler.js – 404 handler and central error → JSON mapper
 */
const ApiError = require('./ApiError');
const { createLogger } = require('./logger');

function notFoundHandler(code = 'ROUTE_NOT_FOUND') {
  return (req, _res, next) => next(ApiError.notFound(code, `Route ${req.method} ${req.originalUrl} not found`));
}

/** Convert any thrown error into the shared { error: { code, message, details } } shape. */
function toApiError(err) {
  if (err instanceof ApiError) return err;

  // body-parser errors (malformed JSON, payload too large)
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_REQUEST', 'Malformed JSON in request body');
  }
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${err.limit} byte limit`);
  }

  // Mongoose errors
  if (err.name === 'ValidationError' && err.errors) {
    return ApiError.validation(
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    );
  }
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for '${err.path}'`, undefined, 'INVALID_ID');
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || err.keyPattern || {});
    return ApiError.conflict('DUPLICATE_KEY', `A record with this ${fields.join(', ') || 'key'} already exists`, err.keyValue);
  }

  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

function errorHandler(serviceName = 'service') {
  const log = createLogger(serviceName);
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const apiError = toApiError(err);
    if (apiError.status >= 500) log.error(`${req.method} ${req.originalUrl} →`, err.stack || err.message);
    if (res.headersSent) return;
    res.status(apiError.status).json(apiError.toJSON());
  };
}

module.exports = { notFoundHandler, errorHandler, toApiError };
