/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/01-auth.flow.js – Flow 1: user login and JWT token verification
 */
const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { SERVICES } = require('../helpers/setup');
const { resetDb, createUser } = require('../helpers/fixtures');

const app = SERVICES.user;

describe('Flow 1 – User login and JWT token verification', () => {
  const driver = { name: 'Test Driver', email: 'test.driver@fleet.local', phone: '+919847000050', password: 'Driver@123' };

  before(resetDb);

  describe('POST /users/register', () => {
    it('registers a driver (201) and never returns the password hash', async () => {
      const res = await request(app).post('/users/register').send(driver).expect(201);
      expect(res.body.user).to.include({ email: driver.email, role: 'driver', phone: driver.phone });
      expect(res.body.user).to.have.property('id');
      expect(res.body.user).to.not.have.any.keys('passwordHash', 'password');
    });

    it('rejects a duplicate email with 409 EMAIL_ALREADY_REGISTERED', async () => {
      const res = await request(app).post('/users/register').send(driver).expect(409);
      expect(res.body.error.code).to.equal('EMAIL_ALREADY_REGISTERED');
    });

    it('rejects invalid input with 400 VALIDATION_ERROR and field details', async () => {
      const res = await request(app)
        .post('/users/register')
        .send({ name: 'X', email: 'not-an-email', phone: '98470', password: 'short' })
        .expect(400);
      expect(res.body.error.code).to.equal('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d) => d.field);
      expect(fields).to.include.members(['name', 'email', 'phone', 'password']);
    });

    it('does not let an anonymous caller self-register as admin (403)', async () => {
      const res = await request(app)
        .post('/users/register')
        .send({ ...driver, email: 'sneaky@fleet.local', role: 'admin' })
        .expect(403);
      expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
    });

    it('lets an admin create a fleet_manager account', async () => {
      const admin = await createUser('admin');
      const res = await request(app)
        .post('/users/register')
        .set(admin.auth)
        .send({ ...driver, email: 'new.manager@fleet.local', role: 'fleet_manager' })
        .expect(201);
      expect(res.body.user.role).to.equal('fleet_manager');
    });
  });

  describe('POST /users/login', () => {
    let token;

    it('returns a Bearer JWT with sub, role and exp claims', async () => {
      const res = await request(app).post('/users/login').send({ email: driver.email, password: driver.password }).expect(200);
      expect(res.body).to.include({ tokenType: 'Bearer', expiresIn: '1h' });
      token = res.body.token;

      const claims = jwt.verify(token, process.env.JWT_SECRET);
      expect(claims.sub).to.equal(res.body.user.id);
      expect(claims.role).to.equal('driver');
      expect(claims.email).to.equal(driver.email);
      expect(claims.exp - claims.iat).to.equal(3600);
      expect(claims.exp * 1000).to.be.greaterThan(Date.now());
    });

    it('is case-insensitive on email', async () => {
      await request(app).post('/users/login').send({ email: driver.email.toUpperCase(), password: driver.password }).expect(200);
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app).post('/users/login').send({ email: driver.email, password: 'wrong-password' }).expect(401);
      expect(res.body.error.code).to.equal('INVALID_CREDENTIALS');
    });

    it('rejects an unknown email with the same 401 (no user enumeration)', async () => {
      const res = await request(app).post('/users/login').send({ email: 'nobody@fleet.local', password: 'whatever1' }).expect(401);
      expect(res.body.error.code).to.equal('INVALID_CREDENTIALS');
    });

    it('GET /users/me works with the valid token', async () => {
      const res = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.user.email).to.equal(driver.email);
    });

    it('GET /users/verify returns valid: true with the claims', async () => {
      const res = await request(app).get('/users/verify').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.valid).to.equal(true);
      expect(res.body.claims).to.include({ role: 'driver', email: driver.email });
      expect(new Date(res.body.expiresAt).getTime()).to.be.greaterThan(Date.now());
    });

    it('rejects a missing token with 401 TOKEN_MISSING', async () => {
      const res = await request(app).get('/users/me').expect(401);
      expect(res.body.error.code).to.equal('TOKEN_MISSING');
    });

    it('rejects a non-Bearer Authorization header with 401 TOKEN_INVALID', async () => {
      const res = await request(app).get('/users/me').set('Authorization', `Basic ${token}`).expect(401);
      expect(res.body.error.code).to.equal('TOKEN_INVALID');
    });

    it('rejects a tampered token (payload changed) with 401 TOKEN_INVALID', async () => {
      const [header, payload, signature] = token.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      const forged = Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url');
      const res = await request(app).get('/users/verify').set('Authorization', `Bearer ${header}.${forged}.${signature}`).expect(401);
      expect(res.body.error.code).to.equal('TOKEN_INVALID');
    });

    it('rejects a token signed with another secret with 401 TOKEN_INVALID', async () => {
      const bad = jwt.sign({ sub: 'x', role: 'admin' }, 'some-other-secret');
      const res = await request(app).get('/users/verify').set('Authorization', `Bearer ${bad}`).expect(401);
      expect(res.body.error.code).to.equal('TOKEN_INVALID');
    });

    it('rejects an expired token with 401 TOKEN_EXPIRED', async () => {
      const expired = jwt.sign(
        { sub: 'x', role: 'driver', exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET
      );
      const res = await request(app).get('/users/me').set('Authorization', `Bearer ${expired}`).expect(401);
      expect(res.body.error.code).to.equal('TOKEN_EXPIRED');
    });
  });

  describe('User administration', () => {
    it('admin can list users (GET /users), a driver cannot (403)', async () => {
      const admin = await createUser('admin');
      const drv = await createUser('driver');
      const res = await request(app).get('/users').set(admin.auth).expect(200);
      expect(res.body.total).to.be.at.least(2);
      await request(app).get('/users').set(drv.auth).expect(403);
    });

    it('a driver may read their own profile but not someone else\'s', async () => {
      const a = await createUser('driver');
      const b = await createUser('driver');
      await request(app).get(`/users/${a.user.id}`).set(a.auth).expect(200);
      const res = await request(app).get(`/users/${b.user.id}`).set(a.auth).expect(403);
      expect(res.body.error.code).to.equal('INSUFFICIENT_ROLE');
    });

    it('internal contacts endpoint requires the internal service token', async () => {
      await request(app).get('/users/internal/contacts?roles=admin').expect(401);
      await request(app).get('/users/internal/contacts?roles=admin').set('x-internal-token', 'wrong').expect(403);
      const res = await request(app)
        .get('/users/internal/contacts?roles=admin')
        .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN)
        .expect(200);
      expect(res.body.data).to.be.an('array').that.is.not.empty;
      res.body.data.forEach((c) => expect(c.role).to.equal('admin'));
    });
  });
});
