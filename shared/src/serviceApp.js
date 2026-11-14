/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/serviceApp.js – common Express app factory + start helper for every microservice
 */
const express = require('express');
const config = require('./config');
const { dbStatus, connectDatabase } = require('./db');
const { notFoundHandler, errorHandler } = require('./errorHandler');
const { createLogger } = require('./logger');

/**
 * Builds an Express app with JSON parsing, a /health endpoint, the service's
 * router mounted at `mountPath`, and the shared 404 + error handlers.
 */
function createServiceApp({ name, mountPath, router }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ service: name, status: 'ok', db: dbStatus(), uptimeSeconds: Math.round(process.uptime()) });
  });

  app.use(mountPath, router);
  app.use(notFoundHandler());
  app.use(errorHandler(name));
  return app;
}

/** Connect to MongoDB, then listen. Logs the authorship line required for screenshots. */
async function startService(app, { name, port, host }) {
  const log = createLogger(name);
  await connectDatabase();
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      log.raw(`✅ ${name} started on port ${port} – by ${config.AUTHOR.developedBy}`);
      resolve(server);
    });
  });
}

module.exports = { createServiceApp, startService };
