/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/proxy.js – reverse proxy that forwards requests/responses to backend services
 */
// http-proxy (used by http-proxy-middleware) still calls url.parse(), which newer
// Node versions flag with DEP0169 on every start. It is harmless here, so only that
// one warning is filtered to keep the console clean. All other warnings still print.
const emitWarning = process.emitWarning;
process.emitWarning = function filteredEmitWarning(warning, ...args) {
  const code = args[0] && typeof args[0] === 'object' ? args[0].code : args[1];
  if (code === 'DEP0169') return undefined;
  return emitWarning.call(process, warning, ...args);
};

const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const { ApiError, createLogger } = require('@fleet/shared');

const log = createLogger('gateway');

/**
 * One proxy per route. What happens to each request:
 *  1. /api/<group>/... is rewritten to /<group>/... on the target service.
 *  2. x-api-key and any client-supplied x-internal-token are removed (never forwarded).
 *  3. x-request-id and x-forwarded-by: fleet-gateway are added.
 *  4. Authorization and the (already parsed) JSON body are forwarded unchanged.
 *  5. Connection refused / reset / timeout → 503 SERVICE_UNAVAILABLE naming the service.
 */
function createServiceProxy(route, { proxyTimeoutMs }) {
  return createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    pathFilter: (path) => path === route.prefix || path.startsWith(`${route.prefix}/`) || path.startsWith(`${route.prefix}?`),
    pathRewrite: (path) => path.replace(/^\/api/, ''),
    // Abort the upstream request after proxyTimeoutMs → error handler below → 503.
    proxyTimeout: proxyTimeoutMs,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.removeHeader('x-api-key');
        proxyReq.removeHeader('x-internal-token');
        proxyReq.setHeader('x-request-id', req.id);
        proxyReq.setHeader('x-forwarded-by', 'fleet-gateway');
        if (req.apiKey) proxyReq.setHeader('x-api-client', req.apiKey.name);
        // express.json() already consumed the stream – re-write the body for the target.
        fixRequestBody(proxyReq, req);
      },
      proxyRes: (proxyRes, req) => {
        proxyRes.headers['x-served-by'] = route.name;
        proxyRes.headers['x-request-id'] = req.id;
      },
      error: (err, req, res) => {
        log.warn(`${req.id} ${route.name} unreachable: ${err.code || err.message}`);
        // `res` is a socket for websocket upgrades – nothing to send then.
        if (!res || typeof res.status !== 'function' || res.headersSent) {
          if (res && typeof res.destroy === 'function') res.destroy();
          return;
        }
        const apiError = ApiError.unavailable(
          route.name,
          `${route.name} is currently unavailable. Please try again later.`
        );
        apiError.details = { service: route.name, reason: err.code || 'UPSTREAM_ERROR' };
        res.status(503).json(apiError.toJSON());
      },
    },
  });
}

module.exports = { createServiceProxy };
