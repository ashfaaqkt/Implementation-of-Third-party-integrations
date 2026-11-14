/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/03-telemetry.flow.js – Flow 3: telemetry submission, storage and critical-event notifications
 */
const { expect } = require('chai');
const request = require('supertest');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser, createVehicle, Vehicle, Telemetry, Notification } = require('../helpers/fixtures');

const app = SERVICES.telemetry;

describe('Flow 3 – Vehicle telemetry submission and storage', () => {
  let admin;
  let driver;
  let vehicle;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin', { phone: '+919847000001' });
    driver = await createUser('driver', { phone: '+919847000003' });
    vehicle = await createVehicle({ registrationNumber: 'KL-07-TEL-01', lat: 9.9658, lng: 76.2856, driverId: driver.user.id });
  });

  const reading = (overrides = {}) => ({
    vehicleId: vehicle.id,
    lat: 9.9816,
    lng: 76.2999,
    speed: 42,
    fuelLevel: 63,
    batteryVoltage: 12.6,
    engineTemp: 88,
    ...overrides,
  });

  it('stores a reading (201) as a GeoJSON point in the telemetry database', async () => {
    const res = await request(app).post('/telemetry').set(driver.auth).send(reading()).expect(201);
    expect(res.body.telemetry).to.include({ vehicleId: vehicle.id, lat: 9.9816, lng: 76.2999, speed: 42, critical: false });
    expect(res.body.critical).to.deep.equal({ detected: false, events: [], notifications: null });

    const docs = await Telemetry.find({ vehicleId: vehicle.id });
    expect(docs).to.have.length(1);
    expect(docs[0].location.coordinates).to.deep.equal([76.2999, 9.9816]);
    expect(docs[0].locationSynced).to.equal(true);
  });

  it("updates the vehicle's current location in the Vehicle Service", async () => {
    await request(app).post('/telemetry').set(driver.auth).send(reading({ lat: 10.0261, lng: 76.3125 })).expect(201);
    const updated = await Vehicle.findById(vehicle.id);
    expect(updated.location.coordinates).to.deep.equal([76.3125, 10.0261]);
    expect(updated.locationSource).to.equal('gps');
    expect(updated.lastLocationAt).to.be.instanceOf(Date);
  });

  it('a normal reading creates no notification', async () => {
    await request(app).post('/telemetry').set(driver.auth).send(reading()).expect(201);
    expect(await Notification.countDocuments()).to.equal(0);
  });

  it('returns paginated history (newest first) and the latest reading', async () => {
    const base = Date.now() - 60000;
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .post('/telemetry')
        .set(driver.auth)
        .send(reading({ speed: 10 * (i + 1), timestamp: new Date(base + i * 1000).toISOString() }))
        .expect(201);
    }
    const page1 = await request(app).get(`/telemetry/${vehicle.id}?limit=2`).set(admin.auth).expect(200);
    expect(page1.body).to.include({ total: 3, totalPages: 2, page: 1 });
    expect(page1.body.data.map((t) => t.speed)).to.deep.equal([30, 20]);

    const latest = await request(app).get(`/telemetry/${vehicle.id}/latest`).set(admin.auth).expect(200);
    expect(latest.body.telemetry.speed).to.equal(30);
  });

  it('returns 404 for latest telemetry of a vehicle with no readings', async () => {
    const res = await request(app).get(`/telemetry/${vehicle.id}/latest`).set(admin.auth).expect(404);
    expect(res.body.error.code).to.equal('TELEMETRY_NOT_FOUND');
  });

  it('rejects invalid payloads with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/telemetry')
      .set(driver.auth)
      .send({ lat: 200, lng: 76.3, speed: -5, eventType: 'ALIEN_INVASION', timestamp: '2999-01-01T00:00:00Z' })
      .expect(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).to.include.members(['vehicleId', 'lat', 'speed', 'eventType', 'timestamp']);
    expect(await Telemetry.countDocuments()).to.equal(0);
  });

  it('rejects telemetry for an unknown vehicle with 404 VEHICLE_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/telemetry')
      .set(driver.auth)
      .send(reading({ vehicleId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }))
      .expect(404);
    expect(res.body.error.code).to.equal('VEHICLE_NOT_FOUND');
    expect(await Telemetry.countDocuments()).to.equal(0);
  });

  it('requires authentication (401)', async () => {
    await request(app).post('/telemetry').send(reading()).expect(401);
  });

  describe('critical events', () => {
    it('an explicit EMERGENCY_STOP creates a CRITICAL_EVENT notification to every admin', async () => {
      const second = await createUser('admin', { phone: '+919847000011' });
      const res = await request(app).post('/telemetry').set(driver.auth).send(reading({ eventType: 'EMERGENCY_STOP', speed: 0 })).expect(201);

      expect(res.body.critical.detected).to.equal(true);
      expect(res.body.critical.events[0]).to.include({ event: 'EMERGENCY_STOP', detectedBy: 'explicit' });
      expect(res.body.critical.notifications).to.include({ count: 2, sent: 2, failed: 0 });

      const notes = await Notification.find({ vehicleId: vehicle.id });
      expect(notes).to.have.length(2);
      expect(notes.map((n) => n.to)).to.have.members([admin.user.phone, second.user.phone]);
      notes.forEach((n) => {
        expect(n).to.include({ type: 'CRITICAL_EVENT', event: 'EMERGENCY_STOP', status: 'sent', provider: 'stub' });
        expect(n.message).to.contain('KL-07-TEL-01').and.contain('EMERGENCY_STOP');
      });
    });

    it('auto-detects LOW_BATTERY (< 11.5 V) and ENGINE_FAULT (> 110 °C) from thresholds', async () => {
      const res = await request(app).post('/telemetry').set(driver.auth).send(reading({ batteryVoltage: 11.1, engineTemp: 118 })).expect(201);
      const events = res.body.critical.events.map((e) => e.event);
      expect(events).to.have.members(['LOW_BATTERY', 'ENGINE_FAULT']);
      res.body.critical.events.forEach((e) => expect(e.detectedBy).to.equal('threshold'));

      const stored = await Telemetry.findById(res.body.telemetry.id);
      expect(stored.critical).to.equal(true);
      expect(stored.notification.sent).to.equal(1);
      const note = await Notification.findOne({ vehicleId: vehicle.id });
      expect(note.message).to.contain('LOW_BATTERY').and.contain('ENGINE_FAULT');
    });

    it('does not double-report LOW_BATTERY when sent explicitly and also below threshold', async () => {
      const res = await request(app)
        .post('/telemetry')
        .set(driver.auth)
        .send(reading({ eventType: 'LOW_BATTERY', batteryVoltage: 10.9 }))
        .expect(201);
      expect(res.body.critical.events).to.have.length(1);
      expect(res.body.critical.events[0].detectedBy).to.equal('explicit');
    });

    it('still stores the reading when the Notification Service is down (error recorded)', async () => {
      const original = process.env.NOTIFICATION_SERVICE_URL;
      process.env.NOTIFICATION_SERVICE_URL = 'http://127.0.0.1:1';
      try {
        const res = await request(app).post('/telemetry').set(driver.auth).send(reading({ eventType: 'ENGINE_FAULT' })).expect(201);
        expect(res.body.telemetry.notification.error).to.match(/notification-service is unavailable/);
        expect(await Telemetry.countDocuments()).to.equal(1);
      } finally {
        process.env.NOTIFICATION_SERVICE_URL = original;
      }
    });

    it('still stores the reading when the Vehicle Service is down (locationSynced=false)', async () => {
      const original = process.env.VEHICLE_SERVICE_URL;
      process.env.VEHICLE_SERVICE_URL = 'http://127.0.0.1:1';
      try {
        const res = await request(app).post('/telemetry').set(driver.auth).send(reading()).expect(201);
        expect(res.body.telemetry.locationSynced).to.equal(false);
      } finally {
        process.env.VEHICLE_SERVICE_URL = original;
      }
    });
  });
});
