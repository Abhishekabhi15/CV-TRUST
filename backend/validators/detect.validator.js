/**
 * Validation schema for POST /api/detect
 * The image file is handled by multer (multipart/form-data),
 * so Joi only validates optional form fields.
 */
const Joi = require('joi');

const detect = {
  body: Joi.object({
    confidence: Joi.number().min(0).max(1).default(0.25)
      .description('Minimum confidence threshold'),
    model: Joi.string().valid('yolov8n', 'yolov8s', 'yolov8m').default('yolov8n')
      .description('YOLO model variant'),
  }),
};

module.exports = { detect };
