/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/serviceClient.js – HTTP client for service-to-service calls
 */
const axios = require('axios');
const config = require('./config');
const ApiError = require('./ApiError');
const { INTERNAL_HEADER } = require('./auth');

const SERVICE_LABELS = {
  user: 'user-service',
  vehicle: 'vehicle-service',
  telemetry: 'telemetry-service',
  geo: 'geo-service',
  notification: 'notification-service',
};

/**
 * callService('geo', { method: 'GET', url: '/maps/geocode', params: {...} })
 * - Adds the x-internal-token header so the target trusts the call.
 * - Network failures / timeouts → ApiError 503 SERVICE_UNAVAILABLE.
 * - Error responses from the target are re-thrown with the same status + code.
 */
async function callService(service, { method = 'GET', url, data, params, headers = {}, timeout = 5000, requestId } = {}) {
  const label = SERVICE_LABELS[service] || service;
  try {
    const res = await axios({
      method,
      baseURL: config.serviceUrl(service),
      url,
      data,
      params,
      timeout,
      headers: {
        [INTERNAL_HEADER]: config.internalToken(),
        ...(requestId ? { 'x-request-id': requestId } : {}),
        ...headers,
      },
    });
    return res.data;
  } catch (err) {
    if (err.response) {
      const body = err.response.data && err.response.data.error;
      throw new ApiError(
        err.response.status,
        (body && body.code) || 'UPSTREAM_ERROR',
        (body && body.message) || `${label} responded with ${err.response.status}`,
        body && body.details
      );
    }
    throw ApiError.unavailable(label, `${label} is unavailable (${err.code || err.message})`);
  }
}

module.exports = { callService, SERVICE_LABELS };
