/**
 * Model routes.
 * GET  /api/model-assurance  — live model info from Python (for Model Assurance page)
 * POST /api/models/verify    — hash-verify model by server-side path (existing)
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { verifyModel: schema } = require('../validators/model.validator');
const { getModelAssurance, verifyModel } = require('../controllers/model.controller');

router.get('/model-assurance', getModelAssurance);
router.post('/models/verify', validate(schema), verifyModel);

module.exports = router;
