/**
 * Dataset analysis service.
 * Detects duplicates (by SHA-256 file hash) and anomalies (by file/dimension statistics).
 * Calls Python service for enhanced analysis when available.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { hashFile } = require('../utils/hash');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif', '.tiff', '.tif']);

/**
 * List all image files recursively in a directory.
 */
function listImages(dir) {
  const results = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/**
 * Detect duplicate images by comparing file content hashes.
 */
async function detectDuplicates(imagePaths) {
  const hashMap = {};  // hash → [file paths]
  for (const fp of imagePaths) {
    try {
      const h = await hashFile(fp);
      if (!hashMap[h]) hashMap[h] = [];
      hashMap[h].push(fp);
    } catch (e) {
      logger.warn(`Could not hash file: ${fp} — ${e.message}`);
    }
  }

  const duplicateGroups = Object.values(hashMap).filter((g) => g.length > 1);
  const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0);

  return { duplicateGroups, duplicateCount };
}

function readImageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if ((ext === '.gif') && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (ext === '.bmp' && buffer.length >= 26) {
    return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
  }

  if ((ext === '.jpg' || ext === '.jpeg') && buffer.length > 4) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }

  return { width: null, height: null };
}

function extractImageFeatures(imagePaths) {
  return imagePaths.map((fp) => {
    const stat = fs.statSync(fp);
    const dimensions = readImageDimensions(fp);
    const pixelCount = dimensions.width && dimensions.height ? dimensions.width * dimensions.height : null;

    return {
      file: path.basename(fp),
      filePath: fp,
      fileSizeBytes: stat.size,
      width: dimensions.width,
      height: dimensions.height,
      pixelCount,
      bytesPerPixel: pixelCount ? stat.size / pixelCount : null,
    };
  });
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values, avg) {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Detect anomalies using simple file-size and dimension statistics.
 * Files that are extreme outliers (> 3 std deviations from mean) are flagged.
 */
function detectAnomalies(features) {
  if (features.length < 2) return { anomalies: [], suspiciousCount: 0 };

  const numericFields = ['fileSizeBytes', 'width', 'height', 'pixelCount', 'bytesPerPixel'];
  const stats = {};
  for (const field of numericFields) {
    const values = features.map((f) => f[field]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    const avg = mean(values);
    stats[field] = { mean: avg, median: median(values), std: std(values, avg) };
  }

  const anomalies = [];
  for (const feature of features) {
    const evidence = {};
    const reasons = [];
    let maxDeviation = 0;

    for (const field of numericFields) {
      const value = feature[field];
      const fieldStats = stats[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      const deviation = fieldStats.std > 0 ? Math.abs(value - fieldStats.mean) / fieldStats.std : 0;
      const medianRatio = fieldStats.median > 0
        ? Math.max(value / fieldStats.median, fieldStats.median / Math.max(value, 1e-9))
        : 1;

      if (deviation > 2.5 || medianRatio >= 4) {
        maxDeviation = Math.max(maxDeviation, deviation);
        evidence[field] = {
          value: Number(value.toFixed(3)),
          mean: Number(fieldStats.mean.toFixed(3)),
          median: Number(fieldStats.median.toFixed(3)),
          std: Number(fieldStats.std.toFixed(3)),
          deviationSigma: Number(deviation.toFixed(2)),
          medianRatio: Number(medianRatio.toFixed(2)),
        };
        reasons.push(`${field} is an outlier`);
      }
    }

    if (reasons.length > 0) {
      anomalies.push({
        file: feature.file,
        filePath: feature.filePath,
        reason: reasons.join('; '),
        deviationSigma: Number(maxDeviation.toFixed(2)),
        evidence,
      });
    }
  }

  return { anomalies, suspiciousCount: anomalies.length };
}

/**
 * Try to call Python service for enhanced analysis; return null if unavailable.
 */
async function tryPythonAnalysis(datasetPath, options) {
  try {
    const res = await axios.post(
      `${config.pythonServiceUrl}/analyze-dataset`,
      { datasetPath, options },
      { timeout: config.pythonServiceTimeout, proxy: false }
    );
    return res.data;
  } catch {
    return null;  // Python service unavailable — fall back to Node analysis
  }
}

/**
 * Analyse a dataset directory.
 *
 * @param {string} datasetPath   Path to dataset directory
 * @param {object} options
 * @param {boolean} [options.checkDuplicates=true]
 * @param {boolean} [options.checkAnomalies=true]
 * @returns {Promise<object>}
 */
async function analyzeDataset(datasetPath, options = {}) {
  const { checkDuplicates = true, checkAnomalies = true, usePython = false } = options;

  const resolvedPath = path.resolve(datasetPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new AppError(`Dataset path not found: ${resolvedPath}`, 404, 'DATASET_NOT_FOUND');
  }
  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new AppError(`Path is not a directory: ${resolvedPath}`, 400, 'NOT_A_DIRECTORY');
  }

  const imagePaths = listImages(resolvedPath);
  const totalImages = imagePaths.length;

  if (totalImages === 0) {
    return {
      totalImages: 0,
      uniqueImages: 0,
      duplicateCount: 0,
      duplicateGroups: [],
      anomalies: [],
      suspiciousCount: 0,
      riskScore: 0,
      integrityStatus: 'CLEAN',
      findings: [],
      source: 'node',
    };
  }

  if (usePython) {
    const pythonResult = await tryPythonAnalysis(resolvedPath, options);
    if (pythonResult) {
      logger.info('Dataset analysis delegated to Python service');
      return { ...pythonResult, source: 'python' };
    }
  }

  logger.info(`Analysing ${totalImages} images in Node`);

  let duplicateGroups = [];
  let duplicateCount = 0;
  let anomalies = [];
  let suspiciousCount = 0;
  const features = extractImageFeatures(imagePaths);

  if (checkDuplicates) {
    ({ duplicateGroups, duplicateCount } = await detectDuplicates(imagePaths));
  }

  if (checkAnomalies) {
    ({ anomalies, suspiciousCount } = detectAnomalies(features));
  }

  const uniqueImages = totalImages - duplicateCount;

  // Risk score: weighted combination of duplicate ratio + anomaly ratio
  const dupRatio = totalImages > 0 ? duplicateCount / totalImages : 0;
  const anomalyRatio = totalImages > 0 ? suspiciousCount / totalImages : 0;
  const riskScore = parseFloat(Math.min(1, dupRatio * 0.5 + anomalyRatio * 0.5).toFixed(3));

  // Determine status
  let integrityStatus = 'CLEAN';
  if (duplicateCount > 0 && suspiciousCount > 0) integrityStatus = 'MIXED';
  else if (duplicateCount > 0) integrityStatus = 'DUPLICATES_FOUND';
  else if (suspiciousCount > 0) integrityStatus = 'ANOMALIES_FOUND';

  // Build findings list
  const findings = [];
  if (duplicateCount > 0) {
    findings.push({
      type: 'DUPLICATE',
      severity: duplicateCount / totalImages > 0.1 ? 'HIGH' : 'MEDIUM',
      reason: `${duplicateCount} duplicate image(s) detected across ${duplicateGroups.length} group(s)`,
      evidence: { duplicateGroups: duplicateGroups.map((g) => g.map((f) => path.basename(f))) },
      confidence: 1.0,
    });
  }
  for (const anomaly of anomalies) {
    findings.push({
      type: 'ANOMALY',
      severity: anomaly.deviationSigma > 5 ? 'HIGH' : 'MEDIUM',
      reason: anomaly.reason,
      evidence: anomaly.evidence,
      confidence: Math.min(0.95, anomaly.deviationSigma / 10),
      file: anomaly.file,
    });
  }

  return {
    totalImages,
    uniqueImages,
    duplicateCount,
    duplicateGroups: duplicateGroups.map((g) => g.map((f) => path.basename(f))),
    anomalies: anomalies.map((a) => ({
      file: a.file,
      reason: a.reason,
      deviationSigma: a.deviationSigma,
      evidence: a.evidence,
    })),
    featureSummary: summarizeFeatures(features),
    suspiciousCount,
    riskScore,
    integrityStatus,
    findings,
    source: 'node',
  };
}

function summarizeFeatures(features) {
  const fields = ['fileSizeBytes', 'width', 'height', 'pixelCount', 'bytesPerPixel'];
  return fields.reduce((summary, field) => {
    const values = features.map((f) => f[field]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    summary[field] = {
      mean: Number(mean(values).toFixed(3)),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
    return summary;
  }, {});
}

module.exports = { analyzeDataset, extractImageFeatures, summarizeFeatures };
