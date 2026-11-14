/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/flows/08-swagger-docs.flow.js – checks the OpenAPI spec covers every route group, auth scheme and status code
 */
const { expect } = require('chai');
const { buildOpenApiSpec } = require('../../gateway/src/docs/swagger');

describe('Swagger / OpenAPI documentation', () => {
  const spec = buildOpenApiSpec();
  const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, op]) => ({ path, method, op }))
  );

  it('is OpenAPI 3.0 with the author in the title and contact', () => {
    expect(spec.openapi).to.match(/^3\.0\./);
    expect(spec.info.title).to.equal('Fleet Management System API – Ashfaaq Feroz Muhammad (2023EBCS005)');
    expect(spec.info.contact.name).to.equal('Ashfaaq Feroz Muhammad');
    expect(spec.info.description).to.contain('Third-party Integrations, API Gateway');
  });

  it('defines both security schemes: ApiKeyAuth (x-api-key) and BearerAuth (JWT)', () => {
    expect(spec.components.securitySchemes.ApiKeyAuth).to.include({ type: 'apiKey', in: 'header', name: 'x-api-key' });
    expect(spec.components.securitySchemes.BearerAuth).to.include({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  });

  it('documents every gateway route group', () => {
    ['/api/users', '/api/vehicles', '/api/telemetry', '/api/maps', '/api/notifications'].forEach((prefix) => {
      expect(Object.keys(spec.paths).some((p) => p.startsWith(prefix)), prefix).to.equal(true);
    });
  });

  it('documents every implemented endpoint', () => {
    const expected = [
      'post /api/users/register', 'post /api/users/login', 'get /api/users/me', 'get /api/users/verify', 'get /api/users', 'get /api/users/{id}',
      'post /api/vehicles', 'get /api/vehicles', 'get /api/vehicles/nearby', 'get /api/vehicles/{id}', 'put /api/vehicles/{id}',
      'delete /api/vehicles/{id}', 'patch /api/vehicles/{id}/status',
      'post /api/telemetry', 'get /api/telemetry/{vehicleId}', 'get /api/telemetry/{vehicleId}/latest',
      'get /api/maps/geocode', 'get /api/maps/reverse', 'get /api/maps/nearby', 'get /api/maps/distance',
      'post /api/notifications/sms', 'post /api/notifications/notify', 'get /api/notifications',
      'get /api/notifications/stats', 'get /api/notifications/{id}',
      'get /health',
    ];
    const documented = operations.map((o) => `${o.method} ${o.path}`);
    expect(documented).to.include.members(expected);
  });

  it('covers all required status codes: 200 201 400 401 403 404 409 429 502 503', () => {
    const codes = new Set(operations.flatMap((o) => Object.keys(o.op.responses)));
    ['200', '201', '400', '401', '403', '404', '409', '429', '502', '503'].forEach((c) => expect(codes.has(c), c).to.equal(true));
  });

  it('every operation has a tag, a summary, x-roles and at least one response', () => {
    operations.forEach(({ path, method, op }) => {
      const label = `${method.toUpperCase()} ${path}`;
      expect(op.tags, label).to.be.an('array').that.is.not.empty;
      expect(op.summary, label).to.be.a('string');
      expect(op['x-roles'], label).to.be.an('array').that.is.not.empty;
      expect(Object.keys(op.responses), label).to.not.be.empty;
    });
  });

  it('every /api operation except login/register requires both the API key and a JWT', () => {
    operations
      .filter((o) => o.path.startsWith('/api/') && !/login|register|\{unknown\}/.test(o.path))
      .forEach(({ path, method, op }) => {
        expect(op.security, `${method} ${path}`).to.deep.include({ ApiKeyAuth: [], BearerAuth: [] });
      });
  });

  it('every request body has an example', () => {
    operations.filter((o) => o.op.requestBody).forEach(({ path, method, op }) => {
      const media = op.requestBody.content['application/json'];
      expect(Boolean(media.example || media.examples), `${method} ${path}`).to.equal(true);
    });
  });

  it('defines the reusable schemas the brief asks for', () => {
    ['User', 'LoginRequest', 'AuthResponse', 'Vehicle', 'VehicleInput', 'StatusUpdate', 'Telemetry', 'Notification', 'GeoResult', 'NearbyVehicle', 'Error']
      .forEach((name) => expect(spec.components.schemas, name).to.have.property(name));
  });

  it('every $ref points at something that exists', () => {
    const refs = JSON.stringify(spec).match(/"\$ref":"#\/components\/[^"]+"/g) || [];
    refs.forEach((raw) => {
      const ref = raw.slice(8, -1).replace('#/', '').split('/');
      const target = ref.reduce((node, key) => (node ? node[key] : undefined), spec);
      expect(target, raw).to.not.equal(undefined);
    });
  });
});
