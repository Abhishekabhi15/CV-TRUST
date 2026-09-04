/**
 * Shift routes.
 * POST /api/shift/analyze   — analyze shift from numeric values or dataset paths (existing)
 * GET  /api/shift/latest    — retrieve the most recent shift analysis record
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { analyzeShift: schema } = require('../validators/shift.validator');
const { analyzeShift, getLatestShift } = require('../controllers/shift.controller');

router.post('/shift/analyze', validate(schema), analyzeShift);
router.get('/shift/latest', getLatestShift);

module.exports = router;
