/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/middleware/requestContext.js – request id, authorship header and access logging
 */
const crypto = require('crypto');
const morgan = require('morgan');
const { config } = require('@fleet/shared');

/**
 * Gives every request an id (keeps the client's x-request-id if it sent a sane one),
 * echoes it back, and stamps the x-developed-by authorship header on every response.
 */
function requestContext(routes) {
  return (req, res, next) => {
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && /^[\w.-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
    req.headers['x-request-id'] = req.id;
    res.setHeader('x-request-id', req.id);
    res.setHeader('x-developed-by', config.AUTHOR.developedBy);

    const route = routes.find((r) => req.path === r.prefix || req.path.startsWith(`${r.prefix}/`));
    req.targetService = route ? route.name : 'gateway';
    next();
  };
}

/** Access log: request id, method, url, target service, status, response time. */
function accessLogger() {
  morgan.token('id', (req) => req.id);
  morgan.token('service', (req) => req.targetService);
  return morgan(':date[iso] [gateway] :id :method :url → :service :status :response-time ms', {
    skip: () => process.env.NODE_ENV === 'test',
  });
}

module.exports = { requestContext, accessLogger };
