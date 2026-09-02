/**
 * Mongoose schema for Audit Log records.
 * Implements hash chaining for tamper-evident audit trail:
 * eventHash = SHA-256(previousHash + eventData)
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'DATASET_ANALYZED',
        'MODEL_VERIFIED',
        'INFERENCE_CREATED',
        'INFERENCE_VERIFIED',
        'REPORT_GENERATED',
        'DETECTION_RUN',
        'SHIFT_ANALYZED',
        'FINDING_CREATED',
      ],
    },
    user: { type: String, default: 'system' },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    relatedId: { type: String },         // ID of the related record (inferenceId, datasetId, etc.)
    relatedType: { type: String },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
      default: 'SUCCESS',
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Hash chain fields
    previousHash: { type: String, default: '0'.repeat(64) },
    eventHash: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { timestamps: true, collection: 'auditlogs' }
);

auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
