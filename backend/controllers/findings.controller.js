/**
 * Findings retrieval controller — Phase 8.
 * GET /api/findings
 */
const asyncHandler = require('../utils/asyncHandler');
const { getFindings } = require('../services/findings.service');

const getFindingsHandler = asyncHandler(async (req, res) => {
  const { type, severity, status, source, page, limit } = req.query;

  const result = await getFindings({ type, severity, status, source, page, limit });

  res.status(200).json({
    success: true,
    data: result.findings,
    pagination: result.pagination,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { getFindings: getFindingsHandler };
