/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : services/telemetry-service/src/criticalEvents.js – detects critical events (explicit or by threshold)
 */
const { config } = require('@fleet/shared');
const { CRITICAL_EVENTS } = require('./models/Telemetry');

/**
 * A reading is critical when:
 *  - the vehicle explicitly reports ENGINE_FAULT, LOW_BATTERY or EMERGENCY_STOP, or
 *  - batteryVoltage < LOW_BATTERY_VOLTAGE (default 11.5 V)  → LOW_BATTERY, or
 *  - engineTemp     > ENGINE_TEMP_MAX     (default 110 °C)  → ENGINE_FAULT.
 * Returns a de-duplicated list of { event, detectedBy, detail }.
 */
function detectCriticalEvents(reading) {
  const lowBattery = config.num(process.env.LOW_BATTERY_VOLTAGE, 11.5);
  const maxTemp = config.num(process.env.ENGINE_TEMP_MAX, 110);
  const found = new Map();

  if (reading.eventType && CRITICAL_EVENTS.includes(reading.eventType)) {
    found.set(reading.eventType, { event: reading.eventType, detectedBy: 'explicit', detail: 'Reported by vehicle' });
  }
  if (typeof reading.batteryVoltage === 'number' && reading.batteryVoltage < lowBattery && !found.has('LOW_BATTERY')) {
    found.set('LOW_BATTERY', {
      event: 'LOW_BATTERY',
      detectedBy: 'threshold',
      detail: `Battery ${reading.batteryVoltage}V < ${lowBattery}V`,
    });
  }
  if (typeof reading.engineTemp === 'number' && reading.engineTemp > maxTemp && !found.has('ENGINE_FAULT')) {
    found.set('ENGINE_FAULT', {
      event: 'ENGINE_FAULT',
      detectedBy: 'threshold',
      detail: `Engine temperature ${reading.engineTemp}°C > ${maxTemp}°C`,
    });
  }
  return [...found.values()];
}

module.exports = { detectCriticalEvents };
