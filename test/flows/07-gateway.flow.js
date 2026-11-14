/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/07-gateway.flow.js – Flow 7: API Gateway routing, API key verification, rate limiting and errors
 */
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { createGateway } = require('../../gateway/src/app');
const { buildRoutes, parseApiKeys } = require('../../gateway/src/config');
const { resetDb, createUser } = require('../helpers/fixtures');

/** A tiny fake backend that echoes what it received, so we can see exactly what the gateway forwarded. */
function fakeService(name) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ service: name, status: 'ok', db: 'connected' }));
  app.get(/\/slow$/, (_req, res) => setTimeout(() => res.json({ late: true }), 1500));
  app.get(/\/teapot$/, (_req, res) => res.status(418).set('x-custom', 'kept').json({ error: { code: 'TEAPOT', message: "I'm a teapot" } }));
  app.all('*', (req, res) => {
    res.json({ service: name, method: req.method, path: req.originalUrl, headers: req.headers, body: req.body });
  });
  return app;
}

const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const urlOf = (server) => `http://127.0.0.1:${server.address().port}`;

/** Reserve a port that nothing listens on (start a server, then close it). */
async function deadUrl() {
  const s = await listen(express());
  const url = urlOf(s);
  await new Promise((r) => s.close(r));
  return url;
}

