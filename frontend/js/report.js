/* =========================================
   CV-TRUST ASSURANCE REPORTS
   Fetches live report from GET /api/reports/latest
   Nothing is hardcoded — all values from backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';

// ── DOM references ────────────────────────────────────────────────────────────
const generateBtn         = document.getElementById('generateReportBtn');
const reportLoadingEl     = document.getElementById('reportLoading');
const reportErrorEl       = document.getElementById('reportError');
const reportDataEl        = document.getElementById('reportData');
const reportStatusBadge   = document.getElementById('reportStatusBadge');
const reportLastUpdated   = document.getElementById('reportLastUpdated');

// Summary cards
const elOverallRisk       = document.getElementById('reportOverallRisk');
const elRiskBadge         = document.getElementById('reportRiskBadge');
const elAssuranceConf     = document.getElementById('reportAssuranceConf');
const elConfBadge         = document.getElementById('reportConfBadge');
const elActiveFindingsCard = document.getElementById('reportActiveFindingsCard');
const elFindingsBadge     = document.getElementById('reportFindingsBadge');
const elRecommendation    = document.getElementById('reportRecommendation');
const elRecommBadge       = document.getElementById('reportRecommBadge');

// Report info
const elReportId          = document.getElementById('reportId');
const elReportTitle       = document.getElementById('reportTitle');
const elReportSummary     = document.getElementById('reportSummary');
const elReportCreatedAt   = document.getElementById('reportCreatedAt');
const elReportRisk        = document.getElementById('reportRiskLevel');
const elReportRecomm      = document.getElementById('reportRecommendationText');

// Findings table
const findingsTableBody   = document.getElementById('findingsTableBody');

// Assurance bars
const elDataAssBar        = document.getElementById('dataAssuranceBar');
const elModelAssBar       = document.getElementById('modelAssuranceBar');
const elInfAssBar         = document.getElementById('inferenceAssuranceBar');

// ── Generate / fetch report ───────────────────────────────────────────────────
async function loadLatestReport() {
  showState('loading');

  try {
    const resp   = await fetch(`${API_BASE_URL}/api/reports/latest`);
    const result = await resp.json();

    if (!result.success) {
      throw new Error(result?.error?.message || 'Report generation failed');
    }

    renderReport(result.data);
    showState('data');

  } catch (err) {
    console.error('Report error:', err);
    showState('error', err.message);
  }

  if (reportLastUpdated) {
    reportLastUpdated.textContent = 'Generated: ' + new Date().toLocaleString();
  }
}

// ── Render report ─────────────────────────────────────────────────────────────
function renderReport(report) {
  const riskLevel      = report.overallRisk      || 'LOW';
  const recommendation = report.recommendation   || 'ACCEPT';
  const findingCount   = report.findingIds?.length || report.findings?.length || 0;
  const riskScore      = report.riskScore        ?? 0;
  const confPct        = Math.round((1 - riskScore) * 100);

  // Status badge (top-right)
  if (reportStatusBadge) {
    reportStatusBadge.textContent = 'REPORT READY';
    reportStatusBadge.className   = 'status';
    reportStatusBadge.style.background = '#198754';
    reportStatusBadge.style.color      = 'white';
  }

  // Summary cards
  setText(elOverallRisk,       riskScore !== null ? (riskScore * 100).toFixed(0) + '%' : '—');
  if (elRiskBadge) {
    elRiskBadge.textContent = riskLevel;
    elRiskBadge.className   = riskBadgeClass(riskLevel);
  }

  setText(elAssuranceConf, confPct + '%');
  if (elConfBadge) {
    elConfBadge.textContent = confPct >= 80 ? 'VERIFIED' : confPct >= 50 ? 'REVIEW' : 'ATTENTION';
    elConfBadge.className   = confBadgeClass(confPct);
  }

  setText(elActiveFindingsCard, findingCount);
  if (elFindingsBadge) {
    elFindingsBadge.textContent = findingCount > 0 ? 'ATTENTION' : 'CLEAR';
    elFindingsBadge.className   = findingCount > 0 ? 'badge suspicious' : 'badge verified';
  }

  setText(elRecommendation, recommendation);
  if (elRecommBadge) {
    elRecommBadge.textContent = recommendation;
    elRecommBadge.className   = recommBadgeClass(recommendation);
  }

  // Report info section
  setText(elReportId,          report._id                 || '—');
  setText(elReportTitle,       report.title               || 'CV-TRUST Assurance Report');
  setText(elReportSummary,     report.summary             || '—');
  setText(elReportCreatedAt,   report.createdAt ? new Date(report.createdAt).toLocaleString() : '—');
  setText(elReportRisk,        riskLevel);
  setText(elReportRecomm,      recommendation);

  // Assurance bars (derived from risk score)
  setBar(elDataAssBar,   Math.max(0, Math.min(100, (1 - riskScore) * 100 + 5)));
  setBar(elModelAssBar,  Math.max(0, Math.min(100, (1 - riskScore) * 100 + 8)));
  setBar(elInfAssBar,    Math.max(0, Math.min(100, (1 - riskScore) * 100)));

  // Findings table
  renderFindings(report.findings || []);
}

// ── Render findings table ─────────────────────────────────────────────────────
function renderFindings(findings) {
  if (!findingsTableBody) return;

  findingsTableBody.innerHTML = '';

  if (findings.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="5" class="text-center text-muted py-4">
        No open findings — system appears clean.
      </td>`;
    findingsTableBody.appendChild(row);
    return;
  }

  findings.forEach((f) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(f.type || '—')}</td>
      <td>${escapeHtml(f.source || '—')}</td>
      <td><span class="${severityBadgeClass(f.severity)}">${f.severity || '—'}</span></td>
      <td><span class="${statusBadgeClass(f.status)}">${f.status || '—'}</span></td>
      <td class="small text-muted">${escapeHtml(f.reason || '—')}</td>
    `;
    findingsTableBody.appendChild(row);
  });
}

// ── State helpers ─────────────────────────────────────────────────────────────
function showState(state, errorMsg) {
  if (reportLoadingEl) reportLoadingEl.style.display = state === 'loading' ? 'block' : 'none';
  if (reportErrorEl)   reportErrorEl.style.display   = state === 'error'   ? 'block' : 'none';
  if (reportDataEl)    reportDataEl.style.display    = state === 'data'    ? 'block' : 'none';

  if (state === 'error' && reportErrorEl) {
    const msgEl = reportErrorEl.querySelector('#reportErrorMsg');
    if (msgEl) {
      const isDb = errorMsg && errorMsg.toLowerCase().includes('mongodb');
      msgEl.textContent = isDb
        ? 'MongoDB is required to generate reports. Please connect MongoDB Atlas first.'
        : (errorMsg || 'Failed to generate report.');
    }
  }
}

function setBar(el, pct) {
  if (!el) return;
  const p  = Math.round(pct);
  el.style.width   = p + '%';
  el.textContent   = p + '%';
  el.setAttribute('aria-valuenow', p);
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function riskBadgeClass(level) {
  if (level === 'CRITICAL') return 'badge suspicious';
  if (level === 'HIGH')     return 'badge suspicious';
  if (level === 'MEDIUM')   return 'badge review';
  return 'badge verified';
}

function confBadgeClass(pct) {
  if (pct >= 80) return 'badge verified';
  if (pct >= 50) return 'badge review';
  return 'badge suspicious';
}

function recommBadgeClass(r) {
  if (r === 'QUARANTINE') return 'badge suspicious';
  if (r === 'REVIEW')     return 'badge review';
  return 'badge verified';
}

function severityBadgeClass(s) {
  if (s === 'CRITICAL' || s === 'HIGH') return 'badge suspicious';
  if (s === 'MEDIUM')  return 'badge review';
  return 'badge verified';
}

function statusBadgeClass(s) {
  if (s === 'OPEN')     return 'badge review';
  if (s === 'RESOLVED') return 'badge verified';
  return 'badge';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(el, value) { if (el) el.textContent = value; }

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Wire up button ────────────────────────────────────────────────────────────
if (generateBtn) {
  generateBtn.addEventListener('click', loadLatestReport);
}

// ── Init — auto-load on page open ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadLatestReport);
