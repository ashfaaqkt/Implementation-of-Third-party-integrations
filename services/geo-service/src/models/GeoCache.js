/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/models/GeoCache.js – cached geocoding results (TTL 30 days)
 */
const { mongoose, getDb } = require('@fleet/shared');

const geoCacheSchema = new mongoose.Schema({
  // normalised address text + provider name, e.g. "nominatim|mg road, kochi"
  key: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  query: { type: String, required: true },
  lat: Number,
  lng: Number,
  displayName: String,
  hits: { type: Number, default: 0 },
  // TTL index: MongoDB deletes cached entries 30 days after creation.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = getDb('fleet_geo').model('GeoCache', geoCacheSchema);
