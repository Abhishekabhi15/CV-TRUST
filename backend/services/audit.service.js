/**
 * Audit logging service.
 * Creates tamper-evident audit events using hash chaining.
 * Each event: eventHash = SHA-256(previousHash + timestamp + action + details)
 */
const AuditLog = require('../models/AuditLog');
const { hashString } = require('../utils/hash');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/** Check if MongoDB is currently connected */
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get the hash of the most recent audit log entry (for chaining).
 * @returns {Promise<string>}
 */
async function getLastHash() {
  if (!isDbConnected()) return '0'.repeat(64);
  try {
    const last = await AuditLog.findOne().sort({ createdAt: -1 }).select('eventHash').lean();
    return last?.eventHash || '0'.repeat(64);
  } catch {
    return '0'.repeat(64);
  }
}

/**
 * Create an audit log entry.
 *
 * @param {object} params
 * @param {string} params.action   One of the enum values in AuditLog.action
 * @param {string} [params.user]   User identifier
 * @param {*} [params.assetId]     Related asset ObjectId
 * @param {string} [params.relatedId]   Related record ID
 * @param {string} [params.relatedType] Related record type
 * @param {string} [params.result] SUCCESS | FAILURE | PARTIAL
 * @param {object} [params.details] Any additional context
 * @returns {Promise<object>}  Saved audit log document
 */
async function createAuditEvent({
  action,
  user = 'system',
  assetId,
  relatedId,
  relatedType,
  result = 'SUCCESS',
  details = {},
}) {
  if (!isDbConnected()) {
    logger.debug(`Audit event skipped (MongoDB not connected): ${action}`);
    return null;
  }
  try {
    const timestamp = new Date().toISOString();
    const previousHash = await getLastHash();

    const eventData = JSON.stringify({ action, user, relatedId, relatedType, result, details, timestamp });
    const eventHash = hashString(previousHash + eventData);

    const log = await AuditLog.create({
      action,
      user,
      assetId,
      relatedId,
      relatedType,
      result,
      details,
      previousHash,
      eventHash,
      timestamp,
    });

    return log;
  } catch (err) {
    // Audit log failures must NEVER crash the main operation
    logger.error(`Failed to create audit log for action ${action}: ${err.message}`);
    return null;
  }
}

/**
 * Retrieve paginated audit logs with optional filters.
 *
 * @param {object} filters
 * @param {string} [filters.action]
 * @param {string} [filters.from]   ISO date string
 * @param {string} [filters.to]     ISO date string
 * @param {number} [filters.page=1]
 * @param {number} [filters.limit=50]
 * @returns {Promise<object>}
 */
async function getAuditLogs({ action, from, to, page = 1, limit = 50 } = {}) {
  if (!isDbConnected()) {
    return { logs: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 }, dbStatus: 'unavailable' };
  }

  const query = {};

  if (action) query.action = action;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(to);
  }

  const safePage  = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (safePage - 1) * safeLimit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

module.exports = { createAuditEvent, getAuditLogs };
