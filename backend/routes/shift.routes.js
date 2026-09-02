/**
 * Shift analysis route.
 * POST /api/shift/analyze
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { analyzeShift: schema } = require('../validators/shift.validator');
const { analyzeShift } = require('../controllers/shift.controller');

router.post('/shift/analyze', validate(schema), analyzeShift);

module.exports = router;
