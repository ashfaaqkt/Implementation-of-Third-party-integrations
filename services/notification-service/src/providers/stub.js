/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/notification-service/src/providers/stub.js – mock SMS provider (console box + simulated failures)
 */
const crypto = require('crypto');
const { config, createLogger } = require('@fleet/shared');

const log = createLogger('sms-stub');
const WIDTH = 72;

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  });
  if (current) lines.push(current);
  return lines;
}

/** Pretty console box so the SMS shows up clearly in screenshots. */
function printBox({ ok, to, message, type, id, error, attempt }) {
  const inner = WIDTH - 4;
  const row = (text = '') => `│ ${String(text).padEnd(inner)} │`;
  const title = ok ? `📱 SMS SENT to ${to}` : `❌ SMS FAILED to ${to}`;
  const lines = [
    `┌${'─'.repeat(WIDTH - 2)}┐`,
    row(title),
    `├${'─'.repeat(WIDTH - 2)}┤`,
    row(`Type    : ${type}`),
    row(`Attempt : ${attempt}`),
    ...wrap(message, inner - 10).map((l, i) => row(`${i === 0 ? 'Message : ' : '          '}${l}`)),
    row(ok ? `Msg ID  : ${id}` : `Error   : ${error}`),
    row(`Time    : ${new Date().toISOString()}`),
    `├${'─'.repeat(WIDTH - 2)}┤`,
    row(`Fleet Management System · ${config.AUTHOR.developedBy}`),
    `└${'─'.repeat(WIDTH - 2)}┘`,
  ];
  log.raw(lines.join('\n'));
}

/**
 * Failure rules (so failures are easy to demo and test):
 *  - any number ending in 0000 always fails;
 *  - otherwise fails randomly with probability SMS_STUB_FAIL_RATE (0–1, default 0).
 */
function shouldFail(to) {
  if (/0000$/.test(to)) return 'Simulated carrier rejection (numbers ending in 0000 always fail)';
  const rate = Math.min(1, Math.max(0, Number(process.env.SMS_STUB_FAIL_RATE) || 0));
  if (rate > 0 && Math.random() < rate) return `Simulated random failure (SMS_STUB_FAIL_RATE=${rate})`;
  return null;
}

module.exports = {
  name: 'stub',

  /** send({ to, message, type, attempt }) → { providerMessageId } or throws Error */
  async send({ to, message, type, attempt = 1 }) {
    const failure = shouldFail(to);
    if (failure) {
      printBox({ ok: false, to, message, type, error: failure, attempt });
      throw new Error(failure);
    }
    const id = `stub-${crypto.randomUUID()}`;
    printBox({ ok: true, to, message, type, id, attempt });
    return { providerMessageId: id };
  },
};
