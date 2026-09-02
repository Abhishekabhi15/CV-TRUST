/**
 * Mongoose schema for Finding records.
 * Findings are risk/anomaly items discovered during analysis.
 */
const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    source: {
      type: String,
      enum: ['dataset_analysis', 'model_verification', 'inference_check', 'shift_analysis', 'manual'],
      required: true,
    },
    type: {
      type: String,
      enum: ['DUPLICATE', 'ANOMALY', 'HASH_MISMATCH', 'TAMPERING', 'DRIFT', 'OTHER'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED', 'SUPPRESSED'],
      default: 'OPEN',
    },
    reason: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    relatedRecordId: { type: String },   // e.g. inferenceId or datasetId
    relatedRecordType: { type: String }, // e.g. 'inference', 'dataset'
  },
  { timestamps: true, collection: 'findings' }
);

findingSchema.index({ source: 1, type: 1, severity: 1 });
findingSchema.index({ assetId: 1 });

module.exports = mongoose.model('Finding', findingSchema);
