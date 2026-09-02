/**
 * Custom application error class.
 * Operational errors (isOperational = true) are expected errors that the
 * error handler can translate into a clean JSON response.
 */
class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error message
   * @param {number} statusCode - HTTP status code (e.g. 400, 404, 500)
   * @param {string} [code]   - Machine-readable error code (e.g. 'VALIDATION_ERROR')
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
