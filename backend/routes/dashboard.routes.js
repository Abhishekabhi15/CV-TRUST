/**
 * Dashboard route.
 * GET /api/dashboard — aggregated live dashboard data
 */
const router = require('express').Router();
const { getDashboard } = require('../controllers/dashboard.controller');

router.get('/dashboard', getDashboard);

module.exports = router;
