/* =========================================
   CV-TRUST DISTRIBUTION SHIFT
   Fetches live shift data from GET /api/shift/latest
   Nothing is hardcoded — all values from backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';

// ── DOM references ────────────────────────────────────────────────────────────
const statusBadge       = document.getElementById('shiftStatusBadge');
const lastUpdatedEl     = document.getElementById('shiftLastUpdated');

// Summary cards
const elShiftScore      = document.getElementById('shiftScoreValue');
const elShiftStatus     = document.getElementById('shiftStatusValue');
const elLastImage       = document.getElementById('shiftLastImage');
const elBaselineSamples = document.getElementById('shiftBaselineSamples');

// Risk section
const elRiskValue       = document.getElementById('shiftRiskValue');
const elRiskBar         = document.getElementById('shiftRiskBar');
const elRiskMessage     = document.getElementById('shiftRiskMessage');

// Metric rows (container)
const elMetricsContainer = document.getElementById('shiftMetricsContainer');

// Loading / error states
const elLoading         = document.getElementById('shiftLoadingState');
const elError           = document.getElementById('shiftErrorState');
const elData            = document.getElementById('shiftDataState');

// Image stats (from latest detection)
const elImgWidth        = document.getElementById('imgStatWidth');
const elImgHeight       = document.getElementById('imgStatHeight');
const elImgBrightness   = document.getElementById('imgStatBrightness');
const elImgContrast     = document.getElementById('imgStatContrast');
const elImgAspect       = document.getElementById('imgStatAspect');

// ── Load latest shift record ──────────────────────────────────────────────────
async function loadLatestShift() {
  showState('loading');

  try {
    const resp   = await fetch(`${API_BASE_URL}/api/shift/latest`);
    const result = await resp.json();

    if (!result.success) throw new Error(result?.error?.message || 'Shift request failed');

    const data = result.data;

    if (!data || data.shiftStatus === null) {
      showState('data');
      renderNoData();
      return;
    }

    renderShiftData(data);
    showState('data');

  } catch (err) {
    console.error('Shift load error:', err);
    showState('error', err.message);
  }

  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  }
}

// ── Render shift data ─────────────────────────────────────────────────────────
function renderShiftData(data) {
  const score  = data.shiftScore ?? 0;
  const status = data.shiftStatus || 'UNKNOWN';
  const pct    = Math.round(score * 100);

  // Status badge (top-right)
  if (statusBadge) {
    statusBadge.textContent = status;
    statusBadge.className   = statusClass(status) + ' status';
  }

  // Summary cards
  setText(elShiftScore,      pct + '%');
  setText(elShiftStatus,     status);
  setText(elLastImage,       data.imageName || '—');
  setText(elBaselineSamples, data.baselineSamples != null ? data.baselineSamples : '—');

  // Risk section
  setText(elRiskValue, pct + '%');
  if (elRiskBar) {
    elRiskBar.style.width   = pct + '%';
    elRiskBar.style.background = riskColor(status);
  }
  if (elRiskMessage) {
    elRiskMessage.textContent = riskMessage(status, score);
    elRiskMessage.className   = riskMessageClass(status);
  }

  // Per-metric breakdown
  if (elMetricsContainer && data.metrics) {
    renderMetrics(data.metrics);
  }

  // Image stats
  const stats = data.imageStats || {};
  setText(elImgWidth,      stats.width     ? stats.width + ' px'    : '—');
  setText(elImgHeight,     stats.height    ? stats.height + ' px'   : '—');
  setText(elImgBrightness, stats.brightness != null ? stats.brightness.toFixed(1) : '—');
  setText(elImgContrast,   stats.contrast  != null ? stats.contrast.toFixed(1)   : '—');
  setText(elImgAspect,     stats.aspectRatio != null ? stats.aspectRatio.toFixed(2) : '—');
}

function renderNoData() {
  setText(elShiftScore,  'N/A');
  setText(elShiftStatus, 'No data');
  setText(elLastImage,   'No detection run yet');
  if (statusBadge) {
    statusBadge.textContent = 'NO DATA';
    statusBadge.className   = 'status';
    statusBadge.style.background = '#6b7280';
    statusBadge.style.color = 'white';
  }
  if (elMetricsContainer) {
    elMetricsContainer.innerHTML = `
      <p class="text-muted mt-3">
        No distribution shift data available yet.
        Run a YOLO detection on the <a href="vision.html">Vision Detection</a> page first.
      </p>`;
  }
}

// ── Metric rows ───────────────────────────────────────────────────────────────
function renderMetrics(metrics) {
  if (!elMetricsContainer) return;

  const metricLabels = {
    brightness:  'Image Brightness',
    contrast:    'Image Contrast',
    aspectRatio: 'Aspect Ratio',
    width:       'Image Width',
    height:      'Image Height',
    rMean:       'Red Channel Mean',
    gMean:       'Green Channel Mean',
    bMean:       'Blue Channel Mean',
  };

  const entries = Object.entries(metrics);
  if (entries.length === 0) {
    elMetricsContainer.innerHTML = '<p class="text-muted">No metric details available.</p>';
    return;
  }

  elMetricsContainer.innerHTML = entries.map(([key, val]) => {
    const label    = metricLabels[key] || key;
    const dev      = val.relativeDeviation ?? 0;
    const pct      = Math.round(dev * 100);
    const barClass = pct < 10 ? '#198754' : pct < 30 ? '#ffc107' : '#dc3545';

    return `
      <div class="feature-row">
        <div class="feature-name">
          <span>${escapeHtml(label)}</span>
          <span>
            Baseline: ${val.baseline?.toFixed(2) ?? '—'} &nbsp;|&nbsp;
            Current: ${val.current?.toFixed(2) ?? '—'} &nbsp;|&nbsp;
            Deviation: <strong>${pct}%</strong>
          </span>
        </div>
        <div class="distribution-bar">
          <div class="distribution-fill" style="width:${Math.min(100,pct)}%; background:${barClass};"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusClass(status) {
  if (status === 'NORMAL')   return 'green';
  if (status === 'MODERATE') return 'yellow';
  if (status === 'HIGH')     return 'red';
  return '';
}

function riskColor(status) {
  if (status === 'HIGH')     return '#e63950';
  if (status === 'MODERATE') return '#ffb900';
  return '#198754';
}

function riskMessage(status, score) {
  if (status === 'HIGH')
    return `High distribution shift detected (score: ${(score*100).toFixed(0)}%). ` +
           'This image differs significantly from the reference baseline.';
  if (status === 'MODERATE')
    return `Moderate distribution shift detected (score: ${(score*100).toFixed(0)}%). ` +
           'Review affected features before drawing conclusions.';
  if (status === 'NORMAL')
    return `No significant shift detected (score: ${(score*100).toFixed(0)}%). ` +
           'Image statistics are close to the reference baseline.';
  return 'No data — run a detection to see shift analysis.';
}

function riskMessageClass(status) {
  if (status === 'HIGH')     return 'warning-box' + ' bg-danger text-white border-0';
  if (status === 'MODERATE') return 'warning-box';
  return 'warning-box bg-success text-white border-0';
}

function showState(state, errorMsg) {
  if (elLoading) elLoading.classList.toggle('d-none', state !== 'loading');
  if (elError)   elError.classList.toggle('d-none',   state !== 'error');
  if (elData)    elData.classList.toggle('d-none',    state !== 'data');

  if (state === 'error' && elError) {
    const msgEl = elError.querySelector('#shiftErrorMsg');
    if (msgEl) msgEl.textContent = errorMsg || 'Failed to load shift data.';
  }
}

function setText(el, value) { if (el) el.textContent = value; }

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Refresh button ────────────────────────────────────────────────────────────
const refreshBtn = document.getElementById('shiftRefreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', loadLatestShift);

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadLatestShift);
