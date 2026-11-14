/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/haversine.js – great-circle distance between two coordinates
 */
// MongoDB's spherical geometry ($geoNear on GeoJSON) uses an Earth radius of 6378.1 km.
// Using the same value keeps /maps/distance and the nearby search's distanceKm identical.
const EARTH_RADIUS_KM = 6378.1;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Haversine formula: distance in km between { lat, lng } points. */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

module.exports = { haversineKm, EARTH_RADIUS_KM };
