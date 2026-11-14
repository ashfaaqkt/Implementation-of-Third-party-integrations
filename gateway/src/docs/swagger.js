/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/docs/swagger.js – OpenAPI 3.0 definition (swagger-jsdoc) and Swagger UI branding
 */
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const { config } = require('@fleet/shared');
const schemas = require('./schemas');

const err = (code, message, details) => ({ error: { code, message, ...(details ? { details } : {}) } });

/** Reusable error responses – each lists every error code it can carry. */
const responses = {
  BadRequest: {
    description: 'Invalid request – malformed JSON (INVALID_REQUEST), failed validation (VALIDATION_ERROR) or bad id (INVALID_ID).',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        examples: {
          validation: { value: err('VALIDATION_ERROR', 'Request validation failed', [{ field: 'lat', message: "'lat' must be less than or equal to 90" }]) },
          malformedJson: { value: err('INVALID_REQUEST', 'Malformed JSON in request body') },
        },
      },
    },
  },
  Unauthorized: {
    description: 'Missing API key (API_KEY_MISSING) or missing / invalid / expired JWT (TOKEN_MISSING, TOKEN_INVALID, TOKEN_EXPIRED, INVALID_CREDENTIALS).',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        examples: {
          apiKeyMissing: { value: err('API_KEY_MISSING', 'API key is required in the x-api-key header') },
          tokenMissing: { value: err('TOKEN_MISSING', 'Authorization header with Bearer token is required') },
          tokenExpired: { value: err('TOKEN_EXPIRED', 'Token has expired') },
        },
      },
    },
  },
  Forbidden: {
    description: 'Invalid API key (API_KEY_INVALID) or the JWT role is not allowed (INSUFFICIENT_ROLE).',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        examples: {
          apiKeyInvalid: { value: err('API_KEY_INVALID', 'API key is invalid') },
          insufficientRole: { value: err('INSUFFICIENT_ROLE', "Role 'driver' is not allowed. Required: admin") },
        },
      },
    },
  },
  NotFound: {
    description: 'Resource or route not found (VEHICLE_NOT_FOUND, USER_NOT_FOUND, NOTIFICATION_NOT_FOUND, TELEMETRY_NOT_FOUND, ADDRESS_NOT_FOUND, ROUTE_NOT_FOUND).',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: err('VEHICLE_NOT_FOUND', 'Vehicle 665f1c2e8b3a4d0012345678 not found'),
      },
    },
  },
  Conflict: {
    description: 'Duplicate resource (VEHICLE_ALREADY_EXISTS, EMAIL_ALREADY_REGISTERED).',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: err('VEHICLE_ALREADY_EXISTS', 'A vehicle with registration number KL-07-AB-1234 already exists'),
      },
    },
  },
  TooManyRequests: {
    description: 'Rate limit exceeded for this API key. Wait `Retry-After` seconds.',
    headers: {
      'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until the window resets' },
      'RateLimit-Limit': { schema: { type: 'integer' }, description: 'Requests allowed per window' },
      'RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Requests left in this window' },
      'RateLimit-Reset': { schema: { type: 'integer' }, description: 'Seconds until the window resets' },
    },
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: err('RATE_LIMIT_EXCEEDED', 'Too many requests for this API key. Try again in 900 seconds.', { retryAfterSeconds: 900 }),
      },
    },
  },
  BadGateway: {
    description: 'The external geolocation provider (Nominatim / Google Maps) failed.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: err('UPSTREAM_PROVIDER_ERROR', 'Geolocation provider (Nominatim) request failed', { provider: 'nominatim', status: 503 }),
      },
    },
  },
  ServiceUnavailable: {
    description: 'The backend service behind this route is down, refused the connection or timed out.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: err('SERVICE_UNAVAILABLE', 'vehicle-service is currently unavailable. Please try again later.', {
          service: 'vehicle-service',
          reason: 'ECONNREFUSED',
        }),
      },
    },
  },
};

