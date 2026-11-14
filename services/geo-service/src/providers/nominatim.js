/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/providers/nominatim.js – OpenStreetMap Nominatim geocoding provider
 */
const axios = require('axios');
const { ApiError } = require('@fleet/shared');

const baseUrl = () => (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const userAgent = () => process.env.NOMINATIM_USER_AGENT || 'FleetManagementSystem/1.0 (BITS Pilani student project)';

/**
 * Nominatim's usage policy allows at most 1 request per second and requires an
 * identifying User-Agent. Requests are chained so they never overlap and are
 * spaced at least `minGapMs` apart. (Results are also cached in MongoDB.)
 */
let queue = Promise.resolve();
let lastCallAt = 0;
function throttled(fn, minGapMs = 1000) {
  const run = queue.then(async () => {
    const wait = lastCallAt + minGapMs - Date.now();
    if (wait > 0 && process.env.NODE_ENV !== 'test') await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function request(path, params) {
  try {
    const { data } = await throttled(() =>
      axios.get(`${baseUrl()}${path}`, {
        params: { format: 'jsonv2', ...params },
        headers: { 'User-Agent': userAgent(), 'Accept-Language': 'en' },
        timeout: 8000,
      })
    );
    return data;
  } catch (err) {
    const status = err.response ? err.response.status : err.code || 'NETWORK_ERROR';
    throw ApiError.badGateway('Geolocation provider (Nominatim) request failed', { provider: 'nominatim', status });
  }
}

module.exports = {
  name: 'nominatim',

  /** Address → { lat, lng, displayName } or null when nothing matches. */
  async geocode(address) {
    const results = await request('/search', { q: address, limit: 1 });
    if (!Array.isArray(results) || results.length === 0) return null;
    const [hit] = results;
    return { lat: Number(hit.lat), lng: Number(hit.lon), displayName: hit.display_name };
  },

  /** Coordinates → { address, displayName } or null. */
  async reverse(lat, lng) {
    const data = await request('/reverse', { lat, lon: lng });
    if (!data || data.error) return null;
    return { displayName: data.display_name, address: data.address || {} };
  },
};
