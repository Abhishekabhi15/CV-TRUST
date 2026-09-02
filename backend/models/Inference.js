/**
 * Mongoose schema for Inference integrity records.
 * Stores cryptographic hashes of every inference component for tamper detection.
 */
const mongoose = require('mongoose');

const inferenceSchema = new mongoose.Schema(
  {
    modelId: {
      type: String,
      required: true,
      trim: true,
    },
    inputData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    outputData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Individual component hashes
    inputHash: { type: String, required: true },
    modelHash: { type: String, required: true },
    configHash: { type: String, required: true },
    outputHash: { type: String, required: true },
    // Master integrity hash (SHA-256 of all components + timestamp)
    integrityHash: { type: String, required: true },
    timestamp: { type: String, required: true },  // ISO string, part of the hash
  },
  {
    timestamps: true,  // adds createdAt / updatedAt
    collection: 'inferences',
  }
);

module.exports = mongoose.model('Inference', inferenceSchema);
