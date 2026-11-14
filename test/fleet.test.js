/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : test/fleet.test.js – root suite that groups all automated test flows
 */
describe('Fleet Management System – Ashfaaq Feroz Muhammad (2023EBCS005)', () => {
  require('./flows/01-auth.flow');
  require('./flows/02-vehicles.flow');
  require('./flows/03-telemetry.flow');
  require('./flows/04-status-notifications.flow');
  require('./flows/05-rbac.flow');
  require('./flows/06-nearby.flow');
  require('./flows/07-gateway.flow');
  require('./flows/08-swagger-docs.flow');
  require('./flows/09-providers.flow');
});
