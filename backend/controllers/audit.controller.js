/**
 * Audit log controller — Phase 10.
 * GET /api/audit-logs
 */
const asyncHandler = require('../utils/asyncHandler');
const { getAuditLogs } = require('../services/audit.service');

const getAuditLogsHandler = asyncHandler(async (req, res) => {
  const { action, from, to, page, limit } = req.query;

  const result = await getAuditLogs({ action, from, to, page, limit });

  res.status(200).json({
    success: true,
    data: result.logs,
    pagination: result.pagination,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { getAuditLogs: getAuditLogsHandler };
