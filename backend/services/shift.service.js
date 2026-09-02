/**
 * Distribution shift analysis service.
 * Compares reference vs incoming distribution values using numeric statistics.
 * Produces a real shift score — nothing is hard-coded.
 */
const datasetService = require('./dataset.service');

function datasetFeaturesToShiftValues(featureSummary) {
  return {
    fileSizeBytes: featureSummary.fileSizeBytes?.mean || 0,
    width: featureSummary.width?.mean || 0,
    height: featureSummary.height?.mean || 0,
    pixelCount: featureSummary.pixelCount?.mean || 0,
    bytesPerPixel: featureSummary.bytesPerPixel?.mean || 0,
  };
}

/**
 * Calculate normalised shift score between two numeric distributions.
 *
 * Algorithm:
 *   For each shared metric key:
 *     - Compute |incoming - reference| / (|reference| + epsilon)   (relative deviation)
 *   Shift score = mean of all per-metric deviations, clamped to [0, 1]
 *
 * @param {object} referenceValues  Baseline statistics object (numeric values)
 * @param {object} incomingValues   Current statistics object (numeric values)
 * @param {string[]} [metrics]      Optional subset of keys to compare
 * @returns {object}  Analysis result
 */
function analyzeShift(referenceValues, incomingValues, metrics) {
  const epsilon = 1e-9;

  // Determine which keys to compare
  const refKeys = Object.keys(referenceValues).filter(
    (k) => typeof referenceValues[k] === 'number'
  );
  const incKeys = Object.keys(incomingValues).filter(
    (k) => typeof incomingValues[k] === 'number'
  );
  const sharedKeys = refKeys.filter((k) => incKeys.includes(k));

  const keysToCompare = metrics && metrics.length > 0
    ? metrics.filter((m) => sharedKeys.includes(m))
    : sharedKeys;

  if (keysToCompare.length === 0) {
    return {
      shiftDetected: false,
      shiftScore: 0,
      status: 'NORMAL',
      details: {
        message: 'No comparable numeric metrics found',
        keysCompared: 0,
      },
    };
  }

  const metricDetails = {};
  let totalDeviation = 0;

  for (const key of keysToCompare) {
    const ref = referenceValues[key];
    const inc = incomingValues[key];
    const relativeDeviation = Math.abs(inc - ref) / (Math.abs(ref) + epsilon);

    metricDetails[key] = {
      reference: ref,
      incoming: inc,
      absoluteDifference: parseFloat(Math.abs(inc - ref).toFixed(6)),
      relativeDeviation: parseFloat(relativeDeviation.toFixed(4)),
    };

    totalDeviation += relativeDeviation;
  }

  const rawScore = totalDeviation / keysToCompare.length;
  const shiftScore = parseFloat(Math.min(1, rawScore).toFixed(4));

  // Thresholds: < 0.1 = NORMAL, 0.1–0.3 = MODERATE, > 0.3 = HIGH
  let status;
  if (shiftScore < 0.1) {
    status = 'NORMAL';
  } else if (shiftScore < 0.3) {
    status = 'MODERATE';
  } else {
    status = 'HIGH';
  }

  const shiftDetected = shiftScore >= 0.1;

  return {
    shiftDetected,
    shiftScore,
    status,
    features: Object.fromEntries(
      Object.entries(metricDetails).map(([key, value]) => [key, value.relativeDeviation])
    ),
    details: {
      keysCompared: keysToCompare.length,
      metrics: metricDetails,
    },
    analysedAt: new Date().toISOString(),
  };
}

async function analyzeDatasetShift(referenceDatasetPath, incomingDatasetPath, metrics) {
  const [referenceAnalysis, incomingAnalysis] = await Promise.all([
    datasetService.analyzeDataset(referenceDatasetPath, { checkDuplicates: false, checkAnomalies: false }),
    datasetService.analyzeDataset(incomingDatasetPath, { checkDuplicates: false, checkAnomalies: false }),
  ]);

  const referenceValues = datasetFeaturesToShiftValues(referenceAnalysis.featureSummary || {});
  const incomingValues = datasetFeaturesToShiftValues(incomingAnalysis.featureSummary || {});
  const result = analyzeShift(referenceValues, incomingValues, metrics);

  return {
    ...result,
    referenceDataset: {
      path: referenceDatasetPath,
      totalImages: referenceAnalysis.totalImages,
      featureSummary: referenceAnalysis.featureSummary,
    },
    incomingDataset: {
      path: incomingDatasetPath,
      totalImages: incomingAnalysis.totalImages,
      featureSummary: incomingAnalysis.featureSummary,
    },
  };
}

module.exports = { analyzeShift, analyzeDatasetShift };
