/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : gateway/src/server.js – starts the API Gateway and prints the startup banner
 */
const { config, createLogger } = require('@fleet/shared');
const { createGateway } = require('./app');

const log = createLogger('gateway');

function banner(settings) {
  const width = 66;
  const line = (text = '') => `║ ${text.padEnd(width - 4)} ║`;
  const routes = settings.routes.map((r) => line(`  ${`${r.prefix}/*`.padEnd(22)} → ${r.target}`));
  return [
    `╔${'═'.repeat(width - 2)}╗`,
    line('🚚  FLEET MANAGEMENT SYSTEM – API GATEWAY'),
    line('Third-party Integrations, API Gateway'),
    line(),
    line(`Author : ${config.AUTHOR.author}`),
    line(`BITS ID: ${config.AUTHOR.bitsId}`),
    line(`Course : ${config.AUTHOR.course}`),
    `╠${'═'.repeat(width - 2)}╣`,
    line(`Gateway : http://localhost:${settings.port}`),
    line(`Docs    : http://localhost:${settings.port}/api-docs`),
    line(`Map     : http://localhost:${settings.port}/map`),
    line(`Health  : http://localhost:${settings.port}/health`),
    line(`API keys: ${settings.apiKeys.size} loaded · rate limit ${settings.rateLimit.max}/${Math.round(settings.rateLimit.windowMs / 60000)} min`),
    line('Routes:'),
    ...routes,
    `╚${'═'.repeat(width - 2)}╝`,
  ].join('\n');
}

function startGateway(overrides) {
  const app = createGateway(overrides);
  const { settings } = app.locals;
  return new Promise((resolve) => {
    const server = app.listen(settings.port, () => {
      log.raw(banner(settings));
      log.raw(`✅ gateway started on port ${settings.port} – by ${config.AUTHOR.developedBy}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startGateway().catch((err) => {
    log.error('Gateway failed to start:', err);
    process.exit(1);
  });
}

module.exports = { startGateway, banner };
