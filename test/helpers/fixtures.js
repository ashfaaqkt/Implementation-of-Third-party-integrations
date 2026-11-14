/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/helpers/fixtures.js – test data helpers: reset DBs, create users/vehicles, get JWTs
 */
const bcrypt = require('bcryptjs');
const { signToken } = require('@fleet/shared');

const User = require('../../services/user-service/src/models/User');
const Vehicle = require('../../services/vehicle-service/src/models/Vehicle');
const Telemetry = require('../../services/telemetry-service/src/models/Telemetry');
const Notification = require('../../services/notification-service/src/models/Notification');
const GeoCache = require('../../services/geo-service/src/models/GeoCache');

const MODELS = { User, Vehicle, Telemetry, Notification, GeoCache };
const INTERNAL = { 'x-internal-token': 'test-internal-token' };

/** Wipe every collection and make sure indexes (unique, 2dsphere) exist. */
async function resetDb() {
  await Promise.all(Object.values(MODELS).map((M) => M.deleteMany({})));
  await Promise.all(Object.values(MODELS).map((M) => M.init()));
}

let counter = 0;
const PHONES = { admin: '+919847000001', fleet_manager: '+919847000002', driver: '+919847000003' };

/** Create a user directly in the DB and return { user, token, auth } */
async function createUser(role = 'admin', overrides = {}) {
  counter += 1;
  const user = await User.create({
    name: `${role} user ${counter}`,
    email: `${role}.${counter}@test.local`,
    phone: PHONES[role] || '+919847000009',
    passwordHash: await bcrypt.hash('Password@123', 4),
    role,
    ...overrides,
  });
  const token = signToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

async function createVehicle(overrides = {}) {
  counter += 1;
  const { lat = 9.9658, lng = 76.2856, ...rest } = overrides;
  return Vehicle.create({
    registrationNumber: `KL-07-T-${String(counter).padStart(4, '0')}`,
    make: 'Tata',
    model: 'Ace',
    type: 'truck',
    location: { type: 'Point', coordinates: [lng, lat] },
    locationSource: 'gps',
    status: 'active',
    ...rest,
  });
}

module.exports = { ...MODELS, MODELS, INTERNAL, resetDb, createUser, createVehicle };
