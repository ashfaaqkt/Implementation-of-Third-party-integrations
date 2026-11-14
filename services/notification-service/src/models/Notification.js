/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/models/Notification.js – record of every SMS attempt (queued/sent/failed)
 */
const { mongoose, getDb } = require('@fleet/shared');

const TYPES = ['CRITICAL_EVENT', 'STATUS_CHANGE', 'MANUAL'];
const STATUSES = ['queued', 'sent', 'failed'];

const notificationSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: TYPES, required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'queued', index: true },
    providerMessageId: { type: String, default: null },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    vehicleId: { type: String, default: null, index: true },
    event: { type: String, default: null },
    recipient: {
      userId: String,
      name: String,
      role: String,
    },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

notificationSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = getDb('fleet_notifications').model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
