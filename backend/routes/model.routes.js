/**
 * Model verification route.
 * POST /api/models/verify
 */
const router = require('express').Router();
const validate = require('../middleware/validate');
const { verifyModel: schema } = require('../validators/model.validator');
const { verifyModel } = require('../controllers/model.controller');

router.post('/models/verify', validate(schema), verifyModel);

module.exports = router;
