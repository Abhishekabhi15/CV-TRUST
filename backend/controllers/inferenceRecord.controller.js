/**
 * InferenceRecord controller.
 * GET /api/inference/records        — paginated list
 * GET /api/inference/records/:id    — single record
 * GET /api/inference/stats          — aggregated statistics
 */
const asyncHandler = require('../utils/asyncHandler');
const inferenceRecordService = require('../services/inferenceRecord.service');

const listInferenceRecords = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await inferenceRecordService.getInferenceRecords({ page, limit });

  res.status(200).json({
    success: true,
    data: result.records,
    pagination: result.pagination,
    meta: { timestamp: new Date().toISOString() },
  });
});

const getInferenceRecord = asyncHandler(async (req, res) => {
  const record = await inferenceRecordService.getInferenceRecordById(req.params.id);
  res.status(200).json({
    success: true,
    data: record,
    meta: { timestamp: new Date().toISOString() },
  });
});

const getInferenceStats = asyncHandler(async (req, res) => {
  const stats = await inferenceRecordService.getInferenceStats();
  res.status(200).json({
    success: true,
    data: stats,
    meta: { timestamp: new Date().toISOString() },
  });
});

module.exports = { listInferenceRecords, getInferenceRecord, getInferenceStats };
