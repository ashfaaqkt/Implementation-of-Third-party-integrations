/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/09-providers.flow.js – third-party provider adapters (Nominatim, Google Maps, Twilio) with nock
 */
const { expect } = require('chai');
const nock = require('nock');
const sinon = require('sinon');

const nominatim = require('../../services/geo-service/src/providers/nominatim');
const google = require('../../services/geo-service/src/providers/google');
const mockGeo = require('../../services/geo-service/src/providers/mock');
const { getProvider } = require('../../services/geo-service/src/providers');
const { haversineKm } = require('../../services/geo-service/src/haversine');
const twilio = require('../../services/notification-service/src/providers/twilio');
const stub = require('../../services/notification-service/src/providers/stub');
const { getSmsProvider } = require('../../services/notification-service/src/providers');
const { detectCriticalEvents } = require('../../services/telemetry-service/src/criticalEvents');

const ENV_KEYS = ['GEO_PROVIDER', 'GOOGLE_MAPS_API_KEY', 'SMS_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];

describe('Third-party provider adapters (mocked with nock)', () => {
  let savedEnv;
  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
    sinon.restore();
  });

  describe('OpenStreetMap Nominatim', () => {
    it('sends an identifying User-Agent and parses the first result', async () => {
      const scope = nock('https://nominatim.openstreetmap.org', { reqheaders: { 'user-agent': /FleetManagementSystem/ } })
        .get('/search')
        .query({ q: 'Infopark, Kochi', format: 'jsonv2', limit: '1' })
        .reply(200, [{ lat: '10.0098', lon: '76.3636', display_name: 'Infopark, Kakkanad' }]);
      expect(await nominatim.geocode('Infopark, Kochi')).to.deep.equal({ lat: 10.0098, lng: 76.3636, displayName: 'Infopark, Kakkanad' });
      expect(scope.isDone()).to.equal(true);
    });

    it('returns null when nothing matches and throws 502 on provider errors', async () => {
      nock('https://nominatim.openstreetmap.org').get('/search').query(true).reply(200, []);
      expect(await nominatim.geocode('zzzz')).to.equal(null);

      nock('https://nominatim.openstreetmap.org').get('/search').query(true).replyWithError({ code: 'ECONNRESET' });
      try {
        await nominatim.geocode('boom');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.status).to.equal(502);
        expect(err.details).to.include({ provider: 'nominatim', status: 'ECONNRESET' });
      }
    });

    it('reverse geocodes', async () => {
      nock('https://nominatim.openstreetmap.org').get('/reverse').query(true).reply(200, { display_name: 'MG Road', address: { city: 'Kochi' } });
      expect(await nominatim.reverse(9.96, 76.28)).to.deep.equal({ displayName: 'MG Road', address: { city: 'Kochi' } });
      nock('https://nominatim.openstreetmap.org').get('/reverse').query(true).reply(200, { error: 'Unable to geocode' });
      expect(await nominatim.reverse(0, 0)).to.equal(null);
    });
  });

  describe('Google Maps Geocoding (GEO_PROVIDER=google)', () => {
    it('is selected by GEO_PROVIDER and calls the Geocoding API with the key', async () => {
      process.env.GEO_PROVIDER = 'google';
      process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
      expect(getProvider().name).to.equal('google');
      nock('https://maps.googleapis.com')
        .get('/maps/api/geocode/json')
        .query({ address: 'Kozhikode', key: 'test-google-key' })
        .reply(200, { status: 'OK', results: [{ formatted_address: 'Kozhikode, Kerala', geometry: { location: { lat: 11.2588, lng: 75.7804 } } }] });
      expect(await google.geocode('Kozhikode')).to.deep.equal({ lat: 11.2588, lng: 75.7804, displayName: 'Kozhikode, Kerala' });
    });

    it('handles ZERO_RESULTS, API errors and a missing key', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'k';
      nock('https://maps.googleapis.com').get('/maps/api/geocode/json').query(true).reply(200, { status: 'ZERO_RESULTS', results: [] });
      expect(await google.geocode('nowhere')).to.equal(null);

      nock('https://maps.googleapis.com').get('/maps/api/geocode/json').query(true).reply(200, { status: 'REQUEST_DENIED' });
      const denied = await google.geocode('x').catch((e) => e);
      expect(denied.status).to.equal(502);

      nock('https://maps.googleapis.com').get('/maps/api/geocode/json').query(true).reply(500);
      expect((await google.reverse(1, 2).catch((e) => e)).status).to.equal(502);

      delete process.env.GOOGLE_MAPS_API_KEY;
      const missing = await google.geocode('x').catch((e) => e);
      expect(missing.message).to.contain('GOOGLE_MAPS_API_KEY');
    });

    it('reverse geocodes with latlng', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'k';
      nock('https://maps.googleapis.com').get('/maps/api/geocode/json').query({ latlng: '9.96,76.28', key: 'k' })
        .reply(200, { status: 'OK', results: [{ formatted_address: 'MG Road, Kochi', address_components: [] }] });
      expect((await google.reverse(9.96, 76.28)).displayName).to.equal('MG Road, Kochi');
    });

    it('falls back to Nominatim for an unknown provider name', () => {
      process.env.GEO_PROVIDER = 'bing';
      expect(getProvider().name).to.equal('nominatim');
    });
  });

  describe('Twilio sandbox (SMS_PROVIDER=twilio)', () => {
    const configure = () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACtest123';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_FROM_NUMBER = '+15005550006';
    };

    it('posts the message to the Twilio REST API with basic auth', async () => {
      configure();
      expect(getSmsProvider().name).to.equal('twilio');
      const scope = nock('https://api.twilio.com')
        .post('/2010-04-01/Accounts/ACtest123/Messages.json', (body) => body.To === '+919847000001' && body.From === '+15005550006' && body.Body === 'Hello')
        .basicAuth({ user: 'ACtest123', pass: 'secret' })
        .reply(201, { sid: 'SM123' });
      expect(await twilio.send({ to: '+919847000001', message: 'Hello' })).to.deep.equal({ providerMessageId: 'SM123' });
      expect(scope.isDone()).to.equal(true);
    });

    it('surfaces Twilio error messages', async () => {
      configure();
      nock('https://api.twilio.com').post(/Messages\.json$/).reply(400, { message: 'The number is unverified' });
      const err = await twilio.send({ to: '+919847000001', message: 'Hi' }).catch((e) => e);
      expect(err.message).to.equal('Twilio error: The number is unverified');
    });

    it('falls back to the stub when Twilio env vars are missing', () => {
      process.env.SMS_PROVIDER = 'twilio';
      delete process.env.TWILIO_ACCOUNT_SID;
      expect(getSmsProvider().name).to.equal('stub');
    });

    it('rejects with a clear message if called while unconfigured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      const err = await twilio.send({ to: '+919847000001', message: 'y' }).catch((e) => e);
      expect(err.message).to.contain('Twilio is not configured');
    });
  });

  describe('SMS stub', () => {
    it('returns a stub message id for normal numbers and fails for ...0000', async () => {
      const ok = await stub.send({ to: '+919847000001', message: 'hi', type: 'MANUAL' });
      expect(ok.providerMessageId).to.match(/^stub-[0-9a-f-]{36}$/);
      const err = await stub.send({ to: '+919812340000', message: 'hi', type: 'MANUAL' }).catch((e) => e);
      expect(err).to.be.instanceOf(Error);
    });

    it('fails randomly according to SMS_STUB_FAIL_RATE', async () => {
      process.env.SMS_STUB_FAIL_RATE = '0.5';
      sinon.stub(Math, 'random').returns(0.4);
      const err = await stub.send({ to: '+919847000001', message: 'hi', type: 'MANUAL' }).catch((e) => e);
      expect(err.message).to.contain('SMS_STUB_FAIL_RATE=0.5');
      Math.random.returns(0.6);
      expect(await stub.send({ to: '+919847000001', message: 'hi', type: 'MANUAL' })).to.have.property('providerMessageId');
      process.env.SMS_STUB_FAIL_RATE = '0';
    });
  });

  describe('helpers', () => {
    it('haversine distance MG Road → Kakkanad ≈ 8.32 km, and 0 for the same point', () => {
      expect(haversineKm({ lat: 9.9658, lng: 76.2856 }, { lat: 10.0159, lng: 76.3419 })).to.be.closeTo(8.32, 0.01);
      expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).to.equal(0);
    });

    it('mock geocoder picks the most specific place and reverse-geocodes to the nearest', async () => {
      expect((await mockGeo.geocode('Fort Kochi beach')).displayName).to.contain('Fort Kochi');
      expect((await mockGeo.geocode('Kochi')).displayName).to.contain('MG Road');
      expect(await mockGeo.geocode('Paris')).to.equal(null);
      expect((await mockGeo.reverse(11.25, 75.77)).displayName).to.contain('Kozhikode Beach');
    });

    it('critical event detection respects the thresholds', () => {
      expect(detectCriticalEvents({ batteryVoltage: 11.5, engineTemp: 110 })).to.deep.equal([]);
      expect(detectCriticalEvents({ batteryVoltage: 11.49 }).map((e) => e.event)).to.deep.equal(['LOW_BATTERY']);
      expect(detectCriticalEvents({ engineTemp: 110.1 }).map((e) => e.event)).to.deep.equal(['ENGINE_FAULT']);
      expect(detectCriticalEvents({ eventType: 'HARSH_BRAKING' })).to.deep.equal([]);
      expect(detectCriticalEvents({ eventType: 'EMERGENCY_STOP' })[0].detectedBy).to.equal('explicit');
    });
  });
});
