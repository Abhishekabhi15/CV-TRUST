/**
 * Mongoose schema for Asset records.
 * Assets are the top-level entities (models, datasets, images) tracked by CV-TRUST.
 */
const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['model', 'dataset', 'image', 'other'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    format: { type: String, trim: true },
    hash: { type: String, trim: true },   // SHA-256 of the asset file
    owner: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'assets' }
);

module.exports = mongoose.model('Asset', assetSchema);
