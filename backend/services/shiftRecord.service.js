/**
 * ShiftRecord service.
 * Saves and retrieves per-image distribution shift analysis results.
 */
const mongoose = require('mongoose');
const ShiftRecord = require('../models/ShiftRecord');

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Save a shift analysis result.
 *
 * @param {object} data
 * @param {string} data.imageName
 * @param {object} data.imageStats         From Python /detect imageStats
 * @param {object} [data.shiftAnalysis]    From Python /detect shiftAnalysis
 * @param {string|null} [data.inferenceRecordId]
 * @returns {Promise<object|null>}
 */
async function saveShiftResult(data) {
  if (!isDbConnected()) return null;

  const shift = data.shiftAnalysis || {};

  const record = await ShiftRecord.create({
    imageName:         data.imageName || 'unknown',
    inferenceRecordId: data.inferenceRecordId || undefined,
    imageStats:        data.imageStats || {},
    baselineStats:     shift.baselineStats || {},
    shiftScore:        shift.shiftScore ?? 0,
    shiftStatus:       shift.shiftStatus || 'UNKNOWN',
    shiftDetected:     shift.shiftDetected ?? false,
    metrics:           shift.metrics || {},
    baselineSource:    shift.baselineSource || 'reference-dataset',
    baselineSamples:   shift.baselineSamples || 0,
    analysedAt:        new Date().toISOString(),
  });

  return record;
}

/**
 * Retrieve the most recent shift analysis record.
 */
async function getLatestShift() {
  if (!isDbConnected()) {
    return { dbStatus: 'unavailable', shiftStatus: 'UNKNOWN', shiftScore: null };
  }

  const record = await ShiftRecord.findOne().sort({ createdAt: -1 }).lean();
  return record || null;
}

/**
 * Retrieve paginated shift records.
 */
async function getShiftRecords({ page = 1, limit = 20 } = {}) {
  if (!isDbConnected()) {
    return { records: [], pagination: { page: 1, limit, total: 0, pages: 0 }, dbStatus: 'unavailable' };
  }

  const safePage  = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [records, total] = await Promise.all([
    ShiftRecord.find().sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ShiftRecord.countDocuments(),
  ]);

  return {
    records,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

module.exports = { saveShiftResult, getLatestShift, getShiftRecords };
