/**
 * Object detection controller — Phase 2.
 * POST /api/detect
 * Accepts multipart/form-data with an image file.
 * Passes image to Python/YOLO service, cleans up temp file, returns detections.
 */
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const yoloService = require('../services/yolo.service');
const { createAuditEvent } = require('../services/audit.service');
const logger = require('../utils/logger');

const detectObjects = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_FILE', message: 'An image file is required (field name: image)' },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  const imagePath = req.file.path;
  const startTime = Date.now();

  try {
    const result = await yoloService.detect(imagePath, {
      confidence: req.body.confidence,
      model: req.body.model,
    });

    const processingTime = Date.now() - startTime;

    // Audit
    await createAuditEvent({
      action: 'DETECTION_RUN',
      details: { imageName: req.file.originalname, objectCount: result.objects.length },
    });

    return res.status(200).json({
      success: true,
      data: {
        objects: result.objects,
        image: req.file.originalname,
        savedAs: req.file.filename,
        processingTime: result.processingTime || processingTime,
        modelUsed: result.modelUsed || req.body.model || 'yolov8n',
        rawCount: result.rawCount,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } finally {
    // Always clean up the uploaded temp file
    if (fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => {
        if (err) logger.warn(`Could not delete temp file: ${imagePath} — ${err.message}`);
      });
    }
  }
});

module.exports = { detectObjects };
