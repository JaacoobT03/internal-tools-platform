// Violation: app requires another app (CommonJS).
const { beta } = require('../beta/beta');

module.exports = { bad: beta };
