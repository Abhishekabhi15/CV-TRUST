/**
 * Validation schema for POST /api/datasets/analyze
 */
const Joi = require('joi');

const analyzeDataset = {
  body: Joi.object({
    datasetPath: Joi.string().required()
      .description('Path to the dataset directory'),
    options: Joi.object({
      checkDuplicates: Joi.boolean().default(true),
      checkAnomalies: Joi.boolean().default(true),
      usePython: Joi.boolean().default(false),
    }).default(),
  }),
};

module.exports = { analyzeDataset };
