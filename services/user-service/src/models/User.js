/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/user-service/src/models/User.js – User model (admin, fleet_manager, driver)
 */
const { mongoose, getDb, ROLES } = require('@fleet/shared');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, match: /^\+[1-9]\d{7,14}$/ },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'driver' },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = getDb('fleet_users').model('User', userSchema);
