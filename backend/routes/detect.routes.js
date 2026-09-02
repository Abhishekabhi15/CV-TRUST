/**
 * Object detection route — Phase 2.
 * POST /api/detect  (multipart/form-data, field: image)
 */
const router = require('express').Router();
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const { detect: schema } = require('../validators/detect.validator');
const { detectObjects } = require('../controllers/detect.controller');

// multer processes the 'image' field; errors propagate to errorHandler
router.post('/detect', upload.single('image'), validate(schema), detectObjects);

module.exports = router;
