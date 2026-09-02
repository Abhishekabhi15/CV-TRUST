/**
 * Application logger using Winston.
 * Provides structured, leveled logging with timestamps.
 */
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.colorize(),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [new transports.Console()],
  // Don't exit on uncaught errors
  exitOnError: false,
});

module.exports = logger;
