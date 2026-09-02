/**
 * Health check route.
 * GET /api/health
 */
const router = require('express').Router();
const { getHealth } = require('../controllers/health.controller');

router.get('/health', getHealth);

module.exports = router;
