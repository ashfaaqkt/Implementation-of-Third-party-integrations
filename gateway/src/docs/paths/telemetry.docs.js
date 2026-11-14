/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/paths/telemetry.docs.js – OpenAPI annotations for /api/telemetry/*
 */

/**
 * @openapi
 * /api/telemetry:
 *   post:
 *     tags: [Telemetry]
 *     summary: Submit a GPS / sensor reading from a vehicle
 *     description: |
 *       **Roles:** admin, fleet_manager, driver.
 *       1. Stores the reading (GPS as a GeoJSON Point).
 *       2. Updates the vehicle's current location in the Vehicle Service.
 *       3. Critical events – `ENGINE_FAULT`, `LOW_BATTERY`, `EMERGENCY_STOP` – sent explicitly
 *          as `eventType` or auto-detected (battery < 11.5 V, engine > 110 °C) trigger an
 *          SMS to **all admins**.
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TelemetryInput' }
 *           examples:
 *             normal:
 *               summary: Normal reading
 *               value: { vehicleId: 665f1c2e8b3a4d0012345678, lat: 9.9816, lng: 76.2999, speed: 42, fuelLevel: 63, batteryVoltage: 12.6, engineTemp: 88 }
 *             lowBattery:
 *               summary: Critical – low battery (auto-detected)
 *               value: { vehicleId: 665f1c2e8b3a4d0012345678, lat: 9.9816, lng: 76.2999, speed: 0, fuelLevel: 40, batteryVoltage: 11.1, engineTemp: 85 }
 *             emergencyStop:
 *               summary: Critical – explicit emergency stop
 *               value: { vehicleId: 665f1c2e8b3a4d0012345678, lat: 9.9816, lng: 76.2999, speed: 0, eventType: EMERGENCY_STOP }
 *     responses:
 *       201:
 *         description: Reading stored (critical events also notified)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TelemetryResponse' }
 *             example:
 *               telemetry: { id: 665f20aa8b3a4d0012349999, vehicleId: 665f1c2e8b3a4d0012345678, lat: 9.9816, lng: 76.2999, batteryVoltage: 11.1, critical: true, locationSynced: true }
 *               critical:
 *                 detected: true
 *                 events: [{ event: LOW_BATTERY, detectedBy: threshold, detail: 'Battery 11.1V < 11.5V' }]
 *                 notifications: { count: 1, sent: 1, failed: 0 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/telemetry/{vehicleId}:
 *   get:
 *     tags: [Telemetry]
 *     summary: Telemetry history for a vehicle (paginated, newest first)
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: vehicleId, in: path, required: true, schema: { type: string, pattern: '^[a-f0-9]{24}$' } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: from, in: query, schema: { type: string, format: date-time } }
 *       - { name: to, in: query, schema: { type: string, format: date-time } }
 *       - { name: critical, in: query, schema: { type: boolean } }
 *     responses:
 *       200:
 *         description: History
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TelemetryList' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 * /api/telemetry/{vehicleId}/latest:
 *   get:
 *     tags: [Telemetry]
 *     summary: Latest reading for a vehicle
 *     description: "**Roles:** admin, fleet_manager, driver."
 *     x-roles: [admin, fleet_manager, driver]
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - { name: vehicleId, in: path, required: true, schema: { type: string, pattern: '^[a-f0-9]{24}$' } }
 *     responses:
 *       200:
 *         description: Latest reading
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 telemetry: { $ref: '#/components/schemas/Telemetry' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/ServiceUnavailable' }
 */
module.exports = {};
