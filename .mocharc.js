/**
 * Fleet Management System – Third-party Integrations, API Gateway
 * Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
 * Course : Backend and API Development – BITS Pilani
 * File   : .mocharc.js – Mocha config: spec console output + mochawesome HTML report in test-report/
 */
module.exports = {
  spec: process.argv.some((a) => a.endsWith('.flow.js')) ? undefined : ['test/**/*.test.js'],
  require: ['test/helpers/setup.js'],
  timeout: 60000, // first run downloads the MongoDB binary for mongodb-memory-server
  exit: true,
  reporter: 'mochawesome',
  'reporter-option': [
    'consoleReporter=spec',
    'reportDir=test-report',
    'reportFilename=index',
    'reportTitle=Fleet Management System – Ashfaaq Feroz Muhammad (2023EBCS005)',
    'reportPageTitle=Test Report – Ashfaaq Feroz Muhammad (2023EBCS005)',
    'charts=true',
    'code=false',
    'quiet=false',
  ],
};
