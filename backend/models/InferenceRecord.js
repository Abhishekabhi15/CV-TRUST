/**
 * InferenceRecord — per-detection provenance record.
 * Created automatically after every successful POST /api/detect.
 * This is the thesis "Inference Provenance" collection.
 *
 * NOTE: This is different from the tamper-detection `Inference` model
 * (backend/models/Inference.js) which stores cryptographic hashes for
 * tamper detection via POST /api/inference/create.
 * InferenceRecord stores human-readable provenance metadata.
 */
const mongoose = require('mongoose');
const { hashObject } = require('../utils/hash');

const inferenceRecordSchema = new mongoose.Schema(
  {
    // Human-readable sequential ID, e.g. "INF-2026-00001"
    inferenceId: { type: String, required: true, unique: true, trim: true },

    // Image metadata
    imageName:       { type: String, required: true },
    imageFileSizeBytes: { type: Number, default: 0 },
    imageWidth:      { type: Number, default: 0 },
    imageHeight:     { type: Number, default: 0 },

    // Model metadata (from Python /model-info or detect response)
    modelName:       { type: String, required: true },
    modelVersion:    { type: String, default: '' },
    modelHash:       { type: String, default: '' },

    // Inference configuration
    imgsz:           { type: Number, default: 640 },
    confidenceThreshold: { type: Number, default: 0.20 },
    device:          { type: String, default: 'cpu' },
    maxDet:          { type: Number, default: 300 },

    // Results
    objectCount:     { type: Number, required: true, default: 0 },
    detectedClasses: { type: [String], default: [] },
    confidenceValues: { type: [Number], default: [] },
    averageConfidence: { type: Number, default: 0 },

    // Timing
    processingTimeMs: { type: Number, default: 0 },

    // Status
    backendStatus:   { type: String, enum: ['ok', 'error'], default: 'ok' },
    pythonStatus:    { type: String, enum: ['ok', 'error', 'unknown'], default: 'ok' },
    inferenceStatus: { type: String, enum: ['COMPLETED', 'FAILED'], default: 'COMPLETED' },

    // Tamper-evident integrity hash covering key provenance fields
    integrityHash:   { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'inferencerecords',
  }
);

// Auto-compute integrity hash before saving
inferenceRecordSchema.pre('save', function (next) {
  const fields = {
    inferenceId: this.inferenceId,
    imageName: this.imageName,
    modelName: this.modelName,
    modelHash: this.modelHash,
    objectCount: this.objectCount,
    detectedClasses: this.detectedClasses,
    averageConfidence: this.averageConfidence,
    processingTimeMs: this.processingTimeMs,
  };
  this.integrityHash = hashObject(fields);
  next();
});

inferenceRecordSchema.index({ createdAt: -1 });
inferenceRecordSchema.index({ modelName: 1 });
inferenceRecordSchema.index({ inferenceStatus: 1 });

module.exports = mongoose.model('InferenceRecord', inferenceRecordSchema);
