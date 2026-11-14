/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/telemetry-service/src/routes.js – telemetry ingestion, critical-event SMS, history
 */
const express = require('express');
const {
  ApiError,
  Joi,
  validate,
  objectId,
  latitude,
  longitude,
  asyncHandler,
  authenticateOrInternal,
  callService,
  createLogger,
} = require('@fleet/shared');
const Telemetry = require('./models/Telemetry');
const { detectCriticalEvents } = require('./criticalEvents');

const { EVENT_TYPES } = Telemetry;
const log = createLogger('telemetry-service');
const router = express.Router();
router.use(authenticateOrInternal);

const telemetrySchema = Joi.object({
  vehicleId: objectId().required(),
  lat: latitude().required(),
  lng: longitude().required(),
  speed: Joi.number().min(0).max(300).default(0),
  fuelLevel: Joi.number().min(0).max(100),
  batteryVoltage: Joi.number().min(0).max(60),
  engineTemp: Joi.number().min(-50).max(200),
  eventType: Joi.string().uppercase().valid(...EVENT_TYPES),
  timestamp: Joi.date().iso().max('now').default(() => new Date()),
});

const historyQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  critical: Joi.boolean(),
});

const vehicleParam = validate(Joi.object({ vehicleId: objectId().required() }), 'params');

/**
 * POST /telemetry
 *  1. Update the vehicle's current location in the Vehicle Service (404 if the vehicle doesn't exist).
 *  2. Detect critical events (explicit eventType or thresholds).
 *  3. Store the reading.
 *  4. For critical events, SMS all admins through the Notification Service.
 */
router.post(
  '/',
  validate(telemetrySchema),
  asyncHandler(async (req, res) => {
    const reading = req.body;
    const requestId = req.headers['x-request-id'];

    // 1. Sync current location to the vehicle record.
    let vehicle = null;
    let locationSynced = false;
    try {
      ({ vehicle } = await callService('vehicle', {
        method: 'PATCH',
        url: `/vehicles/internal/${reading.vehicleId}/location`,
        data: { lat: reading.lat, lng: reading.lng, timestamp: reading.timestamp },
        requestId,
      }));
      locationSynced = true;
    } catch (err) {
      if (err.status === 404) throw err; // unknown vehicle → reject the reading
      log.warn(`Could not sync location for ${reading.vehicleId}: ${err.message}`);
    }

    // 2–3. Detect and store.
    const criticalEvents = detectCriticalEvents(reading);
    const telemetry = new Telemetry({
      vehicleId: reading.vehicleId,
      location: { type: 'Point', coordinates: [reading.lng, reading.lat] }, // GeoJSON order: [lng, lat]
      speed: reading.speed,
      fuelLevel: reading.fuelLevel,
      batteryVoltage: reading.batteryVoltage,
      engineTemp: reading.engineTemp,
      eventType: reading.eventType || null,
      critical: criticalEvents.length > 0,
      criticalEvents,
      timestamp: reading.timestamp,
      locationSynced,
    });

    // 4. Critical → SMS every admin.
    if (criticalEvents.length) {
      const name = vehicle ? vehicle.registrationNumber : reading.vehicleId;
      const events = criticalEvents.map((e) => e.event).join(', ');
      const details = criticalEvents.map((e) => e.detail).join('; ');
      try {
        const result = await callService('notification', {
          method: 'POST',
          url: '/notifications/notify',
          data: {
            type: 'CRITICAL_EVENT',
            event: criticalEvents[0].event,
            vehicleId: reading.vehicleId,
            message: `🚨 CRITICAL: Vehicle ${name} reported ${events} (${details}) at ${reading.lat},${reading.lng}.`,
            recipients: { roles: ['admin'] },
          },
          requestId,
        });
        telemetry.notification = { count: result.count, sent: result.sent, failed: result.failed, ids: result.data.map((n) => n.id) };
      } catch (err) {
        log.warn(`Critical-event SMS failed for ${name}: ${err.message}`);
        telemetry.notification = { count: 0, sent: 0, failed: 0, ids: [], error: err.message };
      }
    }

    await telemetry.save();
    res.status(201).json({
      telemetry,
      critical: {
        detected: criticalEvents.length > 0,
        events: criticalEvents,
        notifications: telemetry.notification || null,
      },
    });
  })
);

/** GET /telemetry/:vehicleId/latest – most recent reading */
router.get(
  '/:vehicleId/latest',
  vehicleParam,
  asyncHandler(async (req, res) => {
    const telemetry = await Telemetry.findOne({ vehicleId: req.params.vehicleId }).sort({ timestamp: -1 });
    if (!telemetry) throw ApiError.notFound('TELEMETRY_NOT_FOUND', `No telemetry for vehicle ${req.params.vehicleId}`);
    res.json({ telemetry });
  })
);

/** GET /telemetry/:vehicleId?page=&limit=&from=&to=&critical= – paginated history, newest first */
router.get(
  '/:vehicleId',
  vehicleParam,
  validate(historyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, from, to, critical } = req.query;
    const filter = { vehicleId: req.params.vehicleId };
    if (from || to) filter.timestamp = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    if (critical !== undefined) filter.critical = critical;
    const [data, total] = await Promise.all([
      Telemetry.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit),
      Telemetry.countDocuments(filter),
    ]);
    res.json({ vehicleId: req.params.vehicleId, data, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

module.exports = router;
