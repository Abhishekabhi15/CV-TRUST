/**
 * Inference integrity controller — Phase 4.
 * POST /api/inference/create
 * POST /api/inference/verify
 */
const asyncHandler = require('../utils/asyncHandler');
const inferenceService = require('../services/inference.service');
const { createAuditEvent } = require('../services/audit.service');
const { saveFindings } = require('../services/findings.service');

const createInference = asyncHandler(async (req, res) => {
  const { modelId, inputData, outputData, config } = req.body;

  const result = await inferenceService.createInference({
    modelId,
    inputData,
    outputData,
    config: config || {},
  });

  await createAuditEvent({
    action: 'INFERENCE_CREATED',
    relatedId: String(result.inferenceId),
    relatedType: 'inference',
    details: { modelId, integrityHash: result.integrityHash },
  });

  res.status(201).json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
});

const verifyInference = asyncHandler(async (req, res) => {
  const { inferenceId } = req.body;

  const result = await inferenceService.verifyInference(inferenceId);

  if (!result.verified) {
    await saveFindings(
      [
        {
          type: 'TAMPERING',
          severity: 'CRITICAL',
          reason: `Inference integrity mismatch detected for ${inferenceId}`,
          evidence: {
            storedHash: result.storedHash,
            currentHash: result.currentHash,
            componentChecks: result.componentChecks,
          },
          confidence: 1,
        },
      ],
      { source: 'inference_check', relatedId: inferenceId, relatedType: 'inference' }
    );
  }

  await createAuditEvent({
    action: 'INFERENCE_VERIFIED',
    relatedId: inferenceId,
    relatedType: 'inference',
    result: result.verified ? 'SUCCESS' : 'FAILURE',
    details: { status: result.status, storedHash: result.storedHash, currentHash: result.currentHash },
  });

  res.status(200).json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { createInference, verifyInference };