const definition = {
  openapi: '3.0.3',
  info: {
    title: `Fleet Management System API – ${config.AUTHOR.author} (${config.AUTHOR.bitsId})`,
    version: '1.0.0',
    description: [
      `**${config.AUTHOR.project}**  `,
      `Author: **${config.AUTHOR.author}** · BITS ID: **${config.AUTHOR.bitsId}** · ${config.AUTHOR.course}`,
      '',
      'All endpoints are reached **through the API Gateway** (`/api/...`), which routes each prefix to its microservice:',
      '',
      '| Gateway route | Target service |',
      '|---|---|',
      '| `/api/users/*` | User Service |',
      '| `/api/vehicles/*` | Vehicle/Fleet Service |',
      '| `/api/telemetry/*` | Telemetry Service |',
      '| `/api/maps/*` | Geolocation Service |',
      '| `/api/notifications/*` | Notification Service |',
      '',
      '### Authentication',
      '1. **API key** – every `/api/*` request needs the `x-api-key` header (try `devkey123`). Missing → `401 API_KEY_MISSING`, wrong → `403 API_KEY_INVALID`.',
      '2. **JWT** – call `POST /api/users/login`, then click **Authorize** and paste the `token` into **BearerAuth**.',
      '',
      '### Roles (role-based access control)',
      '`admin` – everything · `fleet_manager` – manage vehicles & view notifications · `driver` – read vehicles, send telemetry, update own vehicle status.',
      'Each operation lists its allowed roles in its description and in the `x-roles` extension.',
      '',
      '### Rate limiting',
      'Per API key: 100 requests / 15 min (standard), 1000 (premium), 5 (demo key `demokey789`, for showing a 429). Responses carry `RateLimit-*` headers; when exceeded → `429` with `Retry-After`.',
      '',
      '### Errors',
      'Every error has the shape `{ "error": { "code", "message", "details" } }`.',
    ].join('\n'),
    contact: { name: config.AUTHOR.author },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'This API Gateway' }],
  tags: [
    { name: 'Gateway', description: 'Gateway health and information (no API key needed)' },
    { name: 'Users', description: 'User Service – registration, login, JWT – `/api/users/*`' },
    { name: 'Vehicles', description: 'Vehicle/Fleet Service – vehicles, status, nearby search – `/api/vehicles/*`' },
    { name: 'Telemetry', description: 'Telemetry Service – GPS & sensor data, critical events – `/api/telemetry/*`' },
    { name: 'Maps', description: 'Geolocation Service – OpenStreetMap Nominatim / Google Maps – `/api/maps/*`' },
    { name: 'Notifications', description: 'Notification Service – SMS (stub / Twilio sandbox) – `/api/notifications/*`' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Gateway API key, e.g. `devkey123`' },
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT from POST /api/users/login' },
    },
    schemas,
    responses,
    parameters: {
      VehicleId: {
        name: 'id', in: 'path', required: true, description: 'Vehicle id (MongoDB ObjectId)',
        schema: { type: 'string', pattern: '^[a-f0-9]{24}$' }, example: '665f1c2e8b3a4d0012345678',
      },
      Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
    },
  },
  security: [{ ApiKeyAuth: [] }],
};

function buildOpenApiSpec() {
  return swaggerJsdoc({ definition, apis: [path.join(__dirname, 'paths', '*.js')] });
}

/** Swagger UI branding: navy + amber top bar with the author's name (visible in screenshots). */
const swaggerUiOptions = {
  customSiteTitle: `Fleet Management API Docs – ${config.AUTHOR.author} (${config.AUTHOR.bitsId})`,
  swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: 'list', tryItOutEnabled: false },
  customCss: `
    body .swagger-ui .topbar { background-color: #1e293b !important; border-bottom: 4px solid #f59e0b; padding: 12px 0; }
    .swagger-ui .topbar .link { display: none; }
    .swagger-ui .topbar-wrapper::before {
      content: '🚚 Fleet Management System API  ·  ${config.AUTHOR.author}  ·  BITS ID ${config.AUTHOR.bitsId}';
      color: #fff; font: 600 17px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; letter-spacing: .2px;
    }
    .swagger-ui .topbar-wrapper::after {
      content: ''; width: 58px; height: 22px; margin-left: 10px; flex: none; border-radius: 4px;
      background: #fff url('/assets/bits-logo.svg') center / contain no-repeat; background-origin: content-box; padding: 2px 4px;
    }
    #swagger-ui::after {
      content: '© 2026 ${config.AUTHOR.author} · BITS ID ${config.AUTHOR.bitsId} · ${config.AUTHOR.course} · Released under the MIT License';
      display: block; margin-top: 24px; padding: 12px 16px 12px 96px; min-height: 22px;
      background:
        url('/assets/bits-logo.svg') 20px center / 62px 24px no-repeat,
        linear-gradient(#fff, #fff) 16px center / 70px 30px no-repeat,
        #1e293b;
      border-top: 3px solid #f59e0b;
      color: #cbd5e1; font: 12.5px/22px system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .swagger-ui .info .title { color: #1e293b; }
    .swagger-ui .info .title small.version-stamp { background: #f59e0b; }
    .swagger-ui .btn.authorize { color: #b45309; border-color: #f59e0b; }
    .swagger-ui .btn.authorize svg { fill: #b45309; }
    .swagger-ui .opblock-tag { border-bottom-color: #e2e8f0; }
    .swagger-ui .scheme-container { box-shadow: none; border-bottom: 1px solid #e2e8f0; }
  `,
};

module.exports = { buildOpenApiSpec, swaggerUiOptions, definition };
