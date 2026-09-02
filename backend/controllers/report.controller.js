/**
 * Assurance report controller — Phase 9.
 * GET /api/reports/:id — retrieve existing report, or use id=latest to generate from current findings.
 */
const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/report.service');
const { createAuditEvent } = require('../services/audit.service');

const getReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = id === 'latest'
    ? await reportService.generateReport({ title: 'CV-TRUST Assurance Report' })
    : await reportService.getReportById(id);

  if (id === 'latest') {
    await createAuditEvent({
      action: 'REPORT_GENERATED',
      relatedId: String(report._id),
      relatedType: 'report',
      details: {
        overallRisk: report.overallRisk,
        recommendation: report.recommendation,
        findingCount: report.findingIds?.length || 0,
      },
    });
  }

  res.status(200).json({
    success: true,
    data: report,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { getReport };
