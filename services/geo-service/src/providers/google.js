/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/providers/google.js – Google Maps Geocoding API provider
 */
const axios = require('axios');
const { ApiError } = require('@fleet/shared');

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

async function request(params) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw ApiError.badGateway('GOOGLE_MAPS_API_KEY is not configured', { provider: 'google' });
  }
  let data;
  try {
    ({ data } = await axios.get(ENDPOINT, { params: { ...params, key }, timeout: 8000 }));
  } catch (err) {
    throw ApiError.badGateway('Geolocation provider (Google Maps) request failed', {
      provider: 'google',
      status: err.response ? err.response.status : err.code,
    });
  }
  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK') {
    throw ApiError.badGateway(`Google Maps returned ${data.status}`, { provider: 'google', status: data.status });
  }
  return data.results;
}

module.exports = {
  name: 'google',

  async geocode(address) {
    const [hit] = await request({ address });
    if (!hit) return null;
    return { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, displayName: hit.formatted_address };
  },

  async reverse(lat, lng) {
    const [hit] = await request({ latlng: `${lat},${lng}` });
    if (!hit) return null;
    return { displayName: hit.formatted_address, address: { components: hit.address_components } };
  },
};
