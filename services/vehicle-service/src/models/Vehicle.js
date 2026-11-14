/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/vehicle-service/src/models/Vehicle.js – Vehicle model with GeoJSON location + 2dsphere index
 */
const { mongoose, getDb } = require('@fleet/shared');

const STATUSES = ['active', 'idle', 'maintenance', 'offline', 'emergency'];
const TYPES = ['truck', 'van', 'car', 'bus', 'bike', 'other'];

/** GeoJSON Point – NOTE: MongoDB stores coordinates as [longitude, latitude]. */
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      default: undefined,
      validate: {
        validator: (c) => Array.isArray(c) && c.length === 2 && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
        message: 'coordinates must be [lng, lat] within valid ranges',
      },
    },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: [...STATUSES, null] },
    to: { type: String, enum: STATUSES, required: true },
    reason: String,
    changedBy: { id: String, role: String, name: String },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    registrationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    type: { type: String, enum: TYPES, default: 'truck' },
    driverId: { type: String, default: null },
    address: { type: String, default: null },
    // Left undefined until a location is known (a 2dsphere index rejects half-built points).
    location: { type: pointSchema, default: undefined },
    locationSource: { type: String, enum: ['gps', 'geocoded', 'manual', null], default: null },
    lastLocationAt: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: 'active' },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

// 2dsphere index powers $geoNear / $nearSphere radius searches on a sphere.
vehicleSchema.index({ location: '2dsphere' });

vehicleSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    // Convenience copy in the familiar lat/lng order.
    ret.position = ret.location && ret.location.coordinates
      ? { lat: ret.location.coordinates[1], lng: ret.location.coordinates[0] }
      : null;
    return ret;
  },
});

/** { lat, lng } → GeoJSON Point */
vehicleSchema.statics.toPoint = ({ lat, lng }) => ({ type: 'Point', coordinates: [Number(lng), Number(lat)] });

const Vehicle = getDb('fleet_vehicles').model('Vehicle', vehicleSchema);
module.exports = Vehicle;
module.exports.STATUSES = STATUSES;
module.exports.TYPES = TYPES;
