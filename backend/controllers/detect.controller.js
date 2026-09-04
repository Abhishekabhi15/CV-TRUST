/**
 * Object detection controller — Phase 2 + Provenance.
 * POST /api/detect
 * Accepts multipart/form-data with an image file.
 * Passes image to Python/YOLO service, cleans up temp file, returns detections.
 *
 * After every successful detection:
 *   1. Creates an InferenceRecord (provenance) in MongoDB
 *   2. Creates a ShiftRecord (distribution shift) in MongoDB
 *   3. Creates an AuditLog event
 * All three steps are best-effort and non-fatal.
 */
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const yoloService = require('../services/yolo.service');
const { createAuditEvent } = require('../services/audit.service');
const { createInferenceRecord } = require('../services/inferenceRecord.service');
const { saveShiftResult } = require('../services/shiftRecord.service');
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
      model:      req.body.model,
    });

    const processingTime = Date.now() - startTime;
    const processingTimeMs = result.processingTime || processingTime;

    // ── 1. Create Inference Provenance Record (best-effort) ───────────────────
    let inferenceRecord = null;
    try {
      inferenceRecord = await createInferenceRecord({
        imageName:           req.file.originalname,
        imageFileSizeBytes:  result.imageStats?.fileSizeBytes || req.file.size || 0,
        imageWidth:          result.imageStats?.width || 0,
        imageHeight:         result.imageStats?.height || 0,
        modelName:           result.modelUsed || req.body.model || 'yolov8n',
        modelVersion:        '8.0',
        modelHash:           result.modelHash || '',
        imgsz:               result.imgsz || 640,
        confidenceThreshold: parseFloat(result.confidenceThreshold || req.body.confidence || 0.20),
        device:              result.device || 'cpu',
        maxDet:              result.maxDet || 300,
        objects:             result.objects || [],
        processingTimeMs:    processingTimeMs,
        inferenceStatus:     'COMPLETED',
      });
    } catch (provErr) {
      logger.warn(`Could not save inference record: ${provErr.message}`);
    }

    // ── 2. Create Distribution Shift Record (best-effort) ─────────────────────
    if (result.imageStats && result.shiftAnalysis) {
      try {
        await saveShiftResult({
          imageName:          req.file.originalname,
          inferenceRecordId:  inferenceRecord?._id || null,
          imageStats:         result.imageStats,
          shiftAnalysis:      result.shiftAnalysis,
        });
      } catch (shiftErr) {
        logger.warn(`Could not save shift record: ${shiftErr.message}`);
      }
    }

    // ── 3. Audit log ──────────────────────────────────────────────────────────
    await createAuditEvent({
      action: 'DETECTION_RUN',
      details: {
        imageName:    req.file.originalname,
        objectCount:  result.objects.length,
        model:        result.modelUsed || 'yolov8n',
        processingMs: processingTimeMs,
        inferenceId:  inferenceRecord?.inferenceId || null,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        objects:         result.objects,
        image:           req.file.originalname,
        savedAs:         req.file.filename,
        processingTime:  processingTimeMs,
        modelUsed:       result.modelUsed || req.body.model || 'yolov8n',
        rawCount:        result.rawCount,
        // Provenance metadata
        inferenceId:     inferenceRecord?.inferenceId || null,
        modelHash:       result.modelHash || null,
        device:          result.device || null,
        imgsz:           result.imgsz || null,
        confidenceThreshold: result.confidenceThreshold || null,
        // Image & shift stats
        imageStats:      result.imageStats || null,
        shiftAnalysis:   result.shiftAnalysis || null,
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
