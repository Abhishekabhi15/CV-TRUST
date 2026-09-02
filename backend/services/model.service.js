/**
 * Model verification service.
 * Computes a real SHA-256 hash of a model file and compares it to a trusted hash.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const CVModel = require('../models/CVModel');
const { hashFile } = require('../utils/hash');
const AppError = require('../utils/AppError');

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Verify the integrity of a model file.
 *
 * @param {string} modelPath   Path to the model file (relative or absolute)
 * @param {string|null} trustedHash  Expected SHA-256 hex (64 chars), or null to skip comparison
 * @returns {Promise<object>}  Verification result
 */
async function verifyModel(modelPath, trustedHash = null, options = {}) {
  const resolvedPath = path.resolve(modelPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new AppError(
      `Model file not found: ${resolvedPath}`,
      404,
      'MODEL_FILE_NOT_FOUND'
    );
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new AppError(
      `Path is not a file: ${resolvedPath}`,
      400,
      'NOT_A_FILE'
    );
  }

  const currentModelHash = await hashFile(resolvedPath);
  const modelName = path.basename(resolvedPath);

  if (!trustedHash) {
    const result = {
      modelName,
      modelPath: resolvedPath,
      currentModelHash,
      currentHash: currentModelHash,
      trustedHash: null,
      match: null,
      status: 'HASH_COMPUTED',
      fileSizeBytes: stat.size,
      verifiedAt: new Date().toISOString(),
    };
    return persistModelResult(result, options);
  }

  const match = currentModelHash.toLowerCase() === trustedHash.toLowerCase();

  const result = {
    modelName,
    modelPath: resolvedPath,
    currentModelHash,
    currentHash: currentModelHash,
    trustedHash: trustedHash.toLowerCase(),
    match,
    status: match ? 'VERIFIED' : 'SUSPICIOUS',
    fileSizeBytes: stat.size,
    verifiedAt: new Date().toISOString(),
  };

  return persistModelResult(result, options);
}

async function persistModelResult(result, options = {}) {
  if (!isDbConnected()) return result;

  const record = await CVModel.create({
    modelName: result.modelName,
    modelPath: result.modelPath,
    framework: options.framework,
    modelHash: result.currentModelHash,
    trustedHash: result.trustedHash,
    match: result.match,
    status: result.status,
    fileSizeBytes: result.fileSizeBytes,
    verifiedAt: result.verifiedAt,
  });

  return {
    ...result,
    modelRecordId: record._id,
  };
}

module.exports = { verifyModel };
