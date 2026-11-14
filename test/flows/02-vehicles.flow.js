/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/02-vehicles.flow.js – Flow 2: vehicle registration (with mocked geocoding) and retrieval
 */
const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser, createVehicle, Vehicle } = require('../helpers/fixtures');

const app = SERVICES.vehicle;
const NOMINATIM = 'https://nominatim.openstreetmap.org';

describe('Flow 2 – Vehicle registration and retrieval', () => {
  let admin;
  let manager;
  let driver;

  before(async () => {
    await resetDb();
    admin = await createUser('admin');
    manager = await createUser('fleet_manager');
    driver = await createUser('driver');
  });

  afterEach(() => {
    process.env.GEO_PROVIDER = 'mock';
  });

  describe('POST /vehicles', () => {
    it('geocodes the address through the Geo Service (Nominatim mocked with nock) and stores a GeoJSON point', async () => {
      process.env.GEO_PROVIDER = 'nominatim';
      const scope = nock(NOMINATIM)
        .get('/search')
        .query((q) => q.q === 'Marine Drive, Kochi' && q.format === 'jsonv2')
        .reply(200, [{ lat: '9.9784782', lon: '76.2757727', display_name: 'Marine Drive, Kochi, Kerala, India' }]);

      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .send({ registrationNumber: 'kl-07-ab-1234', make: 'Tata', model: 'Ace Gold', type: 'truck', address: 'Marine Drive, Kochi' })
        .expect(201);

      expect(scope.isDone()).to.equal(true);
      expect(res.body.vehicle.registrationNumber).to.equal('KL-07-AB-1234'); // normalised to upper case
      expect(res.body.vehicle.location).to.deep.equal({ type: 'Point', coordinates: [76.2757727, 9.9784782] });
      expect(res.body.vehicle.position).to.deep.equal({ lat: 9.9784782, lng: 76.2757727 });
      expect(res.body.vehicle.locationSource).to.equal('geocoded');
      expect(res.body.geocoding).to.include({ status: 'success', provider: 'nominatim' });

      const saved = await Vehicle.findById(res.body.vehicle.id);
      expect(saved.location.coordinates).to.deep.equal([76.2757727, 9.9784782]);
      expect(saved.statusHistory[0]).to.include({ to: 'active' });
    });

    it('uses the offline mock geocoder when GEO_PROVIDER=mock', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(manager.auth)
        .send({ registrationNumber: 'KL-07-CD-0001', make: 'Eicher', model: 'Pro', address: 'Kakkanad, Kochi' })
        .expect(201);
      expect(res.body.vehicle.position).to.deep.equal({ lat: 10.0159, lng: 76.3419 });
      expect(res.body.geocoding.provider).to.equal('mock');
    });

    it('stores explicit coordinates without geocoding', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .send({ registrationNumber: 'KL-11-EF-0002', make: 'Force', model: 'Traveller', type: 'bus', location: { lat: 11.2588, lng: 75.7804 } })
        .expect(201);
      expect(res.body.vehicle.locationSource).to.equal('manual');
      expect(res.body.geocoding.status).to.equal('skipped');
    });

    it('returns 400 ADDRESS_NOT_FOUND when the address cannot be geocoded', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .send({ registrationNumber: 'KL-07-XX-0003', make: 'Tata', model: 'Ace', address: 'Nowhere Land 12345' })
        .expect(400);
      expect(res.body.error.code).to.equal('ADDRESS_NOT_FOUND');
    });

    it('still registers the vehicle (without coordinates) if the Geo Service is down', async () => {
      const original = process.env.GEO_SERVICE_URL;
      process.env.GEO_SERVICE_URL = 'http://127.0.0.1:1'; // nothing listens here
      try {
        const res = await request(app)
          .post('/vehicles')
          .set(admin.auth)
          .send({ registrationNumber: 'KL-07-GG-0004', make: 'Tata', model: 'Ace', address: 'MG Road, Kochi' })
          .expect(201);
        expect(res.body.vehicle.location).to.equal(undefined);
        expect(res.body.geocoding.status).to.equal('failed');
        expect(res.body.geocoding.reason).to.match(/geo-service is unavailable/);
      } finally {
        process.env.GEO_SERVICE_URL = original;
      }
    });

    it('rejects a duplicate registration number with 409 VEHICLE_ALREADY_EXISTS', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .send({ registrationNumber: 'KL-07-AB-1234', make: 'Tata', model: 'Ace', location: { lat: 9.9, lng: 76.2 } })
        .expect(409);
      expect(res.body.error.code).to.equal('VEHICLE_ALREADY_EXISTS');
    });

    it('rejects invalid payloads with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .send({ registrationNumber: '!!', type: 'spaceship', location: { lat: 123, lng: 76 } })
        .expect(400);
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d) => d.field);
      expect(fields).to.include.members(['registrationNumber', 'make', 'model', 'type', 'location.lat']);
    });

    it('rejects malformed JSON with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/vehicles')
        .set(admin.auth)
        .set('Content-Type', 'application/json')
        .send('{"registrationNumber": ')
        .expect(400);
      expect(res.body.error.code).to.equal('INVALID_REQUEST');
    });

    it('forbids drivers from registering vehicles (403)', async () => {
      await request(app)
        .post('/vehicles')
        .set(driver.auth)
        .send({ registrationNumber: 'KL-07-DR-0005', make: 'Tata', model: 'Ace' })
        .expect(403);
    });
  });

  describe('GET /vehicles and GET /vehicles/:id', () => {
    it('retrieves a vehicle by id', async () => {
      const v = await createVehicle({ registrationNumber: 'KL-07-GET-01' });
      const res = await request(app).get(`/vehicles/${v.id}`).set(driver.auth).expect(200);
      expect(res.body.vehicle).to.include({ id: v.id, registrationNumber: 'KL-07-GET-01', status: 'active' });
    });

    it('returns 404 VEHICLE_NOT_FOUND for an unknown id and 400 for a malformed id', async () => {
      const res = await request(app).get('/vehicles/aaaaaaaaaaaaaaaaaaaaaaaa').set(driver.auth).expect(404);
      expect(res.body.error.code).to.equal('VEHICLE_NOT_FOUND');
      await request(app).get('/vehicles/not-an-id').set(driver.auth).expect(400);
    });

    it('lists vehicles with filters and pagination', async () => {
      await createVehicle({ status: 'maintenance' });
      const all = await request(app).get('/vehicles?limit=2&page=1').set(driver.auth).expect(200);
      expect(all.body.data).to.have.length(2);
      expect(all.body.total).to.be.at.least(5);
      expect(all.body.totalPages).to.equal(Math.ceil(all.body.total / 2));

      const maint = await request(app).get('/vehicles?status=maintenance').set(driver.auth).expect(200);
      expect(maint.body.data).to.not.be.empty;
      maint.body.data.forEach((v) => expect(v.status).to.equal('maintenance'));
    });

    it('requires a JWT (401 without one)', async () => {
      await request(app).get('/vehicles').expect(401);
    });
  });

  describe('PUT /vehicles/:id', () => {
    it('updates details and re-geocodes a new address', async () => {
      const v = await createVehicle();
      const res = await request(app)
        .put(`/vehicles/${v.id}`)
        .set(manager.auth)
        .send({ model: 'Ace Gold CNG', address: 'Aluva' })
        .expect(200);
      expect(res.body.vehicle.model).to.equal('Ace Gold CNG');
      expect(res.body.vehicle.position).to.deep.equal({ lat: 10.1076, lng: 76.3516 });
    });

    it('rejects an empty update and a clashing registration number', async () => {
      const a = await createVehicle();
      const b = await createVehicle();
      await request(app).put(`/vehicles/${a.id}`).set(admin.auth).send({}).expect(400);
      const res = await request(app)
        .put(`/vehicles/${a.id}`)
        .set(admin.auth)
        .send({ registrationNumber: b.registrationNumber })
        .expect(409);
      expect(res.body.error.code).to.equal('VEHICLE_ALREADY_EXISTS');
    });
  });
});
