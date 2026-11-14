/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : shared/src/logger.js – tiny levelled console logger
 */
const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

function currentLevel() {
  const name = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
  return LEVELS[name] ?? LEVELS.info;
}

function createLogger(scope) {
  const write = (level, stream) => (...args) => {
    if (LEVELS[level] > currentLevel()) return;
    const ts = new Date().toISOString();
    stream(`[${ts}] ${level.toUpperCase().padEnd(5)} [${scope}]`, ...args);
  };
  return {
    error: write('error', console.error),
    warn: write('warn', console.warn),
    info: write('info', console.log),
    debug: write('debug', console.log),
    /** Raw output that should always show unless logging is silenced (banners, SMS box). */
    raw: (text) => {
      if (currentLevel() > LEVELS.silent) console.log(text);
    },
  };
}

module.exports = { createLogger };
