/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/06-nearby.flow.js – Flow 6: nearby vehicle search using mocked geolocation services
 */
const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser, createVehicle, GeoCache } = require('../helpers/fixtures');
const { haversineKm } = require('../../services/geo-service/src/haversine');

const vehicles = SERVICES.vehicle;
const geo = SERVICES.geo;
const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Search centre: MG Road, Kochi
const CENTER = { lat: 9.9658, lng: 76.2856 };
const PLACES = {
  mgRoad: { lat: 9.9658, lng: 76.2856 }, // 0 km
  vyttila: { lat: 9.9674, lng: 76.3185 }, // ≈ 3.6 km
  kakkanad: { lat: 10.0159, lng: 76.3419 }, // ≈ 8.32 km
  aluva: { lat: 10.1076, lng: 76.3516 }, // ≈ 17.5 km
  kozhikode: { lat: 11.2588, lng: 75.7804 }, // ≈ 154 km
};

describe('Flow 6 – Nearby vehicle search using mocked geolocation services', () => {
  let auth;
  const created = {};

  before(async () => {
    await resetDb();
    ({ auth } = await createUser('fleet_manager'));
    for (const [name, pos] of Object.entries(PLACES)) {
      // eslint-disable-next-line no-await-in-loop
      created[name] = await createVehicle({ registrationNumber: `KL-NEAR-${name.toUpperCase()}`, ...pos, status: name === 'vyttila' ? 'idle' : 'active' });
    }
    // A vehicle without any location must simply be ignored.
    await createVehicle({ registrationNumber: 'KL-NEAR-NOLOC', location: undefined });
  });

  afterEach(() => {
    process.env.GEO_PROVIDER = 'mock';
  });

  describe('GET /vehicles/nearby ($geoNear)', () => {
    it('returns only vehicles within the radius, nearest first, with a correct distanceKm', async () => {
      const res = await request(vehicles).get('/vehicles/nearby').query({ ...CENTER, radiusKm: 10 }).set(auth).expect(200);

      expect(res.body).to.include({ radiusKm: 10, count: 3 });
      expect(res.body.data.map((v) => v.registrationNumber)).to.deep.equal(['KL-NEAR-MGROAD', 'KL-NEAR-VYTTILA', 'KL-NEAR-KAKKANAD']);

      res.body.data.forEach((v) => {
        const expected = haversineKm(CENTER, v.position);
        expect(v.distanceKm).to.be.closeTo(expected, 0.01);
        expect(v.distanceKm).to.be.at.most(10);
        expect(v).to.not.have.property('statusHistory');
      });
      const distances = res.body.data.map((v) => v.distanceKm);
      expect(distances).to.deep.equal([...distances].sort((a, b) => a - b));
      expect(distances[0]).to.equal(0);
    });

    it('a smaller radius excludes farther vehicles', async () => {
      const res = await request(vehicles).get('/vehicles/nearby').query({ ...CENTER, radiusKm: 5 }).set(auth).expect(200);
      expect(res.body.data.map((v) => v.registrationNumber)).to.deep.equal(['KL-NEAR-MGROAD', 'KL-NEAR-VYTTILA']);
    });

    it('a large radius reaches Kozhikode (~154 km)', async () => {
      const res = await request(vehicles).get('/vehicles/nearby').query({ ...CENTER, radiusKm: 200 }).set(auth).expect(200);
      expect(res.body.count).to.equal(5);
      const far = res.body.data[4];
      expect(far.registrationNumber).to.equal('KL-NEAR-KOZHIKODE');
      expect(far.distanceKm).to.be.closeTo(haversineKm(CENTER, PLACES.kozhikode), 0.05);
    });

    it('can filter by status', async () => {
      const res = await request(vehicles).get('/vehicles/nearby').query({ ...CENTER, radiusKm: 10, status: 'idle' }).set(auth).expect(200);
      expect(res.body.data.map((v) => v.registrationNumber)).to.deep.equal(['KL-NEAR-VYTTILA']);
    });

    it('defaults the radius to 5 km', async () => {
      const res = await request(vehicles).get('/vehicles/nearby').query(CENTER).set(auth).expect(200);
      expect(res.body.radiusKm).to.equal(5);
    });

    it('rejects invalid coordinates and radius with 400', async () => {
      for (const query of [
        { lat: 95, lng: 76.28 },
        { lat: 9.96, lng: 200 },
        { lat: 'abc', lng: 76.28 },
        { lat: 9.96 },
        { lat: 9.96, lng: 76.28, radiusKm: -1 },
        { lat: 9.96, lng: 76.28, radiusKm: 1000 },
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(vehicles).get('/vehicles/nearby').query(query).set(auth).expect(400);
        expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      }
    });
  });

  describe('GET /maps/nearby (Geolocation Service → Vehicle Service)', () => {
    it('geocodes an address with the mock provider and returns nearby vehicles', async () => {
      const res = await request(geo).get('/maps/nearby').query({ address: 'Vyttila, Kochi', radiusKm: 4 }).set(auth).expect(200);
      expect(res.body.center).to.include({ lat: 9.9674, lng: 76.3185 });
      expect(res.body.center.displayName).to.contain('Vyttila');
      expect(res.body.data[0].registrationNumber).to.equal('KL-NEAR-VYTTILA');
      expect(res.body.data.map((v) => v.registrationNumber)).to.include('KL-NEAR-MGROAD');
    });

    it('works with a mocked Nominatim response (nock)', async () => {
      process.env.GEO_PROVIDER = 'nominatim';
      nock(NOMINATIM)
        .get('/search')
        .query(true)
        .reply(200, [{ lat: String(PLACES.kakkanad.lat), lon: String(PLACES.kakkanad.lng), display_name: 'Kakkanad, Kochi' }]);
      const res = await request(geo).get('/maps/nearby').query({ address: 'Kakkanad Junction', radiusKm: 1 }).set(auth).expect(200);
      expect(res.body.data.map((v) => v.registrationNumber)).to.deep.equal(['KL-NEAR-KAKKANAD']);
    });

    it('accepts coordinates directly', async () => {
      const res = await request(geo).get('/maps/nearby').query({ ...CENTER, radiusKm: 5 }).set(auth).expect(200);
      expect(res.body.count).to.equal(2);
    });

    it('requires lat+lng together or an address (400)', async () => {
      await request(geo).get('/maps/nearby').query({ lat: 9.9 }).set(auth).expect(400);
      await request(geo).get('/maps/nearby').query({ radiusKm: 3 }).set(auth).expect(400);
    });

    it('returns 503 when the Vehicle Service is unavailable', async () => {
      const original = process.env.VEHICLE_SERVICE_URL;
      process.env.VEHICLE_SERVICE_URL = 'http://127.0.0.1:1';
      try {
        const res = await request(geo).get('/maps/nearby').query(CENTER).set(auth).expect(503);
        expect(res.body.error.code).to.equal('SERVICE_UNAVAILABLE');
      } finally {
        process.env.VEHICLE_SERVICE_URL = original;
      }
    });
  });

  describe('geocoding, caching, reverse and distance', () => {
    it('caches geocode results in MongoDB so the provider is called only once', async () => {
      process.env.GEO_PROVIDER = 'nominatim';
      const scope = nock(NOMINATIM).get('/search').query(true).once()
        .reply(200, [{ lat: '9.9658', lon: '76.2856', display_name: 'MG Road, Kochi' }]);

      const first = await request(geo).get('/maps/geocode').query({ address: 'MG Road,  KOCHI ' }).set(auth).expect(200);
      const second = await request(geo).get('/maps/geocode').query({ address: 'mg road, kochi' }).set(auth).expect(200);

      expect(scope.isDone()).to.equal(true);
      expect(first.body).to.include({ lat: 9.9658, lng: 76.2856, cached: false, provider: 'nominatim' });
      expect(second.body).to.include({ lat: 9.9658, lng: 76.2856, cached: true });
      const entry = await GeoCache.findOne({ key: 'nominatim|mg road, kochi' });
      expect(entry.hits).to.equal(1);
    });

    it('unknown address → 404 ADDRESS_NOT_FOUND; provider error → 502', async () => {
      const miss = await request(geo).get('/maps/geocode').query({ address: 'Atlantis' }).set(auth).expect(404);
      expect(miss.body.error.code).to.equal('ADDRESS_NOT_FOUND');

      process.env.GEO_PROVIDER = 'nominatim';
      nock(NOMINATIM).get('/search').query(true).reply(503, 'Service Unavailable');
      const fail = await request(geo).get('/maps/geocode').query({ address: 'Some new place' }).set(auth).expect(502);
      expect(fail.body.error.code).to.equal('UPSTREAM_PROVIDER_ERROR');
      expect(fail.body.error.details).to.include({ provider: 'nominatim', status: 503 });
    });

    it('reverse geocodes coordinates', async () => {
      const res = await request(geo).get('/maps/reverse').query(PLACES.kakkanad).set(auth).expect(200);
      expect(res.body.displayName).to.contain('Kakkanad');
    });

    it('computes the haversine distance between two points', async () => {
      const res = await request(geo).get('/maps/distance').query({ from: '9.9658,76.2856', to: '10.0159,76.3419' }).set(auth).expect(200);
      expect(res.body.distanceKm).to.be.closeTo(8.32, 0.01);
      expect(res.body.method).to.equal('haversine');
      await request(geo).get('/maps/distance').query({ from: '91,0', to: '0,0' }).set(auth).expect(400);
      await request(geo).get('/maps/distance').query({ from: 'abc', to: '0,0' }).set(auth).expect(400);
    });

    it('requires authentication', async () => {
      await request(geo).get('/maps/geocode').query({ address: 'Kochi' }).expect(401);
    });
  });
});
