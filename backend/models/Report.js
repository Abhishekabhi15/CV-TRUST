/**
 * Mongoose schema for Assurance Report records.
 */
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    assetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    findingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Finding' }],
    findings: { type: mongoose.Schema.Types.Mixed, default: [] }, // denormalised snapshot
    overallRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    riskScore: { type: Number, min: 0, max: 1, default: 0 },
    recommendation: {
      type: String,
      enum: ['ACCEPT', 'REVIEW', 'QUARANTINE'],
      required: true,
    },
    affectedAssets: { type: mongoose.Schema.Types.Mixed, default: [] },
    summary: { type: String },
    generatedBy: { type: String, default: 'system' },
  },
  { timestamps: true, collection: 'reports' }
);

module.exports = mongoose.model('Report', reportSchema);
