/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : scripts/seed.js – `npm run seed`: demo users + 11 vehicles around Kochi and Kozhikode
 */
const bcrypt = require('bcryptjs');
const { config, connectDatabase, disconnectDatabase } = require('@fleet/shared');

const User = require('../services/user-service/src/models/User');
const Vehicle = require('../services/vehicle-service/src/models/Vehicle');
const Telemetry = require('../services/telemetry-service/src/models/Telemetry');
const Notification = require('../services/notification-service/src/models/Notification');
const GeoCache = require('../services/geo-service/src/models/GeoCache');

const USERS = [
  { key: 'admin', name: 'Asha Admin', email: 'admin@fleet.local', phone: '+919847000001', password: 'Admin@123', role: 'admin' },
  { key: 'manager', name: 'Manu Manager', email: 'manager@fleet.local', phone: '+919847000002', password: 'Manager@123', role: 'fleet_manager' },
  { key: 'driver', name: 'Dileep Driver', email: 'driver@fleet.local', phone: '+919847000003', password: 'Driver@123', role: 'driver' },
  // Phone ends in 0000 → the SMS stub always fails for this driver (demo of `failed` notifications).
  { key: 'driver2', name: 'Rahul Driver', email: 'driver2@fleet.local', phone: '+919800000000', password: 'Driver@123', role: 'driver' },
];

// [registration, make, model, type, address, lat, lng, status, driverKey]
const VEHICLES = [
  ['KL-07-AB-1234', 'Tata', 'Ace Gold', 'truck', 'MG Road, Kochi', 9.9658, 76.2856, 'active', 'driver'],
  ['KL-07-BC-2345', 'Ashok Leyland', 'Dost+', 'van', 'Edappally, Kochi', 10.0261, 76.3125, 'active', null],
  ['KL-07-CD-3456', 'Mahindra', 'Bolero Pik-Up', 'truck', 'Kakkanad, Kochi', 10.0159, 76.3419, 'idle', null],
  ['KL-07-DE-4567', 'Eicher', 'Pro 2049', 'truck', 'Infopark, Kochi', 10.0098, 76.3636, 'maintenance', null],
  ['KL-07-EF-5678', 'Maruti Suzuki', 'Eeco Cargo', 'van', 'Fort Kochi', 9.9658, 76.2421, 'active', 'driver2'],
  ['KL-07-FG-6789', 'Tata', 'Winger', 'van', 'Vyttila, Kochi', 9.9674, 76.3185, 'offline', null],
  ['KL-41-GH-7890', 'BharatBenz', '1015R', 'truck', 'Aluva, Ernakulam', 10.1076, 76.3516, 'active', null],
  ['KL-11-HJ-8901', 'Tata', 'Starbus', 'bus', 'Kozhikode Beach', 11.2553, 75.7726, 'active', null],
  ['KL-11-JK-9012', 'Mahindra', 'Supro', 'van', 'Mavoor Road, Kozhikode', 11.2588, 75.79, 'idle', null],
  ['KL-11-KL-0123', 'Force', 'Traveller', 'bus', 'Medical College, Kozhikode', 11.2717, 75.8355, 'active', null],
  ['KL-11-LM-1122', 'Ashok Leyland', 'Partner', 'truck', 'Feroke, Kozhikode', 11.1765, 75.8394, 'active', null],
];

async function main() {
  await connectDatabase();

  // Start from a clean slate so the demo is repeatable.
  await Promise.all([User, Vehicle, Telemetry, Notification, GeoCache].map((M) => M.deleteMany({})));
  await Promise.all([User, Vehicle, Telemetry, Notification, GeoCache].map((M) => M.init()));

  const users = {};
  for (const u of USERS) {
    // eslint-disable-next-line no-await-in-loop
    users[u.key] = await User.create({ ...u, passwordHash: await bcrypt.hash(u.password, 10) });
  }

  const vehicles = await Vehicle.insertMany(
    VEHICLES.map(([registrationNumber, make, model, type, address, lat, lng, status, driverKey]) => ({
      registrationNumber,
      make,
      model,
      type,
      address,
      location: { type: 'Point', coordinates: [lng, lat] },
      locationSource: 'gps',
      lastLocationAt: new Date(),
      status,
      driverId: driverKey ? String(users[driverKey]._id) : null,
      statusHistory: [{ from: null, to: status, reason: 'Seeded', changedBy: { id: 'seed', role: 'system', name: 'seed script' } }],
    }))
  );

  console.log('\n🌱 Seed complete – Fleet Management System (Ashfaaq Feroz Muhammad, 2023EBCS005)\n');
  console.table(USERS.map((u) => ({ role: u.role, email: u.email, password: u.password, phone: u.phone })));
  console.table(vehicles.map((v) => ({ id: String(v._id), registration: v.registrationNumber, status: v.status, address: v.address })));
  console.log(`API key for requests: ${(process.env.API_KEYS || 'devkey123:standard').split(',')[0].split(':')[0]}`);
  console.log(`Database: ${config.mongoUri() ? 'MONGO_URI' : 'local dev database (.data/mongo)'}\n`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
