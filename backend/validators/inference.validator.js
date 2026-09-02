/**
 * Validation schemas for inference endpoints.
 * POST /api/inference/create  — createInference
 * POST /api/inference/verify  — verifyInference
 */
const Joi = require('joi');

const createInference = {
  body: Joi.object({
    modelId: Joi.string().required()
      .description('Model identifier used for inference'),
    inputData: Joi.object().required()
      .description('Input data fed to the model'),
    outputData: Joi.object().required()
      .description('Output/result data produced by inference'),
    config: Joi.object().default({})
      .description('Inference configuration used to produce the output'),
  }),
};

const verifyInference = {
  body: Joi.object({
    inferenceId: Joi.string().required()
      .description('ID of the inference record to verify'),
  }),
};

module.exports = { createInference, verifyInference };
