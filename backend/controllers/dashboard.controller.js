/**
 * Dashboard controller.
 * GET /api/dashboard — aggregates all live data in one call.
 *
 * Aggregates:
 *  - System health (backend, MongoDB, Python service)
 *  - Model assurance (from Python /model-info)
 *  - Inference stats (from InferenceRecord collection)
 *  - Distribution shift latest (from ShiftRecord collection)
 *  - Recent audit events
 */
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../config');
const logger = require('../utils/logger');
const inferenceRecordService = require('../services/inferenceRecord.service');
const shiftRecordService = require('../services/shiftRecord.service');
const { getAuditLogs } = require('../services/audit.service');

const isDbConnected = () => mongoose.connection.readyState === 1;

const getDashboard = asyncHandler(async (req, res) => {
  const timestamp = new Date().toISOString();

  // ── System Health ─────────────────────────────────────────────────────────
  const mongoStatus = isDbConnected() ? 'up' : 'down';

  let pythonStatus = 'down';
  let modelInfo = null;
  try {
    const resp = await axios.get(`${config.pythonServiceUrl}/model-info`, {
      timeout: 6000,
      httpAgent:  new http.Agent({ keepAlive: false }),
      httpsAgent: new https.Agent({ keepAlive: false }),
      proxy: false,
    });
    pythonStatus = 'up';
    modelInfo = resp.data;
  } catch {
    pythonStatus = 'down';
  }

  // ── Inference Stats ───────────────────────────────────────────────────────
  let inferenceStats = {
    total: 0, successful: 0, failed: 0,
    avgProcessingTimeMs: 0, lastInferenceTime: null,
    lastInferenceId: null, lastObjectCount: 0,
  };
  try {
    inferenceStats = await inferenceRecordService.getInferenceStats();
  } catch (err) {
    logger.warn(`Dashboard: could not fetch inference stats: ${err.message}`);
  }

  // ── Distribution Shift Latest ─────────────────────────────────────────────
  let latestShift = null;
  try {
    latestShift = await shiftRecordService.getLatestShift();
  } catch (err) {
    logger.warn(`Dashboard: could not fetch shift record: ${err.message}`);
  }

  // ── Recent Audit Events (last 5) ──────────────────────────────────────────
  let recentEvents = [];
  try {
    const { logs } = await getAuditLogs({ limit: 5, page: 1 });
    recentEvents = logs;
  } catch (err) {
    logger.warn(`Dashboard: could not fetch audit logs: ${err.message}`);
  }

  // ── Model Assurance Status ────────────────────────────────────────────────
  const hashComputed = modelInfo && typeof modelInfo.modelHash === 'string' && modelInfo.modelHash.length === 64;
  const modelLoaded  = modelInfo?.loadStatus === 'loaded';
  const modelAssuranceStatus = modelLoaded && hashComputed ? 'AVAILABLE' : 'UNAVAILABLE';

  // ── Overall System Status ─────────────────────────────────────────────────
  const services = [mongoStatus, pythonStatus];
  const upCount = services.filter((s) => s === 'up').length;
  const overallStatus = upCount === services.length ? 'OK'
    : upCount > 0 ? 'PARTIAL'
    : 'DEGRADED';

  res.status(200).json({
    success: true,
    data: {
      system: {
        status:        overallStatus,
        uptime:        Math.floor(process.uptime()),
        backendStatus: 'up',
        mongoStatus,
        pythonStatus,
      },
      modelAssurance: {
        modelName:          modelInfo?.modelName || 'yolov8n',
        modelVersion:       modelInfo?.modelVersion || '8.0',
        framework:          modelInfo?.framework || 'Ultralytics',
        device:             modelInfo?.device || 'cpu',
        imgsz:              modelInfo?.imgsz || 640,
        confidenceThreshold: modelInfo?.confidenceThreshold || 0.20,
        modelHash:          modelInfo?.modelHash || null,
        fileSizeBytes:      modelInfo?.fileSizeBytes || null,
        loadStatus:         modelInfo?.loadStatus || 'unknown',
        verificationStatus: modelAssuranceStatus,
        lastVerifiedAt:     modelInfo?.verifiedAt || null,
      },
      inferenceProvenance: {
        total:               inferenceStats.total,
        successful:          inferenceStats.successful,
        failed:              inferenceStats.failed,
        avgProcessingTimeMs: inferenceStats.avgProcessingTimeMs,
        lastInferenceTime:   inferenceStats.lastInferenceTime,
        lastInferenceId:     inferenceStats.lastInferenceId,
        lastObjectCount:     inferenceStats.lastObjectCount,
      },
      distributionShift: {
        shiftStatus:    latestShift?.shiftStatus   || 'No data',
        shiftScore:     latestShift?.shiftScore    ?? null,
        shiftDetected:  latestShift?.shiftDetected ?? null,
        lastAnalysedImage: latestShift?.imageName  || null,
        lastAnalysedAt: latestShift?.analysedAt    || null,
      },
      recentEvents,
    },
    meta: { timestamp },
  });
});

module.exports = { getDashboard };
