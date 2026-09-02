/**
 * Distribution shift analysis controller — Phase 6.
 * POST /api/shift/analyze
 */
const asyncHandler = require('../utils/asyncHandler');
const shiftService = require('../services/shift.service');
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

module.exports = { analyzeShift };