describe('Flow 7 – API Gateway: API keys, routing, rate limiting, errors', () => {
  const KEY = { 'x-api-key': 'devkey123' };
  const upstreams = {};
  let targets;
  let gateway;

  before(async () => {
    for (const key of ['user', 'vehicle', 'telemetry', 'geo', 'notification']) {
      // eslint-disable-next-line no-await-in-loop
      upstreams[key] = await listen(fakeService(`${key}-fake`));
    }
    targets = Object.fromEntries(Object.entries(upstreams).map(([k, s]) => [k, urlOf(s)]));
    gateway = createGateway({ routes: buildRoutes(targets), proxyTimeoutMs: 500 });
  });

  after(async () => {
    await Promise.all(Object.values(upstreams).map((s) => new Promise((r) => s.close(r))));
  });

  describe('public endpoints (no API key needed)', () => {
    it('GET /health reports gateway + every downstream service, with author info', async () => {
      const res = await request(gateway).get('/health').expect(200);
      expect(res.body).to.include({ author: 'Ashfaaq Feroz Muhammad', bitsId: '2023EBCS005', status: 'ok' });
      expect(res.body.project).to.contain('Fleet Management System');
      expect(Object.keys(res.body.services)).to.have.members([
        'user-service', 'vehicle-service', 'telemetry-service', 'geo-service', 'notification-service',
      ]);
      Object.values(res.body.services).forEach((s) => expect(s.status).to.equal('up'));
    });

    it('GET / shows the route table and author', async () => {
      const res = await request(gateway).get('/').expect(200);
      expect(res.body).to.include({ author: 'Ashfaaq Feroz Muhammad', bitsId: '2023EBCS005' });
      expect(res.body.routes).to.have.length(5);
    });

    it('Swagger UI (/api-docs), the raw spec (/api-docs.json) and /map are exempt from the API key', async () => {
      const docs = await request(gateway).get('/api-docs/').expect(200);
      expect(docs.text).to.contain('Ashfaaq Feroz Muhammad (2023EBCS005)');
      const spec = await request(gateway).get('/api-docs.json').expect(200);
      expect(spec.body.openapi).to.match(/^3\.0/);
      const map = await request(gateway).get('/map').expect(200);
      expect(map.text).to.contain('Developed by <strong>Ashfaaq Feroz Muhammad</strong>');
    });

    it('serves the BITS Pilani logo used by /map and Swagger UI without an API key', async () => {
      const logo = await request(gateway).get('/assets/bits-logo.svg').buffer(true).parse((res, cb) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => cb(null, body));
      }).expect(200);
      expect(logo.headers['content-type']).to.match(/^image\/svg\+xml/);
      expect(logo.body).to.contain('<svg');
      const map = await request(gateway).get('/map').expect(200);
      expect(map.text).to.contain('src="/assets/bits-logo.svg"').and.to.contain('© 2026 Ashfaaq Feroz Muhammad');
      const docs = await request(gateway).get('/api-docs/').expect(200);
      expect(docs.text).to.contain("url('/assets/bits-logo.svg')");
    });

    it('every response carries x-developed-by and x-request-id headers', async () => {
      const res = await request(gateway).get('/health');
      expect(res.headers['x-developed-by']).to.equal('Ashfaaq Feroz Muhammad (2023EBCS005)');
      expect(res.headers['x-request-id']).to.match(/^[0-9a-f-]{36}$/);
    });

    it('/health reports degraded when a service is down', async () => {
      const gw = createGateway({ routes: buildRoutes({ ...targets, telemetry: await deadUrl() }) });
      const res = await request(gw).get('/health').expect(200);
      expect(res.body.status).to.equal('degraded');
      expect(res.body.services['telemetry-service'].status).to.equal('down');
    });
  });

  describe('API key verification', () => {
    it('missing x-api-key → 401 API_KEY_MISSING (request never reaches a service)', async () => {
      const res = await request(gateway).get('/api/vehicles').expect(401);
      expect(res.body.error.code).to.equal('API_KEY_MISSING');
      expect(res.body.service).to.equal(undefined);
    });

    it('wrong x-api-key → 403 API_KEY_INVALID', async () => {
      const res = await request(gateway).get('/api/vehicles').set('x-api-key', 'not-a-real-key').expect(403);
      expect(res.body.error.code).to.equal('API_KEY_INVALID');
    });

    it('valid standard and premium keys are accepted', async () => {
      await request(gateway).get('/api/vehicles').set(KEY).expect(200);
      await request(gateway).get('/api/vehicles').set('x-api-key', 'partnerkey456').expect(200);
    });

    it('parses API_KEYS "key:tier[:name]" entries', () => {
      const keys = parseApiKeys('a1:standard, b2:premium:Partner App ,, c3');
      expect(keys.get('a1')).to.include({ tier: 'standard' });
      expect(keys.get('b2')).to.include({ tier: 'premium', name: 'Partner App' });
      expect(keys.get('c3')).to.include({ tier: 'standard' });
      expect(keys.size).to.equal(3);
    });
  });

  describe('routing and forwarding', () => {
    const table = [
      ['/api/users/login', 'user-fake', '/users/login'],
      ['/api/vehicles/abc?status=active', 'vehicle-fake', '/vehicles/abc?status=active'],
      ['/api/telemetry/123/latest', 'telemetry-fake', '/telemetry/123/latest'],
      ['/api/maps/geocode?address=Kochi', 'geo-fake', '/maps/geocode?address=Kochi'],
      ['/api/notifications/stats', 'notification-fake', '/notifications/stats'],
      ['/api/vehicles', 'vehicle-fake', '/vehicles'],
    ];
    table.forEach(([gatewayPath, service, targetPath]) => {
      it(`${gatewayPath} → ${service} ${targetPath}`, async () => {
        const res = await request(gateway).get(gatewayPath).set(KEY).expect(200);
        expect(res.body.service).to.equal(service);
        expect(res.body.path).to.equal(targetPath);
      });
    });

    it('strips x-api-key (and spoofed x-internal-token), adds x-request-id and x-forwarded-by', async () => {
      const res = await request(gateway)
        .get('/api/vehicles')
        .set(KEY)
        .set('x-internal-token', 'spoofed-by-client')
        .expect(200);
      expect(res.body.headers).to.not.have.property('x-api-key');
      expect(res.body.headers).to.not.have.property('x-internal-token');
      expect(res.body.headers['x-forwarded-by']).to.equal('fleet-gateway');
      expect(res.body.headers['x-request-id']).to.match(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-request-id']).to.equal(res.body.headers['x-request-id']);
      expect(res.headers['x-served-by']).to.equal('vehicle-service');
    });

    it("keeps the client's own x-request-id", async () => {
      const res = await request(gateway).get('/api/vehicles').set(KEY).set('x-request-id', 'demo-req-42').expect(200);
      expect(res.body.headers['x-request-id']).to.equal('demo-req-42');
      expect(res.headers['x-request-id']).to.equal('demo-req-42');
    });

    it('forwards the Authorization header and JSON body unchanged', async () => {
      const body = { registrationNumber: 'KL-07-AB-1234', nested: { a: [1, 2, 3] }, unicode: 'കൊച്ചി' };
      const res = await request(gateway)
        .post('/api/vehicles')
        .set(KEY)
        .set('Authorization', 'Bearer some.jwt.token')
        .send(body)
        .expect(200);
      expect(res.body.method).to.equal('POST');
      expect(res.body.headers.authorization).to.equal('Bearer some.jwt.token');
      expect(res.body.body).to.deep.equal(body);
    });

    it('relays upstream error statuses and headers transparently', async () => {
      const res = await request(gateway).get('/api/vehicles/teapot').set(KEY).expect(418);
      expect(res.body.error.code).to.equal('TEAPOT');
      expect(res.headers['x-custom']).to.equal('kept');
    });

    it('blocks service-internal routes from outside (404)', async () => {
      const res = await request(gateway).patch('/api/vehicles/internal/abc/location').set(KEY).send({}).expect(404);
      expect(res.body.error.code).to.equal('ROUTE_NOT_FOUND');
    });
  });

  describe('error handling', () => {
    it('unknown route → 404 ROUTE_NOT_FOUND (inside and outside /api)', async () => {
      const a = await request(gateway).get('/api/spaceships').set(KEY).expect(404);
      expect(a.body.error.code).to.equal('ROUTE_NOT_FOUND');
      const b = await request(gateway).get('/does-not-exist').expect(404);
      expect(b.body.error.code).to.equal('ROUTE_NOT_FOUND');
    });

    it('malformed JSON → 400 INVALID_REQUEST', async () => {
      const res = await request(gateway).post('/api/users/login').set(KEY).set('Content-Type', 'application/json').send('{"email": ').expect(400);
      expect(res.body.error.code).to.equal('INVALID_REQUEST');
    });

    it('payload over 100 kb → 413 PAYLOAD_TOO_LARGE', async () => {
      const res = await request(gateway).post('/api/telemetry').set(KEY).send({ blob: 'x'.repeat(120 * 1024) }).expect(413);
      expect(res.body.error.code).to.equal('PAYLOAD_TOO_LARGE');
    });

    it('a stopped backend service → 503 SERVICE_UNAVAILABLE naming the service', async () => {
      const gw = createGateway({ routes: buildRoutes({ ...targets, vehicle: await deadUrl() }) });
      const res = await request(gw).get('/api/vehicles').set(KEY).expect(503);
      expect(res.body.error.code).to.equal('SERVICE_UNAVAILABLE');
      expect(res.body.error.details).to.include({ service: 'vehicle-service', reason: 'ECONNREFUSED' });
      // other routes keep working
      await request(gw).get('/api/users/me').set(KEY).expect(200);
    });

    it('a backend that times out → 503 SERVICE_UNAVAILABLE', async () => {
      const res = await request(gateway).get('/api/maps/slow').set(KEY).expect(503);
      expect(res.body.error.code).to.equal('SERVICE_UNAVAILABLE');
      expect(res.body.error.details.service).to.equal('geo-service');
    });
  });

  describe('rate limiting', () => {
    let limited;
    beforeEach(() => {
      limited = createGateway({ routes: buildRoutes(targets), rateLimit: { windowMs: 60000, max: 3, maxPremium: 6 } });
    });

    it('allows N requests, then returns 429 with Retry-After and RateLimit-* headers', async () => {
      const remaining = [];
      for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(limited).get('/api/vehicles').set(KEY).expect(200);
        expect(res.headers['ratelimit-limit']).to.equal('3');
        remaining.push(Number(res.headers['ratelimit-remaining']));
      }
      expect(remaining).to.deep.equal([2, 1, 0]);

      const blocked = await request(limited).get('/api/vehicles').set(KEY).expect(429);
      expect(blocked.body.error.code).to.equal('RATE_LIMIT_EXCEEDED');
      expect(Number(blocked.headers['retry-after'])).to.be.within(1, 60);
      expect(blocked.headers['ratelimit-remaining']).to.equal('0');
      expect(blocked.headers['x-developed-by']).to.equal('Ashfaaq Feroz Muhammad (2023EBCS005)');
    });

    it('counts each API key separately and gives premium keys a higher limit', async () => {
      for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await request(limited).get('/api/vehicles').set(KEY).expect(200);
      }
      await request(limited).get('/api/vehicles').set(KEY).expect(429);

      const premium = { 'x-api-key': 'partnerkey456' };
      for (let i = 0; i < 6; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(limited).get('/api/vehicles').set(premium).expect(200);
        expect(res.headers['ratelimit-limit']).to.equal('6');
      }
      await request(limited).get('/api/vehicles').set(premium).expect(429);
    });

    it('the demo tier uses RATE_LIMIT_MAX_DEMO (tiny limit for live demos)', async () => {
      const demo = createGateway({ routes: buildRoutes(targets), rateLimit: { windowMs: 60000, max: 100, maxDemo: 2 } });
      const key = { 'x-api-key': 'demokey789' };
      await request(demo).get('/api/vehicles').set(key).expect(200);
      await request(demo).get('/api/vehicles').set(key).expect(200);
      await request(demo).get('/api/vehicles').set(key).expect(429);
      await request(demo).get('/api/vehicles').set(KEY).expect(200); // other keys unaffected
    });

    it('/health is never rate limited', async () => {
      for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await request(limited).get('/health').expect(200);
      }
    });
  });

  describe('end-to-end through the real services', () => {
    it('logs in via /api/users/login on the real User Service and uses the JWT on /api/users/verify', async () => {
      await resetDb();
      const { user } = await createUser('admin', { email: 'gw.admin@fleet.local' });
      const gw = createGateway({ routes: buildRoutes() }); // real service URLs from the test setup
      const login = await request(gw)
        .post('/api/users/login')
        .set(KEY)
        .send({ email: 'gw.admin@fleet.local', password: 'Password@123' })
        .expect(200);
      expect(login.headers['x-served-by']).to.equal('user-service');
      const verify = await request(gw).get('/api/users/verify').set(KEY).set('Authorization', `Bearer ${login.body.token}`).expect(200);
      expect(verify.body.claims.sub).to.equal(user.id);
    });
  });
});
