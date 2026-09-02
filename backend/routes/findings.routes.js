/**
 * Findings retrieval route.
 * GET /api/findings
 */
const router = require('express').Router();
const { getFindings } = require('../controllers/findings.controller');

router.get('/findings', getFindings);

module.exports = router;
