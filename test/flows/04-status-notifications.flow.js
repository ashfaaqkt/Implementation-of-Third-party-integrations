/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/04-status-notifications.flow.js – Flow 4: status update, SMS triggering, sent/failed records and retry
 */
const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser, createVehicle, Vehicle, Notification, INTERNAL } = require('../helpers/fixtures');
const stubProvider = require('../../services/notification-service/src/providers/stub');

const vehicles = SERVICES.vehicle;
const notifications = SERVICES.notification;

describe('Flow 4 – Vehicle status update and notification triggering', () => {
  let admin;
  let manager;
  let driver;
  let vehicle;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin', { phone: '+919847000001' });
    manager = await createUser('fleet_manager', { phone: '+919847000002' });
    driver = await createUser('driver', { phone: '+919847000003' });
    vehicle = await createVehicle({ registrationNumber: 'KL-07-STS-01', driverId: driver.user.id });
  });

  afterEach(() => {
    sinon.restore();
    process.env.SMS_STUB_FAIL_RATE = '0';
  });

  it('stores a status-history entry and SMSes admin, fleet manager and the assigned driver', async () => {
    const res = await request(vehicles)
      .patch(`/vehicles/${vehicle.id}/status`)
      .set(manager.auth)
      .send({ status: 'maintenance', reason: 'Brake inspection' })
      .expect(200);

    expect(res.body).to.include({ changed: true, previousStatus: 'active' });
    expect(res.body.vehicle.status).to.equal('maintenance');
    expect(res.body.notifications).to.include({ count: 3, sent: 3, failed: 0 });

    const saved = await Vehicle.findById(vehicle.id);
    const last = saved.statusHistory[saved.statusHistory.length - 1];
    expect(last).to.include({ from: 'active', to: 'maintenance', reason: 'Brake inspection' });
    expect(last.changedBy).to.include({ id: manager.user.id, role: 'fleet_manager' });

    const notes = await Notification.find({ vehicleId: vehicle.id });
    expect(notes.map((n) => n.to)).to.have.members(['+919847000001', '+919847000002', '+919847000003']);
    notes.forEach((n) => {
      expect(n).to.include({ type: 'STATUS_CHANGE', event: 'STATUS_MAINTENANCE', status: 'sent', attempts: 1 });
      expect(n.providerMessageId).to.match(/^stub-/);
      expect(n.sentAt).to.be.instanceOf(Date);
      expect(n.message).to.contain('KL-07-STS-01').and.contain('MAINTENANCE').and.contain('Brake inspection');
    });
  });

  it('records a failed notification after one retry for a number ending in 0000', async () => {
    const failing = await createUser('driver', { phone: '+919800000000' });
    const v = await createVehicle({ registrationNumber: 'KL-07-STS-02', driverId: failing.user.id });

    const res = await request(vehicles).patch(`/vehicles/${v.id}/status`).set(admin.auth).send({ status: 'offline' }).expect(200);
    expect(res.body.notifications).to.include({ count: 3, sent: 2, failed: 1 });

    const failed = await Notification.findOne({ vehicleId: v.id, status: 'failed' });
    expect(failed.to).to.equal('+919800000000');
    expect(failed.attempts).to.equal(2); // first try + one retry
    expect(failed.error).to.match(/0000 always fail/);
    expect(failed.providerMessageId).to.equal(null);
  });

  it('retries once and succeeds when the provider fails only the first time', async () => {
    const send = sinon.stub(stubProvider, 'send');
    send.onFirstCall().rejects(new Error('Temporary network glitch'));
    send.resolves({ providerMessageId: 'stub-retry-ok' });

    const res = await request(notifications)
      .post('/notifications/sms')
      .set(INTERNAL)
      .send({ to: '+919847000001', message: 'Retry test' })
      .expect(201);
    expect(res.body.notification).to.include({ status: 'sent', attempts: 2, providerMessageId: 'stub-retry-ok', error: null });
    expect(send.callCount).to.equal(2);
  });

  it('marks notifications failed when SMS_STUB_FAIL_RATE=1', async () => {
    process.env.SMS_STUB_FAIL_RATE = '1';
    const res = await request(notifications)
      .post('/notifications/sms')
      .set(admin.auth)
      .send({ to: '+919847000001', message: 'Will fail randomly' })
      .expect(201);
    expect(res.body.notification).to.include({ status: 'failed', attempts: 2 });
    expect(res.body.notification.error).to.match(/SMS_STUB_FAIL_RATE/);
  });

  it('does not notify when the status is unchanged', async () => {
    const res = await request(vehicles).patch(`/vehicles/${vehicle.id}/status`).set(admin.auth).send({ status: 'active' }).expect(200);
    expect(res.body.changed).to.equal(false);
    expect(await Notification.countDocuments()).to.equal(0);
  });

  it('keeps the status change even if the Notification Service is down', async () => {
    const original = process.env.NOTIFICATION_SERVICE_URL;
    process.env.NOTIFICATION_SERVICE_URL = 'http://127.0.0.1:1';
    try {
      const res = await request(vehicles).patch(`/vehicles/${vehicle.id}/status`).set(admin.auth).send({ status: 'idle' }).expect(200);
      expect(res.body.vehicle.status).to.equal('idle');
      expect(res.body.notifications.error).to.match(/unavailable/);
    } finally {
      process.env.NOTIFICATION_SERVICE_URL = original;
    }
  });

  it('validates the status value (400) and the vehicle id (404)', async () => {
    const bad = await request(vehicles).patch(`/vehicles/${vehicle.id}/status`).set(admin.auth).send({ status: 'flying' }).expect(400);
    expect(bad.body.error.details[0].field).to.equal('status');
    await request(vehicles).patch('/vehicles/cccccccccccccccccccccccc/status').set(admin.auth).send({ status: 'idle' }).expect(404);
  });

  it('lets the assigned driver change status, but not another driver (403)', async () => {
    await request(vehicles).patch(`/vehicles/${vehicle.id}/status`).set(driver.auth).send({ status: 'emergency' }).expect(200);
    const other = await createUser('driver');
    const res = await request(vehicles).patch(`/vehicles/${vehicle.id}/status`).set(other.auth).send({ status: 'idle' }).expect(403);
    expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
  });

  describe('notification records (sent/failed) for testing', () => {
    beforeEach(async () => {
      await request(notifications).post('/notifications/sms').set(admin.auth).send({ to: '+919847000001', message: 'ok 1' });
      await request(notifications).post('/notifications/sms').set(admin.auth).send({ to: '+919847000002', message: 'ok 2', vehicleId: vehicle.id });
      await request(notifications).post('/notifications/sms').set(admin.auth).send({ to: '+919810000000', message: 'fails' });
    });

    it('GET /notifications filters by status, type and vehicleId', async () => {
      const failed = await request(notifications).get('/notifications?status=failed').set(manager.auth).expect(200);
      expect(failed.body.total).to.equal(1);
      expect(failed.body.data[0].to).to.equal('+919810000000');

      const manual = await request(notifications).get('/notifications?type=MANUAL').set(manager.auth).expect(200);
      expect(manual.body.total).to.equal(3);

      const byVehicle = await request(notifications).get(`/notifications?vehicleId=${vehicle.id}`).set(manager.auth).expect(200);
      expect(byVehicle.body.total).to.equal(1);
    });

    it('GET /notifications/stats counts sent and failed', async () => {
      const res = await request(notifications).get('/notifications/stats').set(admin.auth).expect(200);
      expect(res.body).to.include({ total: 3, sent: 2, failed: 1, queued: 0 });
      expect(res.body.byType).to.include({ MANUAL: 3, STATUS_CHANGE: 0, CRITICAL_EVENT: 0 });
    });

    it('GET /notifications/:id returns one record, 404 when missing', async () => {
      const list = await request(notifications).get('/notifications').set(admin.auth).expect(200);
      const { id } = list.body.data[0];
      const one = await request(notifications).get(`/notifications/${id}`).set(admin.auth).expect(200);
      expect(one.body.notification.id).to.equal(id);
      await request(notifications).get('/notifications/dddddddddddddddddddddddd').set(admin.auth).expect(404);
    });

    it('drivers cannot read notifications or send manual SMS (403)', async () => {
      await request(notifications).get('/notifications').set(driver.auth).expect(403);
      await request(notifications).post('/notifications/sms').set(driver.auth).send({ to: '+919847000001', message: 'x' }).expect(403);
    });

    it('POST /notifications/notify sends to everyone in a role', async () => {
      const res = await request(notifications)
        .post('/notifications/notify')
        .set(manager.auth)
        .send({ type: 'MANUAL', message: 'Depot closes at 6 PM', recipients: { roles: ['admin', 'fleet_manager'], phones: ['+919847000099'] } })
        .expect(201);
      expect(res.body).to.include({ count: 3, sent: 3, failed: 0 });
    });

    it('rejects an invalid SMS request (400)', async () => {
      const res = await request(notifications).post('/notifications/sms').set(admin.auth).send({ to: '12345', message: '' }).expect(400);
      expect(res.body.error.details.map((d) => d.field)).to.include.members(['to', 'message']);
    });
  });
});
