/**
 * Inference routes.
 * POST /api/inference/create
 * POST /api/inference/verify
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { createInference: createSchema, verifyInference: verifySchema } = require('../validators/inference.validator');
const { createInference, verifyInference } = require('../controllers/inference.controller');

router.post('/inference/create', validate(createSchema), createInference);
router.post('/inference/verify', validate(verifySchema), verifyInference);

module.exports = router;
