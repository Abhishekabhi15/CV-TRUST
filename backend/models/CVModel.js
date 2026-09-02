/**
 * Mongoose schema for model trust verification records.
 */
const mongoose = require('mongoose');

const cvModelSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    modelName: { type: String, required: true, trim: true },
    modelPath: { type: String, required: true, trim: true },
    framework: { type: String, trim: true },
    modelHash: { type: String, required: true, trim: true },
    trustedHash: { type: String, trim: true },
    match: { type: Boolean },
    status: {
      type: String,
      enum: ['HASH_COMPUTED', 'VERIFIED', 'SUSPICIOUS'],
      required: true,
    },
    fileSizeBytes: { type: Number, default: 0 },
    verifiedAt: { type: String, required: true },
  },
  { timestamps: true, collection: 'models' }
);

cvModelSchema.index({ modelHash: 1 });
cvModelSchema.index({ status: 1 });

module.exports = mongoose.model('CVModel', cvModelSchema);
