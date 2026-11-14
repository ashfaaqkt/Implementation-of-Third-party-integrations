/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/05-rbac.flow.js – Flow 5: role-based access control (unauthorized users deleting a vehicle)
 */
const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser, createVehicle, Vehicle } = require('../helpers/fixtures');
const { createGateway } = require('../../gateway/src/app');
const { buildRoutes } = require('../../gateway/src/config');

const app = SERVICES.vehicle;

describe('Flow 5 – Role-based access control', () => {
  let admin;
  let manager;
  let driver;
  let vehicle;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin');
    manager = await createUser('fleet_manager');
    driver = await createUser('driver');
    vehicle = await createVehicle({ registrationNumber: 'KL-07-RBAC-1' });
  });

  describe('DELETE /vehicles/:id (admin only)', () => {
    it('driver → 403 INSUFFICIENT_ROLE and the vehicle is kept', async () => {
      const res = await request(app).delete(`/vehicles/${vehicle.id}`).set(driver.auth).expect(403);
      expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
      expect(res.body.error.message).to.contain("'driver'");
      expect(await Vehicle.exists({ _id: vehicle.id })).to.not.equal(null);
    });

    it('fleet_manager → 403 INSUFFICIENT_ROLE', async () => {
      const res = await request(app).delete(`/vehicles/${vehicle.id}`).set(manager.auth).expect(403);
      expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
      expect(await Vehicle.exists({ _id: vehicle.id })).to.not.equal(null);
    });

    it('no token → 401 TOKEN_MISSING', async () => {
      const res = await request(app).delete(`/vehicles/${vehicle.id}`).expect(401);
      expect(res.body.error.code).to.equal('TOKEN_MISSING');
    });

    it('a forged token claiming admin → 401 TOKEN_INVALID', async () => {
      const forged = jwt.sign({ sub: driver.user.id, role: 'admin' }, 'attacker-secret');
      await request(app).delete(`/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${forged}`).expect(401);
      expect(await Vehicle.exists({ _id: vehicle.id })).to.not.equal(null);
    });

    it('the internal service token cannot delete vehicles (needs a user JWT)', async () => {
      await request(app).delete(`/vehicles/${vehicle.id}`).set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN).expect(401);
    });

    it('admin → 200 and the vehicle is gone (then 404)', async () => {
      const res = await request(app).delete(`/vehicles/${vehicle.id}`).set(admin.auth).expect(200);
      expect(res.body).to.include({ deleted: true, id: vehicle.id, registrationNumber: 'KL-07-RBAC-1' });
      expect(await Vehicle.exists({ _id: vehicle.id })).to.equal(null);
      await request(app).delete(`/vehicles/${vehicle.id}`).set(admin.auth).expect(404);
    });
  });

  describe('through the API Gateway', () => {
    let gateway;
    before(() => {
      gateway = createGateway({ routes: buildRoutes() });
    });

    it('a driver deleting a vehicle via /api/vehicles/:id gets 403 from the service, relayed by the gateway', async () => {
      const res = await request(gateway)
        .delete(`/api/vehicles/${vehicle.id}`)
        .set('x-api-key', 'devkey123')
        .set(driver.auth)
        .expect(403);
      expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
      expect(res.headers['x-served-by']).to.equal('vehicle-service');
    });

    it('an admin deleting via the gateway succeeds', async () => {
      await request(gateway).delete(`/api/vehicles/${vehicle.id}`).set('x-api-key', 'devkey123').set(admin.auth).expect(200);
    });
  });

  describe('other role rules', () => {
    it('drivers cannot register or update vehicles', async () => {
      await request(app).post('/vehicles').set(driver.auth).send({ registrationNumber: 'KL-01-X-1', make: 'a', model: 'b' }).expect(403);
      await request(app).put(`/vehicles/${vehicle.id}`).set(driver.auth).send({ model: 'x' }).expect(403);
    });

    it('fleet managers can register and update vehicles', async () => {
      await request(app).put(`/vehicles/${vehicle.id}`).set(manager.auth).send({ model: 'Ace Gold' }).expect(200);
    });

    it('internal routes reject user JWTs and wrong internal tokens', async () => {
      await request(app).patch(`/vehicles/internal/${vehicle.id}/location`).set(admin.auth).send({ lat: 1, lng: 1 }).expect(401);
      await request(app)
        .patch(`/vehicles/internal/${vehicle.id}/location`)
        .set('x-internal-token', 'wrong-token')
        .send({ lat: 1, lng: 1 })
        .expect(403);
    });
  });
});
