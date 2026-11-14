/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/vehicles.docs.js – OpenAPI annotations for /api/vehicles/*
 */

/**
 * @openapi
 * /api/vehicles:
 *   post:
 *     tags: [Vehicles]
 *     summary: Register a vehicle (address is geocoded automatically)
 *     description: |
 *       **Roles:** admin, fleet_manager.
 *       If `address` is given without `location`, the Vehicle Service calls the
 *       Geolocation Service (OpenStreetMap Nominatim) and stores the returned
 *       coordinates as a GeoJSON Point. If the provider is down, the vehicle is
 *       still created and `geocoding.status` is `failed`.
 *     x-roles: [admin, fleet_manager]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VehicleInput' }
 *           examples:
 *             byAddress:
 *               summary: Register by address (geocoded)
 *               value: { registrationNumber: KL-07-AB-1234, make: Tata, model: Ace Gold, type: truck, address: 'MG Road, Kochi' }
 *             byCoordinates:
 *               summary: Register with coordinates
 *               value: { registrationNumber: KL-11-CD-5678, make: Ashok Leyland, model: Dost, type: van, location: { lat: 11.2588, lng: 75.7804 } }
 *     responses:
 *       201:
 *         description: Vehicle registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *             example:
 *               vehicle:
 *                 id: 665f1c2e8b3a4d0012345678
 *                 registrationNumber: KL-07-AB-1234
 *                 make: Tata
 *                 model: Ace Gold
 *                 type: truck
 *                 address: MG Road, Kochi
 *                 location: { type: Point, coordinates: [76.2856, 9.9658] }
 *                 position: { lat: 9.9658, lng: 76.2856 }
 *                 locationSource: geocoded
 *                 status: active
 *               geocoding: { status: success, lat: 9.9658, lng: 76.2856, displayName: 'MG Road, Ernakulam, Kochi, Kerala, India', provider: nominatim, cached: false }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 *   get:
 *     tags: [Vehicles]
 *     summary: List vehicles
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [active, idle, maintenance, offline, emergency] } }
 *       - { name: type, in: query, schema: { type: string, enum: [truck, van, car, bus, bike, other] } }
 *       - { name: driverId, in: query, schema: { type: string } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: Paginated list of vehicles
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleList' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/vehicles/nearby:
 *   get:
 *     tags: [Vehicles]
 *     summary: Vehicles within X km of a point (sorted by distance)
 *     description: |
 *       **Roles:** admin, fleet_manager, driver.
 *       Uses MongoDB `$geoNear` on a `2dsphere` index. Results are sorted
 *       nearest-first and include `distanceKm`.
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: lat, in: query, required: true, schema: { type: number, minimum: -90, maximum: 90 }, example: 9.9658 }
 *       - { name: lng, in: query, required: true, schema: { type: number, minimum: -180, maximum: 180 }, example: 76.2856 }
 *       - { name: radiusKm, in: query, schema: { type: number, default: 5, maximum: 500 }, example: 5 }
 *       - { name: status, in: query, schema: { type: string, enum: [active, idle, maintenance, offline, emergency] } }
 *       - { name: limit, in: query, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200:
 *         description: Nearby vehicles
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/NearbyResponse' }
 *             example:
 *               center: { lat: 9.9658, lng: 76.2856 }
 *               radiusKm: 5
 *               count: 2
 *               data:
 *                 - { id: 665f1c2e8b3a4d0012345678, registrationNumber: KL-07-AB-1234, status: active, position: { lat: 9.9658, lng: 76.2856 }, distanceKm: 0 }
 *                 - { id: 665f1c2e8b3a4d0012345679, registrationNumber: KL-07-EF-1001, status: idle, position: { lat: 9.9674, lng: 76.3185 }, distanceKm: 3.611 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/vehicles/{id}:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get a vehicle (with status history)
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/VehicleId'
 *     responses:
 *       200:
 *         description: Vehicle
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 *   put:
 *     tags: [Vehicles]
 *     summary: Update vehicle details
 *     description: "**Roles:** admin, fleet_manager. A new `address` is geocoded again."
 *     x-roles: [admin, fleet_manager]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/VehicleId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VehicleUpdate' }
 *           example: { model: Ace Gold CNG, address: 'Kakkanad, Kochi' }
 *     responses:
 *       200:
 *         description: Updated vehicle
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 *   delete:
 *     tags: [Vehicles]
 *     summary: Delete a vehicle
 *     description: |
 *       **Roles:** admin only. A `fleet_manager` or `driver` gets **403 INSUFFICIENT_ROLE**;
 *       no token gets **401 TOKEN_MISSING**.
 *     x-roles: [admin]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/VehicleId'
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             example: { deleted: true, id: 665f1c2e8b3a4d0012345678, registrationNumber: KL-07-AB-1234 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/vehicles/{id}/status:
 *   patch:
 *     tags: [Vehicles]
 *     summary: Change operational status (sends SMS notifications)
 *     description: |
 *       **Roles:** admin, fleet_manager, driver (drivers only for their assigned vehicle).
 *       Stores a status-history entry and SMSes all admins, fleet managers and the
 *       assigned driver via the Notification Service. Setting the same status again
 *       returns `changed: false` and sends nothing.
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/VehicleId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StatusUpdate' }
 *           example: { status: maintenance, reason: Brake inspection }
 *     responses:
 *       200:
 *         description: Status updated and notifications triggered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StatusUpdateResponse' }
 *             example:
 *               changed: true
 *               previousStatus: active
 *               vehicle: { id: 665f1c2e8b3a4d0012345678, registrationNumber: KL-07-AB-1234, status: maintenance }
 *               notifications: { count: 3, sent: 3, failed: 0, ids: [665f22bb8b3a4d001234aaaa] }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 */
module.exports = {};
