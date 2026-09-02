/**
 * Dataset analysis route.
 * POST /api/datasets/analyze
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { analyzeDataset: schema } = require('../validators/dataset.validator');
const { analyzeDataset } = require('../controllers/dataset.controller');

router.post('/datasets/analyze', validate(schema), analyzeDataset);

module.exports = router;
