/**
 * Inference integrity service.
 * Creates tamper-evident records and detects modifications via SHA-256 comparison.
 */
const { hashObject, hashString } = require('../utils/hash');
const Inference = require('../models/Inference');
const AppError = require('../utils/AppError');

/**
 * Create an inference integrity record.
 * Hashes every component individually then produces a master integrity hash.
 *
 * Hash inputs:
 *   inputHash   = SHA-256(inputData)
 *   modelHash   = SHA-256(modelId)
 *   configHash  = SHA-256(config)
 *   outputHash  = SHA-256(outputData)
 *   integrityHash = SHA-256(inputHash + modelHash + configHash + outputHash + timestamp)
 *
 * @param {object} params
 * @param {string} params.modelId
 * @param {object} params.inputData
 * @param {object} params.outputData
 * @param {object} [params.config]
 * @returns {Promise<object>}
 */
async function createInference({ modelId, inputData, outputData, config = {} }) {
  const timestamp = new Date().toISOString();

  const inputHash  = hashObject(inputData);
  const modelHash  = hashString(modelId);
  const configHash = hashObject(config);
  const outputHash = hashObject(outputData);

  // Master hash covers every component — any change will be detectable
  const integrityHash = hashString(
    inputHash + modelHash + configHash + outputHash + timestamp
  );

  const record = await Inference.create({
    modelId,
    inputData,
    outputData,
    config,
    inputHash,
    modelHash,
    configHash,
    outputHash,
    integrityHash,
    timestamp,
  });

  return {
    inferenceId: record._id,
    integrityHash,
    inputHash,
    modelHash,
    configHash,
    outputHash,
    timestamp,
    createdAt: record.createdAt,
  };
}

/**
 * Verify an inference record — recalculate hash and compare to stored value.
 * Returns VERIFIED if nothing changed, TAMPERING_DETECTED if any field was modified.
 *
 * @param {string} inferenceId   MongoDB ObjectId of the inference record
 * @returns {Promise<object>}
 */
async function verifyInference(inferenceId) {
  if (!Inference.db.base.Types.ObjectId.isValid(inferenceId)) {
    throw new AppError(`Invalid inference ID: ${inferenceId}`, 400, 'INVALID_ID');
  }

  const record = await Inference.findById(inferenceId);
  if (!record) {
    throw new AppError(`Inference record not found: ${inferenceId}`, 404, 'INFERENCE_NOT_FOUND');
  }

  // Recalculate individual hashes from stored data
  const currentInputHash  = hashObject(record.inputData);
  const currentModelHash  = hashString(record.modelId);
  const currentConfigHash = hashObject(record.config || {});
  const currentOutputHash = hashObject(record.outputData);

  // Recalculate master integrity hash using stored timestamp
  const currentIntegrityHash = hashString(
    currentInputHash + currentModelHash + currentConfigHash + currentOutputHash + record.timestamp
  );

  const verified = currentIntegrityHash === record.integrityHash;

  return {
    inferenceId: record._id,
    verified,
    status: verified ? 'VERIFIED' : 'TAMPERING_DETECTED',
    storedHash: record.integrityHash,
    currentHash: currentIntegrityHash,
    componentChecks: {
      input:  { stored: record.inputHash,  current: currentInputHash,  match: currentInputHash  === record.inputHash  },
      model:  { stored: record.modelHash,  current: currentModelHash,  match: currentModelHash  === record.modelHash  },
      config: { stored: record.configHash, current: currentConfigHash, match: currentConfigHash === record.configHash },
      output: { stored: record.outputHash, current: currentOutputHash, match: currentOutputHash === record.outputHash },
    },
    timestamp: record.timestamp,
    verifiedAt: new Date().toISOString(),
  };
}

module.exports = { createInference, verifyInference };
