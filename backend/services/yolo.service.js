/**
 * YOLO detection service.
 * Calls the Python/CV service via HTTP, normalises the response.
 * Does NOT implement any CV logic in Node — all inference is in Python.
 */
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Send an image to the Python YOLO service and return normalised detections.
 *
 * @param {string} imagePath    Absolute path to the uploaded image file
 * @param {object} options
 * @param {number} [options.confidence=0.25]  Minimum confidence threshold
 * @param {string} [options.model='yolov8n']  YOLO model variant
 * @returns {Promise<object>}   Normalised detection result
 */
async function detect(imagePath, options = {}) {
  const { confidence = 0.25, model = 'yolov8n' } = options;

  // Build multipart request to the Python service
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('confidence', String(confidence));
  form.append('model', model);

  let pythonResponse;
  try {
    pythonResponse = await axios.post(
      `${config.pythonServiceUrl}/detect`,
      form,
      {
        headers: form.getHeaders(),
        timeout: config.pythonServiceTimeout,
        proxy: false,
      }
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new AppError(
        `Python/YOLO service timed out after ${config.pythonServiceTimeout}ms`,
        504,
        'PYTHON_SERVICE_TIMEOUT'
      );
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      throw new AppError(
        'Python/YOLO service is unavailable. Start the Python service and retry.',
        503,
        'PYTHON_SERVICE_UNAVAILABLE'
      );
    }
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.message;
    throw new AppError(`Python service error: ${msg}`, status, 'PYTHON_SERVICE_ERROR');
  }

  return normaliseDetectionResponse(pythonResponse.data, imagePath);
}

/**
 * Normalise whatever shape the Python service returns into the CV-TRUST contract.
 * The Python service may return various formats — we handle the common cases.
 */
function normaliseDetectionResponse(data, imagePath) {
  const path = require('path');

  // Already in our expected format
  if (Array.isArray(data?.objects)) {
    return {
      objects: data.objects.map(normaliseObject),
      image: data.image || path.basename(imagePath),
      processingTime: data.processingTime || data.processing_time || null,
      modelUsed: data.model || data.modelUsed || null,
      rawCount: data.objects.length,
      // New fields from updated Python service
      modelHash:          data.modelHash || null,
      device:             data.device || null,
      imgsz:              data.imgsz || null,
      confidenceThreshold: data.confidenceThreshold || null,
      maxDet:             data.maxDet || null,
      imageStats:         data.imageStats || null,
      shiftAnalysis:      data.shiftAnalysis || null,
    };
  }

  // Python might return { detections: [...] }
  if (Array.isArray(data?.detections)) {
    return {
      objects: data.detections.map(normaliseObject),
      image: data.image || path.basename(imagePath),
      processingTime: data.processing_time || null,
      modelUsed: data.model || null,
      rawCount: data.detections.length,
      modelHash: null, device: null, imgsz: null,
      confidenceThreshold: null, maxDet: null,
      imageStats: null, shiftAnalysis: null,
    };
  }

  // Python might return { results: [...] }
  if (Array.isArray(data?.results)) {
    return {
      objects: data.results.map(normaliseObject),
      image: data.image || path.basename(imagePath),
      processingTime: data.processing_time || null,
      modelUsed: data.model || null,
      rawCount: data.results.length,
      modelHash: null, device: null, imgsz: null,
      confidenceThreshold: null, maxDet: null,
      imageStats: null, shiftAnalysis: null,
    };
  }

  // Flat array
  if (Array.isArray(data)) {
    return {
      objects: data.map(normaliseObject),
      image: path.basename(imagePath),
      processingTime: null,
      modelUsed: null,
      rawCount: data.length,
      modelHash: null, device: null, imgsz: null,
      confidenceThreshold: null, maxDet: null,
      imageStats: null, shiftAnalysis: null,
    };
  }

  logger.warn(`YOLO service returned unexpected shape: ${JSON.stringify(data)}`);
  throw new AppError(
    'Python service returned an unrecognised response format',
    502,
    'PYTHON_RESPONSE_FORMAT_ERROR'
  );
}

/**
 * Normalise a single detection object into the CV-TRUST schema.
 */
function normaliseObject(det) {
  const confidence = parseFloat(det.confidence || det.score || det.conf || 0);
  if (!Number.isFinite(confidence)) {
    throw new AppError('Python service returned a detection with invalid confidence', 502, 'PYTHON_RESPONSE_FORMAT_ERROR');
  }

  return {
    label: det.label || det.class || det.class_name || det.name || 'unknown',
    confidence,
    bbox: det.bbox || det.box || det.bounding_box || null,
  };
}

module.exports = { detect };
