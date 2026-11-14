/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/app.js – builds the Express API Gateway (routing, API keys, rate limiting, docs, map)
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const { config, ApiError, notFoundHandler, errorHandler } = require('@fleet/shared');

const { loadGatewayConfig } = require('./config');
const { requestContext, accessLogger } = require('./middleware/requestContext');
const { apiKeyAuth } = require('./middleware/apiKey');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { createServiceProxy } = require('./proxy');
const { buildOpenApiSpec, swaggerUiOptions } = require('./docs/swagger');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');

/** Ping every downstream service's /health (short timeout) for GET /health. */
async function checkServices(routes) {
  const results = await Promise.all(
    routes.map(async (route) => {
      const started = Date.now();
      try {
        const { data } = await axios.get(`${route.target}/health`, { timeout: 1500 });
        return [route.name, { status: 'up', db: data.db, latencyMs: Date.now() - started }];
      } catch (err) {
        return [route.name, { status: 'down', error: err.code || err.message }];
      }
    })
  );
  return Object.fromEntries(results);
}

/**
 * createGateway(overrides) – overrides are merged into the env-based config,
 * which lets tests plug in fake upstream services and tiny rate limits.
 *
 * Request pipeline for /api/*:
 *   request id → API key check → rate limit → JSON body parse → block internal routes → proxy → 404
 */
function createGateway(overrides = {}) {
  const base = loadGatewayConfig();
  const settings = {
    ...base,
    ...overrides,
    rateLimit: { ...base.rateLimit, ...(overrides.rateLimit || {}) },
  };
  const { routes, apiKeys } = settings;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', settings.trustProxy);

  // --- Security headers. CSP allows Leaflet/OSM tiles for /map and Swagger UI's inline styles.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': [
            "'self'",
            'data:',
            'https://unpkg.com',
            'https://*.tile.openstreetmap.org',
            'https://tile.openstreetmap.org',
            'https://*.basemaps.cartocdn.com',
          ],
          'connect-src': ["'self'"],
          'upgrade-insecure-requests': null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
      exposedHeaders: [
        'x-request-id',
        'x-developed-by',
        'x-served-by',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After',
      ],
    })
  );
  app.use(requestContext(routes));
  app.use(accessLogger());

  // ---------------------------------------------------------------- Public
  app.get('/', (_req, res) => {
    res.json({
      project: config.AUTHOR.project,
      author: config.AUTHOR.author,
      bitsId: config.AUTHOR.bitsId,
      course: config.AUTHOR.course,
      message: 'Fleet Management API Gateway. All /api/* requests need an x-api-key header.',
      links: { health: '/health', docs: '/api-docs', openapi: '/api-docs.json', map: '/map' },
      routes: routes.map((r) => ({ route: `${r.prefix}/*`, service: r.name })),
    });
  });

  app.get('/health', async (_req, res) => {
    const services = await checkServices(routes);
    const allUp = Object.values(services).every((s) => s.status === 'up');
    res.status(200).json({
      project: config.AUTHOR.project,
      author: config.AUTHOR.author,
      bitsId: config.AUTHOR.bitsId,
      status: allUp ? 'ok' : 'degraded',
      gateway: { status: 'up', uptimeSeconds: Math.round(process.uptime()) },
      services,
      timestamp: new Date().toISOString(),
    });
  });

  const spec = buildOpenApiSpec();
  app.get('/api-docs.json', (_req, res) => res.json(spec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, swaggerUiOptions));

  app.get('/map', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'map.html')));
  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  // ---------------------------------------------------------------- /api/*
  app.use('/api', apiKeyAuth(apiKeys));
  app.use('/api', createRateLimiter(settings.rateLimit));
  app.use('/api', express.json({ limit: '100kb' }));

  // Service-to-service endpoints (/internal/...) are never reachable from outside.
  app.use('/api', (req, _res, next) => {
    if (/\/internal(\/|$)/.test(req.path)) {
      return next(ApiError.notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
    }
    return next();
  });

  routes.forEach((route) => app.use(createServiceProxy(route, settings)));

  // Anything that did not match a route above.
  app.use(notFoundHandler('ROUTE_NOT_FOUND'));
  app.use(errorHandler('gateway'));

  app.locals.settings = settings;
  return app;
}

module.exports = { createGateway, checkServices };
