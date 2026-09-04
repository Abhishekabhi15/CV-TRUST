/**
 * InferenceRecord service.
 * Creates and retrieves per-detection provenance records.
 */
const mongoose = require('mongoose');
const InferenceRecord = require('../models/InferenceRecord');
const AppError = require('../utils/AppError');

const isDbConnected = () => mongoose.connection.readyState === 1;

// ── Sequential ID generation ──────────────────────────────────────────────────
/**
 * Generate a human-readable inference ID like "INF-2026-00001".
 * Uses the count of existing records (+1) for the sequence number.
 * Not perfectly atomic but sufficient for thesis prototype.
 */
async function generateInferenceId() {
  const year = new Date().getFullYear();
  const count = await InferenceRecord.countDocuments();
  const seq = String(count + 1).padStart(5, '0');
  return `INF-${year}-${seq}`;
}

// ── Create ────────────────────────────────────────────────────────────────────
/**
 * Save a new provenance record after a YOLO detection.
 *
 * @param {object} data
 * @param {string} data.imageName
 * @param {number} [data.imageFileSizeBytes]
 * @param {number} [data.imageWidth]
 * @param {number} [data.imageHeight]
 * @param {string} [data.modelName]
 * @param {string} [data.modelVersion]
 * @param {string} [data.modelHash]
 * @param {number} [data.imgsz]
 * @param {number} [data.confidenceThreshold]
 * @param {string} [data.device]
 * @param {number} [data.maxDet]
 * @param {object[]} data.objects  Array of {label, confidence, bbox}
 * @param {number}   data.processingTimeMs
 * @param {string}   [data.inferenceStatus]
 * @returns {Promise<object>} saved record
 */
async function createInferenceRecord(data) {
  if (!isDbConnected()) return null;   // graceful degradation when DB unavailable

  const objects = data.objects || [];
  const detectedClasses = [...new Set(objects.map((o) => o.label))];
  const confidenceValues = objects.map((o) => Number(o.confidence) || 0);
  const avgConf = confidenceValues.length > 0
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0;

  const inferenceId = await generateInferenceId();

  const record = await InferenceRecord.create({
    inferenceId,
    imageName:            data.imageName || 'unknown',
    imageFileSizeBytes:   data.imageFileSizeBytes || 0,
    imageWidth:           data.imageWidth || 0,
    imageHeight:          data.imageHeight || 0,
    modelName:            data.modelName || 'yolov8n',
    modelVersion:         data.modelVersion || '8.0',
    modelHash:            data.modelHash || '',
    imgsz:                data.imgsz || 640,
    confidenceThreshold:  data.confidenceThreshold || 0.20,
    device:               data.device || 'cpu',
    maxDet:               data.maxDet || 300,
    objectCount:          objects.length,
    detectedClasses,
    confidenceValues,
    averageConfidence:    parseFloat(avgConf.toFixed(4)),
    processingTimeMs:     data.processingTimeMs || 0,
    backendStatus:        'ok',
    pythonStatus:         'ok',
    inferenceStatus:      data.inferenceStatus || 'COMPLETED',
  });

  return record;
}

// ── List (paginated) ──────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @returns {Promise<object>} { records, pagination }
 */
async function getInferenceRecords({ page = 1, limit = 20 } = {}) {
  if (!isDbConnected()) {
    return { records: [], pagination: { page: 1, limit, total: 0, pages: 0 }, dbStatus: 'unavailable' };
  }

  const safePage  = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [records, total] = await Promise.all([
    InferenceRecord.find().sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    InferenceRecord.countDocuments(),
  ]);

  return {
    records,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

// ── Get by ID ─────────────────────────────────────────────────────────────────
async function getInferenceRecordById(id) {
  if (!isDbConnected()) {
    throw new AppError('MongoDB is required', 503, 'DATABASE_UNAVAILABLE');
  }

  // Accept both MongoDB ObjectId and human-readable inferenceId
  let record = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    record = await InferenceRecord.findById(id).lean();
  }
  if (!record) {
    record = await InferenceRecord.findOne({ inferenceId: id }).lean();
  }
  if (!record) {
    throw new AppError(`Inference record not found: ${id}`, 404, 'INFERENCE_RECORD_NOT_FOUND');
  }
  return record;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
/**
 * Aggregate inference statistics for the dashboard.
 */
async function getInferenceStats() {
  if (!isDbConnected()) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      avgProcessingTimeMs: 0,
      lastInferenceTime: null,
      lastInferenceId: null,
      lastObjectCount: 0,
      dbStatus: 'unavailable',
    };
  }

  const [agg, last] = await Promise.all([
    InferenceRecord.aggregate([
      {
        $group: {
          _id: null,
          total:      { $sum: 1 },
          successful: { $sum: { $cond: [{ $eq: ['$inferenceStatus', 'COMPLETED'] }, 1, 0] } },
          failed:     { $sum: { $cond: [{ $eq: ['$inferenceStatus', 'FAILED'] }, 1, 0] } },
          avgTime:    { $avg: '$processingTimeMs' },
        },
      },
    ]),
    InferenceRecord.findOne().sort({ createdAt: -1 }).lean(),
  ]);

  const stats = agg[0] || { total: 0, successful: 0, failed: 0, avgTime: 0 };

  return {
    total:               stats.total,
    successful:          stats.successful,
    failed:              stats.failed,
    avgProcessingTimeMs: stats.avgTime ? parseFloat(stats.avgTime.toFixed(1)) : 0,
    lastInferenceTime:   last?.createdAt || null,
    lastInferenceId:     last?.inferenceId || null,
    lastObjectCount:     last?.objectCount || 0,
  };
}

module.exports = {
  createInferenceRecord,
  getInferenceRecords,
  getInferenceRecordById,
  getInferenceStats,
};
