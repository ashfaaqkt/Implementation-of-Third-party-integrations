/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/vehicle-service/src/routes.js – vehicle CRUD, status updates + SMS, nearby search, internal location update
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
  authenticate,
  authenticateOrInternal,
  internalOnly,
  requireRole,
  callService,
  createLogger,
} = require('@fleet/shared');
const Vehicle = require('./models/Vehicle');

const { STATUSES, TYPES } = Vehicle;
const log = createLogger('vehicle-service');
const router = express.Router();

// ------------------------------------------------------------------ schemas
const locationInput = Joi.object({ lat: latitude().required(), lng: longitude().required() });

const vehicleInput = {
  registrationNumber: Joi.string().trim().uppercase().pattern(/^[A-Z0-9 -]{4,20}$/)
    .message("registrationNumber must be 4–20 letters, digits, spaces or '-', e.g. KL-07-AB-1234"),
  make: Joi.string().trim().min(1).max(50),
  model: Joi.string().trim().min(1).max(50),
  type: Joi.string().valid(...TYPES),
  driverId: objectId().allow(null),
  address: Joi.string().trim().min(3).max(300).allow(null),
  location: locationInput.allow(null),
};

const createSchema = Joi.object({
  ...vehicleInput,
  registrationNumber: vehicleInput.registrationNumber.required(),
  make: vehicleInput.make.required(),
  model: vehicleInput.model.required(),
  type: vehicleInput.type.default('truck'),
});

const updateSchema = Joi.object(vehicleInput).min(1).messages({ 'object.min': 'Provide at least one field to update' });

const statusSchema = Joi.object({
  status: Joi.string().valid(...STATUSES).required(),
  reason: Joi.string().trim().max(300),
});

const nearbyQuery = Joi.object({
  lat: latitude().required(),
  lng: longitude().required(),
  radiusKm: Joi.number().positive().max(500).default(5),
  status: Joi.string().valid(...STATUSES),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

const listQuery = Joi.object({
  status: Joi.string().valid(...STATUSES),
  type: Joi.string().valid(...TYPES),
  driverId: objectId(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const idParam = validate(Joi.object({ id: objectId().required() }), 'params');

// ------------------------------------------------------------------ helpers
async function findVehicleOr404(id) {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw ApiError.notFound('VEHICLE_NOT_FOUND', `Vehicle ${id} not found`);
  return vehicle;
}

/**
 * Geocode an address through the Geolocation Service.
 * Unknown address → 400 ADDRESS_NOT_FOUND. If the geo service / provider is
 * down we still save the vehicle (without coordinates) and report why.
 */
async function geocode(address, requestId) {
  try {
    const result = await callService('geo', { url: '/maps/geocode', params: { address }, requestId });
    return { ok: true, result };
  } catch (err) {
    if (err.status === 404) {
      throw ApiError.badRequest(`Could not geocode address '${address}'`, undefined, 'ADDRESS_NOT_FOUND');
    }
    log.warn(`Geocoding unavailable for '${address}': ${err.message}`);
    return { ok: false, reason: err.message, code: err.code };
  }
}

/** Apply { location } or { address } input to a vehicle document. Returns geocoding info for the response. */
async function applyLocationInput(vehicle, body, requestId) {
  if (body.location) {
    vehicle.location = Vehicle.toPoint(body.location);
    vehicle.locationSource = 'manual';
    vehicle.lastLocationAt = new Date();
    return { status: 'skipped', reason: 'coordinates provided' };
  }
  if (body.address) {
    const geo = await geocode(body.address, requestId);
    if (geo.ok) {
      vehicle.location = Vehicle.toPoint(geo.result);
      vehicle.locationSource = 'geocoded';
      vehicle.lastLocationAt = new Date();
      return { status: 'success', lat: geo.result.lat, lng: geo.result.lng, displayName: geo.result.displayName, provider: geo.result.provider, cached: geo.result.cached };
    }
    return { status: 'failed', reason: geo.reason };
  }
  return undefined;
}

const statusMessage = (vehicle, from, to, reason) =>
  `Fleet Alert: Vehicle ${vehicle.registrationNumber} status changed from ${from} to ${to.toUpperCase()}` +
  `${reason ? `. Reason: ${reason}` : ''}.`;

// ------------------------------------------------------------------ routes

/**
 * PATCH /vehicles/internal/:id/location – called by the Telemetry Service
 * (x-internal-token) to store the latest GPS position from a vehicle.
 */
router.patch(
  '/internal/:id/location',
  internalOnly,
  idParam,
  validate(locationInput.keys({ timestamp: Joi.date().iso() })),
  asyncHandler(async (req, res) => {
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        location: Vehicle.toPoint(req.body),
        locationSource: 'gps',
        lastLocationAt: req.body.timestamp || new Date(),
      },
      { new: true, runValidators: true }
    );
    if (!vehicle) throw ApiError.notFound('VEHICLE_NOT_FOUND', `Vehicle ${req.params.id} not found`);
    res.json({ vehicle });
  })
);

/** Everything below needs a user JWT (or an internal service token). */
router.use(authenticateOrInternal);

/**
 * GET /vehicles/nearby?lat=&lng=&radiusKm=&status=
 * $geoNear uses the 2dsphere index, filters by maxDistance (metres) and returns
 * results already sorted nearest-first with the distance in `distanceMeters`.
 */
router.get(
  '/nearby',
  validate(nearbyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { lat, lng, radiusKm, status, limit } = req.query;
    await Vehicle.init(); // make sure the 2dsphere index exists before $geoNear

    const rows = await Vehicle.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          ...(status ? { query: { status } } : {}),
        },
      },
      { $limit: limit },
      { $project: { statusHistory: 0 } },
    ]);

    const data = rows.map(({ distanceMeters, ...row }) => ({
      ...Vehicle.hydrate(row).toJSON(),
      statusHistory: undefined,
      distanceKm: Math.round(distanceMeters) / 1000, // metres → km, 3 decimals
    }));
    res.json({ center: { lat, lng }, radiusKm, count: data.length, data });
  })
);

