/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/maps.docs.js – OpenAPI annotations for /api/maps/*
 */

/**
 * @openapi
 * /api/maps/geocode:
 *   get:
 *     tags: [Maps]
 *     summary: Address → latitude/longitude
 *     description: |
 *       **Roles:** admin, fleet_manager, driver.
 *       Uses OpenStreetMap **Nominatim** by default (`GEO_PROVIDER=google` switches to
 *       Google Maps). Results are cached in MongoDB for 30 days to respect Nominatim's
 *       usage policy (`cached: true` on repeat lookups).
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: address, in: query, required: true, schema: { type: string, minLength: 3 }, example: 'MG Road, Kochi' }
 *     responses:
 *       200:
 *         description: Coordinates
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/GeoResult' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       502: { $ref: '#/components/responses/BadGateway' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/maps/reverse:
 *   get:
 *     tags: [Maps]
 *     summary: Latitude/longitude → address
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: lat, in: query, required: true, schema: { type: number }, example: 9.9658 }
 *       - { name: lng, in: query, required: true, schema: { type: number }, example: 76.2856 }
 *     responses:
 *       200:
 *         description: Address
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReverseGeoResult' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       502: { $ref: '#/components/responses/BadGateway' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/maps/nearby:
 *   get:
 *     tags: [Maps]
 *     summary: Nearby vehicles around coordinates or an address
 *     description: |
 *       **Roles:** admin, fleet_manager, driver.
 *       Give `lat` + `lng`, **or** an `address` (geocoded first). The Geolocation
 *       Service then joins with the Vehicle Service's `$geoNear` search.
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: lat, in: query, schema: { type: number }, example: 9.9658 }
 *       - { name: lng, in: query, schema: { type: number }, example: 76.2856 }
 *       - { name: address, in: query, schema: { type: string }, example: 'Vyttila, Kochi' }
 *       - { name: radiusKm, in: query, schema: { type: number, default: 5 } }
 *       - { name: status, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Nearby vehicles (sorted by distance)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NearbyResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       502: { $ref: '#/components/responses/BadGateway' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/maps/distance:
 *   get:
 *     tags: [Maps]
 *     summary: Distance between two points (haversine)
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: from, in: query, required: true, schema: { type: string }, example: '9.9658,76.2856' }
 *       - { name: to, in: query, required: true, schema: { type: string }, example: '10.0159,76.3419' }
 *     responses:
 *       200:
 *         description: Distance
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DistanceResult' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 */
module.exports = {};
