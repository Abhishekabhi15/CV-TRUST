/**
 * Model assurance controller.
 *
 * GET  /api/model-assurance   — Live model info from Python service (no file path needed)
 * POST /api/models/verify     — Hash-verify a model file by server-side path (existing)
 */
const asyncHandler = require('../utils/asyncHandler');
const modelService = require('../services/model.service');
const { createAuditEvent } = require('../services/audit.service');
const { saveFindings } = require('../services/findings.service');
const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../config');

/**
 * GET /api/model-assurance
 * Calls the Python service's /model-info endpoint and returns live model assurance data.
 * No server-side file path needed — Python knows its own model.
 */
const getModelAssurance = asyncHandler(async (req, res) => {
  let pythonInfo = null;
  let pythonStatus = 'unknown';

  try {
    const resp = await axios.get(`${config.pythonServiceUrl}/model-info`, {
      timeout: 8000,
      httpAgent:  new http.Agent({ keepAlive: false }),
      httpsAgent: new https.Agent({ keepAlive: false }),
      proxy: false,
    });
    pythonInfo = resp.data;
    pythonStatus = 'ok';
  } catch (err) {
    pythonStatus = 'unavailable';
  }

  if (!pythonInfo) {
    return res.status(200).json({
      success: true,
      data: {
        modelName:         'yolov8n',
        modelVersion:      '8.0',
        framework:         'Ultralytics',
        architecture:      'YOLOv8 Nano',
        device:            'cpu',
        imgsz:             640,
        confidenceThreshold: 0.20,
        maxDet:            300,
        modelHash:         'Not available — Python service unreachable',
        fileSizeBytes:     null,
        loadStatus:        'unknown',
        verificationStatus: 'UNVERIFIED',
        pythonStatus,
        verifiedAt:        new Date().toISOString(),
        note:              'Python service did not respond. Values above are defaults.',
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  // Determine assurance status honestly.
  // AVAILABLE = model is loaded and SHA-256 computed. We cannot claim VERIFIED
  // without a trusted reference hash to compare against. The thesis must not
  // falsely present this as cryptographic verification.
  const hashComputed = typeof pythonInfo.modelHash === 'string' && pythonInfo.modelHash.length === 64;
  const modelLoaded  = pythonInfo.loadStatus === 'loaded';
  const verificationStatus = modelLoaded && hashComputed ? 'AVAILABLE' : 'UNAVAILABLE';

  const assuranceData = {
    modelName:           pythonInfo.modelName  || 'yolov8n',
    modelFile:           pythonInfo.modelFile  || 'yolov8n.pt',
    modelVersion:        pythonInfo.modelVersion || '8.0',
    framework:           pythonInfo.framework  || 'Ultralytics',
    architecture:        'YOLOv8 Nano',
    device:              pythonInfo.device     || 'cpu',
    imgsz:               pythonInfo.imgsz      || 640,
    confidenceThreshold: pythonInfo.confidenceThreshold || 0.20,
    maxDet:              pythonInfo.maxDet     || 300,
    modelHash:           pythonInfo.modelHash  || null,
    fileSizeBytes:       pythonInfo.fileSizeBytes || null,
    loadStatus:          pythonInfo.loadStatus || 'unknown',
    loadTimeMs:          pythonInfo.loadTimeMs || null,
    referenceBaselineAvailable: pythonInfo.referenceBaselineAvailable || false,
    verificationStatus,
    pythonStatus,
    verifiedAt:          pythonInfo.verifiedAt || new Date().toISOString(),
  };

  // Audit log
  await createAuditEvent({
    action: 'MODEL_VERIFIED',
    details: {
      modelName:          assuranceData.modelName,
      status:             assuranceData.verificationStatus,
      hash:               assuranceData.modelHash?.substring(0, 16) + '…',
    },
  });

  res.status(200).json({
    success: true,
    data: assuranceData,
    meta: { timestamp: new Date().toISOString() },
  });
});

/**
 * POST /api/models/verify
 * Hash-verify a model file by server-side path.
 * Existing functionality preserved.
 */
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

module.exports = { getModelAssurance, verifyModel };
