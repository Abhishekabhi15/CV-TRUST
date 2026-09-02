/**
 * Model verification controller — Phase 3.
 * POST /api/models/verify
 */
const asyncHandler = require('../utils/asyncHandler');
const modelService = require('../services/model.service');
const { createAuditEvent } = require('../services/audit.service');
const { saveFindings } = require('../services/findings.service');

const verifyModel = asyncHandler(async (req, res) => {
  const { modelPath, trustedHash, framework } = req.body;

  const result = await modelService.verifyModel(modelPath, trustedHash || null, { framework });

  if (result.status === 'SUSPICIOUS') {
    await saveFindings(
      [
        {
          type: 'HASH_MISMATCH',
          severity: 'HIGH',
          reason: `Model hash mismatch for ${result.modelName}`,
          evidence: {
            currentModelHash: result.currentModelHash,
            trustedHash: result.trustedHash,
            modelPath: result.modelPath,
          },
          confidence: 1,
        },
      ],
      { source: 'model_verification', relatedId: result.modelRecordId, relatedType: 'model' }
    );
  }

  await createAuditEvent({
    action: 'MODEL_VERIFIED',
    details: {
      modelName: result.modelName,
      status: result.status,
      match: result.match,
    },
  });

  res.status(200).json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { verifyModel };