/** POST /vehicles – register a vehicle (admin, fleet_manager). Geocodes `address` if no `location`. */
router.post(
  '/',
  requireRole('admin', 'fleet_manager'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (await Vehicle.exists({ registrationNumber: req.body.registrationNumber })) {
      throw ApiError.conflict(
        'VEHICLE_ALREADY_EXISTS',
        `A vehicle with registration number ${req.body.registrationNumber} already exists`
      );
    }
    const { location, ...fields } = req.body;
    const vehicle = new Vehicle({
      ...fields,
      status: 'active',
      statusHistory: [{ from: null, to: 'active', reason: 'Vehicle registered', changedBy: req.user }],
    });
    const geocoding = await applyLocationInput(vehicle, req.body, req.headers['x-request-id']);
    await vehicle.save();
    res.status(201).json({ vehicle, ...(geocoding ? { geocoding } : {}) });
  })
);

/** GET /vehicles?status=&type=&driverId=&page=&limit= */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, ...filters } = req.query;
    const filter = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
    const [data, total] = await Promise.all([
      Vehicle.find(filter, { statusHistory: 0 }).sort({ registrationNumber: 1 }).skip((page - 1) * limit).limit(limit),
      Vehicle.countDocuments(filter),
    ]);
    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

/** GET /vehicles/:id */
router.get(
  '/:id',
  idParam,
  asyncHandler(async (req, res) => {
    res.json({ vehicle: await findVehicleOr404(req.params.id) });
  })
);

/** PUT /vehicles/:id – update details (admin, fleet_manager). A new address is geocoded again. */
router.put(
  '/:id',
  requireRole('admin', 'fleet_manager'),
  idParam,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const vehicle = await findVehicleOr404(req.params.id);
    const { registrationNumber } = req.body;
    if (registrationNumber && registrationNumber !== vehicle.registrationNumber
      && (await Vehicle.exists({ registrationNumber }))) {
      throw ApiError.conflict('VEHICLE_ALREADY_EXISTS', `A vehicle with registration number ${registrationNumber} already exists`);
    }
    const { location, ...fields } = req.body;
    vehicle.set(fields);
    // New coordinates win; otherwise a new address is geocoded again.
    const geocoding = location || req.body.address
      ? await applyLocationInput(vehicle, req.body, req.headers['x-request-id'])
      : undefined;
    await vehicle.save();
    res.json({ vehicle, ...(geocoding ? { geocoding } : {}) });
  })
);

/**
 * PATCH /vehicles/:id/status – change operational status.
 * Stores a status-history entry, then SMSes admins + fleet managers + the
 * assigned driver through the Notification Service. Drivers may only change
 * the status of the vehicle assigned to them.
 */
router.patch(
  '/:id/status',
  requireRole('admin', 'fleet_manager', 'driver'),
  idParam,
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const vehicle = await findVehicleOr404(req.params.id);
    if (req.user.role === 'driver' && vehicle.driverId !== req.user.id) {
      throw ApiError.forbidden('Drivers can only update the status of their assigned vehicle', 'INSUFFICIENT_ROLE');
    }

    const from = vehicle.status;
    const { status: to, reason } = req.body;
    if (from === to) {
      return res.json({ vehicle, changed: false, message: `Vehicle is already '${to}'` });
    }

    vehicle.status = to;
    vehicle.statusHistory.push({ from, to, reason, changedBy: req.user, changedAt: new Date() });
    await vehicle.save();

    // Notification failures must not undo the status change – report them instead.
    let notifications;
    try {
      const result = await callService('notification', {
        method: 'POST',
        url: '/notifications/notify',
        data: {
          type: 'STATUS_CHANGE',
          event: `STATUS_${to.toUpperCase()}`,
          vehicleId: String(vehicle._id),
          message: statusMessage(vehicle, from, to, reason),
          recipients: { roles: ['admin', 'fleet_manager'], userIds: vehicle.driverId ? [vehicle.driverId] : [] },
        },
        requestId: req.headers['x-request-id'],
      });
      notifications = {
        count: result.count,
        sent: result.sent,
        failed: result.failed,
        ids: result.data.map((n) => n.id),
      };
    } catch (err) {
      log.warn(`Status-change notification failed for ${vehicle.registrationNumber}: ${err.message}`);
      notifications = { count: 0, sent: 0, failed: 0, error: err.message };
    }

    return res.json({ vehicle, changed: true, previousStatus: from, notifications });
  })
);

/** DELETE /vehicles/:id – admin only (others → 403, no token → 401). */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  idParam,
  asyncHandler(async (req, res) => {
    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
    if (!vehicle) throw ApiError.notFound('VEHICLE_NOT_FOUND', `Vehicle ${req.params.id} not found`);
    res.json({ deleted: true, id: req.params.id, registrationNumber: vehicle.registrationNumber });
  })
);

module.exports = router;
