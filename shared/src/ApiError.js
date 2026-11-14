/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/ApiError.js – error class producing the common JSON error shape
 */

/**
 * Every error response in the system has the same shape:
 *   { "error": { "code": "VEHICLE_NOT_FOUND", "message": "...", "details": [...] } }
 */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const body = { error: { code: this.code, message: this.message } };
    if (this.details !== undefined) body.error.details = this.details;
    return body;
  }

  static badRequest(message, details, code = 'INVALID_REQUEST') {
    return new ApiError(400, code, message, details);
  }

  static validation(details) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Resource not found') {
    return new ApiError(404, code, message);
  }

  static conflict(code, message, details) {
    return new ApiError(409, code, message, details);
  }

  static badGateway(message, details) {
    return new ApiError(502, 'UPSTREAM_PROVIDER_ERROR', message, details);
  }

  static unavailable(service, message) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message || `${service} is unavailable`, { service });
  }
}

module.exports = ApiError;
