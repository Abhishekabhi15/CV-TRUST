/**
 * HTTP request logging middleware using Morgan.
 * Uses 'dev' format for concise colored output.
 */
const morgan = require('morgan');

module.exports = morgan('dev');
