/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/auth.js – JWT authentication, role guard and internal service token checks
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const ApiError = require('./ApiError');

const ROLES = Object.freeze(['admin', 'fleet_manager', 'driver']);
const INTERNAL_HEADER = 'x-internal-token';

/** Create a signed JWT. Claims: sub (user id), role, name, email, iat, exp. */
function signToken(user, options = {}) {
  return jwt.sign(
    { sub: String(user._id || user.id), role: user.role, name: user.name, email: user.email },
    config.jwtSecret(),
    { expiresIn: options.expiresIn || config.jwtExpiresIn() }
  );
}

/** Verify a JWT and map jsonwebtoken errors onto our error codes. */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret());
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token has expired', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Token is invalid', 'TOKEN_INVALID');
  }
}

/** Constant-time comparison so the internal token cannot be guessed by timing. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function isInternalRequest(req) {
  const token = req.headers[INTERNAL_HEADER];
  return Boolean(token) && safeEqual(token, config.internalToken());
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!header) throw ApiError.unauthorized('Authorization header with Bearer token is required', 'TOKEN_MISSING');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authorization header must be "Bearer <token>"', 'TOKEN_INVALID');
  }
  return token;
}

/** Requires a valid JWT. Sets req.user = { id, role, name, email }. */
function authenticate(req, _res, next) {
  try {
    const claims = verifyToken(readBearer(req));
    req.user = { id: claims.sub, role: claims.role, name: claims.name, email: claims.email };
    req.token = claims;
    next();
  } catch (err) {
    next(err);
  }
}

/** Accepts either a service-to-service token or a user JWT. */
function authenticateOrInternal(req, res, next) {
  if (isInternalRequest(req)) {
    req.internal = true;
    req.user = { id: 'system', role: 'system', name: 'internal-service' };
    return next();
  }
  return authenticate(req, res, next);
}

/** Only service-to-service calls (x-internal-token) may pass. */
function internalOnly(req, _res, next) {
  if (!req.headers[INTERNAL_HEADER]) {
    return next(ApiError.unauthorized('Internal service token required', 'INTERNAL_TOKEN_MISSING'));
  }
  if (!isInternalRequest(req)) {
    return next(ApiError.forbidden('Internal service token is invalid', 'INTERNAL_TOKEN_INVALID'));
  }
  req.internal = true;
  return next();
}

/**
 * Role-based access control. Must run after authenticate().
 * Internal service calls are trusted and always allowed.
 */
function requireRole(...allowed) {
  return (req, _res, next) => {
    if (req.internal) return next();
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not allowed. Required: ${allowed.join(', ')}`,
          'INSUFFICIENT_ROLE'
        )
      );
    }
    return next();
  };
}

module.exports = {
  ROLES,
  INTERNAL_HEADER,
  signToken,
  verifyToken,
  authenticate,
  authenticateOrInternal,
  internalOnly,
  requireRole,
  isInternalRequest,
};
