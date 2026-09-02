/**
 * Centralized error-handling middleware.
 * Translates errors into a consistent JSON response envelope.
 */
const logger = require('../utils/logger');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = undefined;

  // Operational AppError — use its fields directly
  if (err.isOperational) {
    statusCode = err.statusCode;
    code = err.code;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path || 'identifier'}`;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Uploaded file exceeds the configured MAX_FILE_SIZE';
  }

  // Joi validation error (our custom validate middleware sets isJoi + details array)
  if (err.isJoi) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    // Support both: native Joi details array AND our custom errors array
    if (Array.isArray(err.details)) {
      details = err.details.map((d) => ({
        field: Array.isArray(d.path) ? d.path.join('.') : (d.field || 'unknown'),
        message: d.message,
        source: d.source,
      }));
    }
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(`${code}: ${message}\n${err.stack || ''}`);
  } else {
    logger.warn(`${code}: ${message}`);
  }

  // Build response
  const response = {
    success: false,
    error: { code, message },
    meta: { timestamp: new Date().toISOString() },
  };

  if (details) {
    response.error.details = details;
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
