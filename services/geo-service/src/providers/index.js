/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/providers/index.js – selects the geocoding provider from GEO_PROVIDER
 */
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

module.exports = { getProvider, PROVIDERS };
