/**
 * Validation schema for POST /api/shift/analyze
 */
const Joi = require('joi');

const analyzeShift = {
  body: Joi.object({
    referenceDatasetPath: Joi.string()
      .description('Path to the reference dataset directory'),
    incomingDatasetPath: Joi.string()
      .description('Path to the incoming dataset directory'),
    referenceValues: Joi.object()
      .description('Baseline / reference distribution values'),
    incomingValues: Joi.object()
      .description('Current / incoming distribution values'),
    metrics: Joi.array().items(Joi.string()).optional()
      .description('Specific metrics to compare'),
  }).custom((value, helpers) => {
    const hasDatasetPair = value.referenceDatasetPath && value.incomingDatasetPath;
    const hasValuePair = value.referenceValues && value.incomingValues;

    if (!hasDatasetPair && !hasValuePair) {
      return helpers.error('any.custom', {
        message: 'Provide either referenceDatasetPath + incomingDatasetPath or referenceValues + incomingValues',
      });
    }
    return value;
  }),
};

module.exports = { analyzeShift };
