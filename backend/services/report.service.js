/**
 * Report generation and retrieval service.
 * Aggregates findings into an assurance report with a computed recommendation.
 */
const Report = require('../models/Report');
const Finding = require('../models/Finding');
const Asset = require('../models/Asset');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Determine overall risk level from a set of findings.
 */
function computeRisk(findings) {
  if (findings.some((f) => f.severity === 'CRITICAL')) return { level: 'CRITICAL', score: 1.0 };
  if (findings.some((f) => f.severity === 'HIGH'))     return { level: 'HIGH',     score: 0.75 };
  if (findings.some((f) => f.severity === 'MEDIUM'))   return { level: 'MEDIUM',   score: 0.5 };
  if (findings.length > 0)                              return { level: 'LOW',      score: 0.25 };
  return { level: 'LOW', score: 0 };
}

/**
 * Determine recommendation from risk level.
 */
function computeRecommendation(riskLevel) {
  if (riskLevel === 'CRITICAL') return 'QUARANTINE';
  if (riskLevel === 'HIGH')     return 'QUARANTINE';
  if (riskLevel === 'MEDIUM')   return 'REVIEW';
  return 'ACCEPT';
}

/**
 * Generate a new assurance report from current OPEN findings.
 * Used internally when a dataset/model analysis concludes.
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string[]} [params.assetIds]
 * @param {string[]} [params.findingIds]   Specific finding IDs to include
 * @returns {Promise<object>}
 */
async function generateReport({ title, assetIds = [], findingIds } = {}) {
  if (!isDbConnected()) {
    throw new AppError('MongoDB is required to generate reports from stored findings', 503, 'DATABASE_UNAVAILABLE');
  }

  let findings;
  if (findingIds && findingIds.length > 0) {
    findings = await Finding.find({ _id: { $in: findingIds } }).lean();
  } else {
    // Default: all OPEN findings
    findings = await Finding.find({ status: 'OPEN' }).sort({ createdAt: -1 }).lean();
  }

  const { level: overallRisk, score: riskScore } = computeRisk(findings);
  const recommendation = computeRecommendation(overallRisk);

  const summary = findings.length === 0
    ? 'No open findings detected. System appears clean.'
    : `${findings.length} finding(s) detected. Risk level: ${overallRisk}. Action: ${recommendation}.`;

  const affectedAssetIds = Array.from(new Set([
    ...assetIds.map(String),
    ...findings.filter((f) => f.assetId).map((f) => String(f.assetId)),
  ]));
  const assets = affectedAssetIds.length > 0
    ? await Asset.find({ _id: { $in: affectedAssetIds } }).lean()
    : [];

  const report = await Report.create({
    title,
    assetIds: affectedAssetIds,
    findingIds: findings.map((f) => f._id),
    findings,
    overallRisk,
    riskScore,
    recommendation,
    summary,
    affectedAssets: assets,
  });

  return report;
}

/**
 * Retrieve an existing report by ID.
 *
 * @param {string} id  MongoDB ObjectId
 * @returns {Promise<object>}
 */
async function getReportById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid report ID: ${id}`, 400, 'INVALID_ID');
  }
  if (!isDbConnected()) {
    throw new AppError('MongoDB is required to retrieve reports', 503, 'DATABASE_UNAVAILABLE');
  }

  const report = await Report.findById(id).lean();
  if (!report) {
    throw new AppError(`Report not found: ${id}`, 404, 'REPORT_NOT_FOUND');
  }
  return report;
}

module.exports = { generateReport, getReportById };
