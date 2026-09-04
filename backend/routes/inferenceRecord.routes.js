/**
 * InferenceRecord routes.
 * GET /api/inference/stats          — aggregated inference statistics
 * GET /api/inference/records        — paginated provenance records
 * GET /api/inference/records/:id    — single provenance record
 */
const router = require('express').Router();
const {
  listInferenceRecords,
  getInferenceRecord,
  getInferenceStats,
} = require('../controllers/inferenceRecord.controller');

router.get('/inference/stats',       getInferenceStats);
router.get('/inference/records',     listInferenceRecords);
router.get('/inference/records/:id', getInferenceRecord);

module.exports = router;
