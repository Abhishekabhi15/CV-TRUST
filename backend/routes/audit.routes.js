/**
 * Audit logs retrieval route.
 * GET /api/audit-logs
 */
const router = require('express').Router();
const { getAuditLogs } = require('../controllers/audit.controller');

router.get('/audit-logs', getAuditLogs);

module.exports = router;
