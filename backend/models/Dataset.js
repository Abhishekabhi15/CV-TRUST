/**
 * Mongoose schema for Dataset integrity records.
 */
const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    datasetPath: { type: String, required: true },
    sampleCount: { type: Number, default: 0 },
    uniqueCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    integrityStatus: {
      type: String,
      enum: ['CLEAN', 'DUPLICATES_FOUND', 'ANOMALIES_FOUND', 'MIXED', 'ERROR'],
      default: 'CLEAN',
    },
    riskScore: { type: Number, min: 0, max: 1, default: 0 },
    duplicates: { type: mongoose.Schema.Types.Mixed, default: [] },
    anomalies: { type: mongoose.Schema.Types.Mixed, default: [] },
    findings: { type: mongoose.Schema.Types.Mixed, default: [] },
    analysisOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'datasets' }
);

module.exports = mongoose.model('Dataset', datasetSchema);
