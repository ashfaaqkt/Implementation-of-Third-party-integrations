/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/telemetry-service/src/models/Telemetry.js – GPS + sensor readings reported by vehicles
 */
const { mongoose, getDb } = require('@fleet/shared');

const CRITICAL_EVENTS = ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'];
const EVENT_TYPES = [...CRITICAL_EVENTS, 'NORMAL', 'IGNITION_ON', 'IGNITION_OFF', 'HARSH_BRAKING', 'OVERSPEED'];

const telemetrySchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true },
    // GPS fix stored as GeoJSON [lng, lat] so history can be queried spatially too.
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    speed: { type: Number, default: 0 }, // km/h
    fuelLevel: { type: Number, default: null }, // %
    batteryVoltage: { type: Number, default: null }, // volts
    engineTemp: { type: Number, default: null }, // °C
    eventType: { type: String, enum: [...EVENT_TYPES, null], default: null },
    critical: { type: Boolean, default: false },
    criticalEvents: [{ event: { type: String, enum: CRITICAL_EVENTS }, detectedBy: String, detail: String, _id: false }],
    timestamp: { type: Date, default: Date.now },
    locationSynced: { type: Boolean, default: false },
    // Only set for critical readings (outcome of the SMS to admins).
    notification: {
      type: new mongoose.Schema({ count: Number, sent: Number, failed: Number, ids: [String], error: String }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: { createdAt: 'receivedAt', updatedAt: false } }
);

telemetrySchema.index({ vehicleId: 1, timestamp: -1 });
telemetrySchema.index({ location: '2dsphere' });

telemetrySchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    if (ret.location && ret.location.coordinates) {
      ret.lat = ret.location.coordinates[1];
      ret.lng = ret.location.coordinates[0];
    }
    return ret;
  },
});

module.exports = getDb('fleet_telemetry').model('Telemetry', telemetrySchema);
module.exports.CRITICAL_EVENTS = CRITICAL_EVENTS;
module.exports.EVENT_TYPES = EVENT_TYPES;
