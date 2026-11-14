/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/providers/twilio.js – Twilio (sandbox / trial) SMS provider via REST API
 */
const axios = require('axios');

const API_BASE = () => (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/+$/, '');

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)');
  }
  return { sid, token, from };
}

module.exports = {
  name: 'twilio',

  isConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  },

  /** POST /2010-04-01/Accounts/{SID}/Messages.json (form encoded, HTTP basic auth) */
  async send({ to, message }) {
    const { sid, token, from } = credentials();
    try {
      const { data } = await axios.post(
        `${API_BASE()}/2010-04-01/Accounts/${sid}/Messages.json`,
        new URLSearchParams({ To: to, From: from, Body: message }).toString(),
        {
          auth: { username: sid, password: token },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );
      return { providerMessageId: data.sid };
    } catch (err) {
      const detail = err.response && err.response.data ? err.response.data.message || JSON.stringify(err.response.data) : err.message;
      throw new Error(`Twilio error: ${detail}`);
    }
  },
};
