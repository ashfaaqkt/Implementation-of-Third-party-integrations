/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/providers/index.js – selects the geocoding provider (GEO_PROVIDER) and optional fallback
 */
const { createLogger } = require('@fleet/shared');
const nominatim = require('./nominatim');
const google = require('./google');
const mock = require('./mock');

const PROVIDERS = { nominatim, google, mock };

/**
 * Provider interface (every provider implements both):
 *   geocode(address)  → Promise<{ lat, lng, displayName } | null>
 *   reverse(lat, lng) → Promise<{ displayName, address } | null>
 * Switch with GEO_PROVIDER=nominatim | google | mock (read per call).
 */
function getProvider() {
  const name = (process.env.GEO_PROVIDER || 'nominatim').toLowerCase();
  return PROVIDERS[name] || nominatim;
}

/** Optional second provider (GEO_FALLBACK_PROVIDER), used only when the primary one fails. */
function getFallbackProvider() {
  const name = (process.env.GEO_FALLBACK_PROVIDER || '').toLowerCase();
  return PROVIDERS[name] || null;
}

const log = createLogger('geo-service');

/**
 * Calls provider[method](...args) on the primary provider. If that provider is
 * unreachable or refuses the request (502 UPSTREAM_PROVIDER_ERROR – e.g. Nominatim
 * answering 429 to a shared cloud IP) and a different GEO_FALLBACK_PROVIDER is
 * configured, the call is retried there and the response says so explicitly:
 *   { result, provider, fallbackFrom?, fallbackReason? }
 * "Not found" (null) is a valid answer and never triggers the fallback.
 */
async function callWithFallback(method, ...args) {
  const primary = getProvider();
  try {
    return { result: await primary[method](...args), provider: primary.name };
  } catch (err) {
    const fallback = getFallbackProvider();
    if (!fallback || fallback === primary || err.status !== 502) throw err;
    const reason = err.details && err.details.status !== undefined ? err.details.status : err.code;
    log.warn(`${primary.name} failed (${reason}) – using fallback provider '${fallback.name}'`);
    return { result: await fallback[method](...args), provider: fallback.name, fallbackFrom: primary.name, fallbackReason: reason };
  }
}

module.exports = { getProvider, getFallbackProvider, callWithFallback, PROVIDERS };
