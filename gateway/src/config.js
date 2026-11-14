/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/config.js – gateway configuration (routes table, API keys, rate limits)
 */
const { config } = require('@fleet/shared');

/**
 * Routing table: gateway prefix → backend service.
 * The gateway strips the leading "/api", so /api/vehicles/123 → <vehicle-service>/vehicles/123.
 */
function buildRoutes(overrides = {}) {
  return [
    { prefix: '/api/users', key: 'user', name: 'user-service' },
    { prefix: '/api/vehicles', key: 'vehicle', name: 'vehicle-service' },
    { prefix: '/api/telemetry', key: 'telemetry', name: 'telemetry-service' },
    { prefix: '/api/maps', key: 'geo', name: 'geo-service' },
    { prefix: '/api/notifications', key: 'notification', name: 'notification-service' },
  ].map((route) => ({ ...route, target: overrides[route.key] || config.serviceUrl(route.key) }));
}

/**
 * API_KEYS="devkey123:standard,partnerkey456:premium:Partner App"
 * Each entry is key:tier[:name]. Returns Map<key, { key, tier, name }>.
 */
function parseApiKeys(raw) {
  const keys = new Map();
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [key, tier = 'standard', ...nameParts] = entry.split(':').map((s) => s.trim());
      if (key) keys.set(key, { key, tier: tier.toLowerCase(), name: nameParts.join(':') || `${tier}-client` });
    });
  return keys;
}

function loadGatewayConfig() {
  return {
    port: config.num(process.env.PORT || process.env.GATEWAY_PORT, 8080),
    apiKeys: parseApiKeys(process.env.API_KEYS || 'devkey123:standard,partnerkey456:premium,demokey789:demo'),
    rateLimit: {
      windowMs: config.num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      max: config.num(process.env.RATE_LIMIT_MAX, 100),
      maxPremium: config.num(process.env.RATE_LIMIT_MAX_PREMIUM, 1000),
      maxDemo: config.num(process.env.RATE_LIMIT_MAX_DEMO, 5),
    },
    proxyTimeoutMs: config.num(process.env.PROXY_TIMEOUT_MS, 10000),
    trustProxy: process.env.TRUST_PROXY ? config.num(process.env.TRUST_PROXY, 1) : false,
    routes: buildRoutes(),
  };
}

module.exports = { loadGatewayConfig, parseApiKeys, buildRoutes };
