/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/middleware/apiKey.js – x-api-key verification for every /api/* request
 */
const { ApiError } = require('@fleet/shared');

/**
 * Missing key → 401 API_KEY_MISSING, unknown key → 403 API_KEY_INVALID.
 * A valid key is attached as req.apiKey = { key, tier, name } (used by the rate limiter).
 */
function apiKeyAuth(apiKeys) {
  return (req, _res, next) => {
    const key = req.headers['x-api-key'];
    if (!key) {
      return next(ApiError.unauthorized('API key is required in the x-api-key header', 'API_KEY_MISSING'));
    }
    const client = apiKeys.get(String(key));
    if (!client) {
      return next(ApiError.forbidden('API key is invalid', 'API_KEY_INVALID'));
    }
    req.apiKey = client;
    return next();
  };
}

module.exports = { apiKeyAuth };
