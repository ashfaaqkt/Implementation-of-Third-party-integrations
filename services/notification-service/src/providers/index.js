/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/providers/index.js – selects the SMS provider from SMS_PROVIDER
 */
const { createLogger } = require('@fleet/shared');
const stub = require('./stub');
const twilio = require('./twilio');

const log = createLogger('notification-service');
let warned = false;

/**
 * Provider interface: send({ to, message, type, attempt }) → Promise<{ providerMessageId }>
 * SMS_PROVIDER=twilio is used only when all Twilio env vars are set; otherwise
 * we fall back to the stub so the system keeps working.
 */
function getSmsProvider() {
  const wanted = (process.env.SMS_PROVIDER || 'stub').toLowerCase();
  if (wanted === 'twilio') {
    if (twilio.isConfigured()) return twilio;
    if (!warned) {
      log.warn('SMS_PROVIDER=twilio but Twilio env vars are missing – using the stub provider');
      warned = true;
    }
  }
  return stub;
}

module.exports = { getSmsProvider };
