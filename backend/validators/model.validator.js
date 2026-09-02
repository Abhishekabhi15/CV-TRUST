/**
 * Validation schema for POST /api/models/verify
 */
const Joi = require('joi');

const verifyModel = {
  body: Joi.object({
    modelPath: Joi.string().required()
      .description('Path to the model file'),
    trustedHash: Joi.string().hex().length(64).optional()
      .description('Expected SHA-256 hash of the trusted model'),
    framework: Joi.string().optional()
      .description('Optional model framework label such as YOLO, PyTorch, TensorFlow'),
  }),
};

module.exports = { verifyModel };
