/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/geo-service/src/routes.js – geocode, reverse geocode, nearby search and distance
 */
const express = require('express');
const {
  ApiError,
  Joi,
  validate,
  latitude,
  longitude,
  asyncHandler,
  authenticateOrInternal,
  callService,
} = require('@fleet/shared');
const { getProvider } = require('./providers');
const { haversineKm } = require('./haversine');
const GeoCache = require('./models/GeoCache');

const router = express.Router();
router.use(authenticateOrInternal);

const normalise = (address) => address.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Geocode with a MongoDB cache in front of the provider (Nominatim asks
 * clients not to repeat identical queries). Returns { lat, lng, displayName, provider, cached }.
 */
async function geocodeAddress(address) {
  const provider = getProvider();
  const key = `${provider.name}|${normalise(address)}`;

  const cached = await GeoCache.findOneAndUpdate({ key }, { $inc: { hits: 1 } }, { new: true });
  if (cached) {
    return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName, provider: provider.name, cached: true };
  }

  const result = await provider.geocode(address);
  if (!result) throw ApiError.notFound('ADDRESS_NOT_FOUND', `No location found for address '${address}'`);

  await GeoCache.updateOne(
    { key },
    { $setOnInsert: { key, provider: provider.name, query: address, ...result } },
    { upsert: true }
  );
  return { ...result, provider: provider.name, cached: false };
}

/** "lat,lng" → { lat, lng } (Joi custom validator) */
const latLngString = () =>
  Joi.string()
    .pattern(/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/)
    .message("must be 'lat,lng', e.g. 9.9658,76.2856")
    .custom((value, helpers) => {
      const [lat, lng] = value.split(',').map(Number);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return helpers.message('coordinates are out of range');
      return { lat, lng };
    });

/** GET /maps/geocode?address=MG Road, Kochi */
router.get(
  '/geocode',
  validate(Joi.object({ address: Joi.string().trim().min(3).max(300).required() }), 'query'),
  asyncHandler(async (req, res) => {
    res.json(await geocodeAddress(req.query.address));
  })
);

/** GET /maps/reverse?lat=9.9658&lng=76.2856 */
router.get(
  '/reverse',
  validate(Joi.object({ lat: latitude().required(), lng: longitude().required() }), 'query'),
  asyncHandler(async (req, res) => {
    const provider = getProvider();
    const result = await provider.reverse(req.query.lat, req.query.lng);
    if (!result) throw ApiError.notFound('ADDRESS_NOT_FOUND', 'No address found for these coordinates');
    res.json({ lat: req.query.lat, lng: req.query.lng, ...result, provider: provider.name });
  })
);

/**
 * GET /maps/nearby?lat=&lng=&radiusKm=   (or ?address=...&radiusKm=)
 * Resolves the centre (geocoding an address if needed), then joins with the
 * Vehicle Service's $geoNear search.
 */
router.get(
  '/nearby',
  validate(
    Joi.object({
      lat: latitude(),
      lng: longitude(),
      address: Joi.string().trim().min(3).max(300),
      radiusKm: Joi.number().positive().max(500).default(5),
      status: Joi.string(),
      limit: Joi.number().integer().min(1).max(200).default(50),
    })
      .and('lat', 'lng')
      .or('lat', 'address'),
    'query'
  ),
  asyncHandler(async (req, res) => {
    let center;
    if (req.query.lat !== undefined) {
      center = { lat: req.query.lat, lng: req.query.lng };
    } else {
      const geo = await geocodeAddress(req.query.address);
      center = { lat: geo.lat, lng: geo.lng, displayName: geo.displayName };
    }
    const { radiusKm, status, limit } = req.query;
    const result = await callService('vehicle', {
      url: '/vehicles/nearby',
      params: { lat: center.lat, lng: center.lng, radiusKm, status, limit },
      requestId: req.headers['x-request-id'],
    });
    res.json({ ...result, center: { ...result.center, ...center } });
  })
);

/** GET /maps/distance?from=9.9658,76.2856&to=10.0159,76.3419 → haversine km */
router.get(
  '/distance',
  validate(Joi.object({ from: latLngString().required(), to: latLngString().required() }), 'query'),
  (req, res) => {
    const { from, to } = req.query;
    const km = haversineKm(from, to);
    res.json({ from, to, distanceKm: Math.round(km * 1000) / 1000, distanceMeters: Math.round(km * 1000), method: 'haversine' });
  }
);

module.exports = router;
module.exports.geocodeAddress = geocodeAddress;
