/**
 * Dataset analysis controller — Phase 5.
 * POST /api/datasets/analyze
 */
const asyncHandler = require('../utils/asyncHandler');
const datasetService = require('../services/dataset.service');
const datasetModel = require('../models/Dataset');
const { saveFindings } = require('../services/findings.service');
const { createAuditEvent } = require('../services/audit.service');
const logger = require('../utils/logger');

const analyzeDataset = asyncHandler(async (req, res) => {
  const { datasetPath, options } = req.body;

  const result = await datasetService.analyzeDataset(datasetPath, options || {});

  let datasetId = null;

  // Persist dataset analysis record (best-effort — non-fatal if DB unavailable)
  try {
    const datasetRecord = await datasetModel.create({
      datasetPath,
      sampleCount: result.totalImages,
      uniqueCount: result.uniqueImages,
      duplicateCount: result.duplicateCount,
      integrityStatus: result.integrityStatus,
      riskScore: result.riskScore,
      duplicates: result.duplicateGroups,
      anomalies: result.anomalies,
      findings: result.findings,
      analysisOptions: options || {},
    });
    datasetId = datasetRecord._id;

    // Persist individual findings to the findings collection
    if (result.findings && result.findings.length > 0) {
      await saveFindings(result.findings, {
        source: 'dataset_analysis',
        relatedId: String(datasetRecord._id),
        relatedType: 'dataset',
      });
    }

    await createAuditEvent({
      action: 'DATASET_ANALYZED',
      relatedId: String(datasetRecord._id),
      relatedType: 'dataset',
      details: {
        totalImages: result.totalImages,
        duplicateCount: result.duplicateCount,
        riskScore: result.riskScore,
        integrityStatus: result.integrityStatus,
      },
    });
  } catch (dbErr) {
    logger.warn(`Could not persist dataset analysis to MongoDB (DB unavailable?): ${dbErr.message}`);
  }

  res.status(200).json({
    success: true,
    data: {
      datasetId,  // null if DB was unavailable
      ...result,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { analyzeDataset };
