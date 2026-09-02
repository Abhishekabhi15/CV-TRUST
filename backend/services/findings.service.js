/**
 * Findings retrieval service.
 * Queries Finding documents from MongoDB with filtering and pagination.
 */
const Finding = require('../models/Finding');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Retrieve findings with optional filters.
 *
 * @param {object} filters
 * @param {string} [filters.type]      DUPLICATE | ANOMALY | HASH_MISMATCH | TAMPERING | DRIFT | OTHER
 * @param {string} [filters.severity]  LOW | MEDIUM | HIGH | CRITICAL
 * @param {string} [filters.status]    OPEN | RESOLVED | SUPPRESSED
 * @param {string} [filters.source]    dataset_analysis | model_verification | etc.
 * @param {number} [filters.page=1]
 * @param {number} [filters.limit=20]
 * @returns {Promise<object>}
 */
async function getFindings({ type, severity, status, source, page = 1, limit = 20 } = {}) {
  if (!isDbConnected()) {
    return { findings: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 }, dbStatus: 'unavailable' };
  }

  const query = {};
  if (type)     query.type = type;
  if (severity) query.severity = severity;
  if (status)   query.status = status;
  if (source)   query.source = source;

  const safePage  = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [findings, total] = await Promise.all([
    Finding.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Finding.countDocuments(query),
  ]);

  return {
    findings,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Save finding documents to MongoDB.
 * Used by dataset and other services after analysis.
 *
 * @param {Array} findingsArray  Array of finding objects
 * @param {object} context       Additional context (assetId, source, relatedId, etc.)
 * @returns {Promise<Array>}
 */
async function saveFindings(findingsArray, context = {}) {
  if (!isDbConnected()) return [];

  const docs = findingsArray.map((f) => ({
    ...f,
    source: context.source || 'dataset_analysis',
    assetId: context.assetId,
    relatedRecordId: context.relatedId ? String(context.relatedId) : undefined,
    relatedRecordType: context.relatedType,
  }));

  return Finding.insertMany(docs);
}

module.exports = { getFindings, saveFindings };
