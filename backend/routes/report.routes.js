/**
 * Assurance report routes — Phase 9.
 * GET  /api/reports/:id        — retrieve an existing report
 * Use /api/reports/latest to generate a current report from stored findings.
 */
const router = require('express').Router();
const { getReport } = require('../controllers/report.controller');

router.get('/reports/:id', getReport);

module.exports = router;
