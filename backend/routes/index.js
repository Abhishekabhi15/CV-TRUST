/**
 * Main API router aggregator.
 */
const router = require('express').Router();

router.use(require('./health.routes'));
router.use(require('./dataset.routes'));
router.use(require('./detect.routes'));
router.use(require('./model.routes'));
router.use(require('./inference.routes'));
router.use(require('./inferenceRecord.routes'));   // NEW: provenance list + stats
router.use(require('./shift.routes'));
router.use(require('./findings.routes'));
router.use(require('./report.routes'));
router.use(require('./audit.routes'));
router.use(require('./dashboard.routes'));          // NEW: aggregated dashboard

module.exports = router;
