/**
 * Request validation middleware using Joi.
 *
 * Usage:
 *   const validate = require('../middleware/validate');
 *   router.post('/path', validate({ body: joiSchema }), handler);
 *
 * @param {Object} schema - Object with optional keys: body, query, params.
 *                          Each value is a Joi schema.
 */
const AppError = require('../utils/AppError');

const validate = (schema) => (req, res, next) => {
  const sources = ['body', 'query', 'params'];
  const errors = [];

  for (const source of sources) {
    if (schema[source]) {
      const { error, value } = schema[source].validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.push(
          ...error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message,
            source,
          }))
        );
      } else {
        // Replace with validated (and stripped) values
        req[source] = value;
      }
    }
  }

  if (errors.length > 0) {
    const err = new AppError('Request validation failed', 400, 'VALIDATION_ERROR');
    err.isJoi = true;
    err.details = errors;
    return next(err);
  }

  next();
};

module.exports = validate;
