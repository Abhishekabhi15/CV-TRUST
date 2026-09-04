/**
 * Distribution shift analysis controller — Phase 6.
 * POST /api/shift/analyze  — analyze shift from numeric values or dataset paths
 * GET  /api/shift/latest   — retrieve the most recent shift analysis from DB
 */
const asyncHandler = require('../utils/asyncHandler');
const shiftService = require('../services/shift.service');
const shiftRecordService = require('../services/shiftRecord.service');
const { saveFindings } = require('../services/findings.service');
const { createAuditEvent } = require('../services/audit.service');
const logger = require('../utils/logger');

const analyzeShift = asyncHandler(async (req, res) => {
  const { referenceDatasetPath, incomingDatasetPath, referenceValues, incomingValues, metrics } = req.body;

  const result = referenceDatasetPath && incomingDatasetPath
    ? await shiftService.analyzeDatasetShift(referenceDatasetPath, incomingDatasetPath, metrics)
    : shiftService.analyzeShift(referenceValues, incomingValues, metrics);

  // If HIGH shift detected, create a finding (best-effort — non-fatal if DB is unavailable)
  if (result.status === 'HIGH' || result.status === 'MODERATE') {
    try {
      await saveFindings(
        [
          {
            type: 'DRIFT',
            severity: result.status === 'HIGH' ? 'HIGH' : 'MEDIUM',
            reason: `Distribution shift detected: ${result.status} (score=${result.shiftScore})`,
            evidence: result.details,
            confidence: Math.min(0.95, result.shiftScore),
          },
        ],
        { source: 'shift_analysis' }
      );
    } catch (dbErr) {
      logger.warn(`Could not persist shift finding (MongoDB unavailable?): ${dbErr.message}`);
    }
  }

  await createAuditEvent({
    action: 'SHIFT_ANALYZED',
    details: { status: result.status, shiftScore: result.shiftScore },
  });

  res.status(200).json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
});

/**
 * GET /api/shift/latest
 * Returns the most recent shift analysis record from MongoDB (saved via /api/detect).
 */
const getLatestShift = asyncHandler(async (req, res) => {
  const record = await shiftRecordService.getLatestShift();

  res.status(200).json({
    success: true,
    data: record || {
      message: 'No shift analysis records found. Run a detection first.',
      shiftStatus: null,
      shiftScore: null,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { analyzeShift, getLatestShift };

