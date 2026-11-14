/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/notifier.js – send SMS with one retry and record the outcome
 */
const { createLogger, callService } = require('@fleet/shared');
const Notification = require('./models/Notification');
const { getSmsProvider } = require('./providers');

const log = createLogger('notification-service');
const MAX_ATTEMPTS = 2; // first try + one retry

/**
 * Lifecycle of every SMS:
 *   1. Saved as `queued` before anything is sent (so a crash still leaves a record).
 *   2. provider.send() – on error we retry once (MAX_ATTEMPTS = 2).
 *   3. Saved as `sent` (with providerMessageId) or `failed` (with the last error).
 */
async function sendSms({ to, message, type, vehicleId = null, event = null, recipient }) {
  const provider = getSmsProvider();
  const doc = await Notification.create({
    to,
    message,
    type,
    vehicleId,
    event,
    recipient,
    provider: provider.name,
    status: 'queued',
  });

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    doc.attempts = attempt;
    try {
      // eslint-disable-next-line no-await-in-loop
      const { providerMessageId } = await provider.send({ to, message, type, attempt });
      doc.status = 'sent';
      doc.providerMessageId = providerMessageId;
      doc.error = null;
      doc.sentAt = new Date();
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      log.warn(`SMS to ${to} failed on attempt ${attempt}/${MAX_ATTEMPTS}: ${err.message}`);
    }
  }
  if (lastError) {
    doc.status = 'failed';
    doc.error = lastError.message;
  }
  await doc.save();
  return doc;
}

/**
 * Notify a group of users: looks up phone numbers in the User Service
 * (by role and/or user id), de-duplicates them and sends one SMS each.
 */
async function notifyRecipients({ type, message, vehicleId, event, recipients = {}, requestId }) {
  const roles = recipients.roles || [];
  const userIds = (recipients.userIds || []).filter(Boolean);
  const phones = recipients.phones || [];

  const contacts = [];
  if (roles.length || userIds.length) {
    const { data } = await callService('user', {
      url: '/users/internal/contacts',
      params: { roles: roles.join(','), ids: userIds.join(',') },
      requestId,
    });
    contacts.push(...data);
  }
  phones.forEach((p) => contacts.push({ phone: p, name: 'Direct number', role: 'external' }));

  const seen = new Set();
  const unique = contacts.filter((c) => c.phone && !seen.has(c.phone) && seen.add(c.phone));

  const results = [];
  // Sequential on purpose: keeps console output readable and respects provider rate limits.
  for (const contact of unique) {
    // eslint-disable-next-line no-await-in-loop
    results.push(
      await sendSms({
        to: contact.phone,
        message,
        type,
        vehicleId,
        event,
        recipient: { userId: contact.id, name: contact.name, role: contact.role },
      })
    );
  }
  return results;
}

module.exports = { sendSms, notifyRecipients, MAX_ATTEMPTS };
