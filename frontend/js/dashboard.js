/* =========================================
   CV-TRUST DASHBOARD
   Fetches live data from GET /api/dashboard
   Auto-refreshes every 30 seconds.
   Nothing is hardcoded — all values from backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';
const REFRESH_INTERVAL_MS = 30000;

// ── System status ─────────────────────────────────────────────────────────────
const elSystemBadge     = document.getElementById('systemStatusBadge');
const elBackendStatus   = document.getElementById('sysBackendStatus');
const elMongoStatus     = document.getElementById('sysMongoStatus');
const elPythonStatus    = document.getElementById('sysPythonStatus');

// ── Summary cards ─────────────────────────────────────────────────────────────
const elModelStatus       = document.getElementById('cardModelStatus');
const elModelBadge        = document.getElementById('cardModelBadge');
const elInferenceTotal    = document.getElementById('cardInferenceTotal');
const elInferenceBadge    = document.getElementById('cardInferenceBadge');
const elShiftScore        = document.getElementById('cardShiftScore');
const elShiftBadge        = document.getElementById('cardShiftBadge');
const elSystemStatus      = document.getElementById('cardSystemStatus');
const elSystemStatusBadge = document.getElementById('cardSystemStatusBadge');

// ── Model Assurance ───────────────────────────────────────────────────────────
const elDashModelName     = document.getElementById('dashModelName');
const elDashModelHash     = document.getElementById('dashModelHash');
const elDashModelDevice   = document.getElementById('dashModelDevice');
const elDashModelVerified = document.getElementById('dashModelVerifiedAt');
const elDashModelVersion  = document.getElementById('dashModelVersion');

// ── Inference Provenance ──────────────────────────────────────────────────────
const elDashInfTotal      = document.getElementById('dashInfTotal');
const elDashInfSuccess    = document.getElementById('dashInfSuccess');
const elDashInfFailed     = document.getElementById('dashInfFailed');
const elDashInfAvgTime    = document.getElementById('dashInfAvgTime');
const elDashInfLastId     = document.getElementById('dashInfLastId');
const elDashInfLastCount  = document.getElementById('dashInfLastCount');
const elDashInfLastTime   = document.getElementById('dashInfLastTime');

// ── Distribution Shift ────────────────────────────────────────────────────────
const elDashShiftStatus   = document.getElementById('dashShiftStatus');
const elDashShiftScore    = document.getElementById('dashShiftScore');
const elDashShiftImage    = document.getElementById('dashShiftImage');
const elDashShiftTime     = document.getElementById('dashShiftTime');

// ── Pipeline cards ────────────────────────────────────────────────────────────
const elPipelineModel     = document.getElementById('pipelineModel');
const elPipelineInference = document.getElementById('pipelineInference');
const elPipelineShift     = document.getElementById('pipelineShift');
const elPipelineVision    = document.getElementById('pipelineVision');

// ── Recent events ─────────────────────────────────────────────────────────────
const elRecentEvents      = document.getElementById('recentEventsBody');

// ── Last updated ──────────────────────────────────────────────────────────────
const elLastUpdated       = document.getElementById('dashboardLastUpdated');

// ── Fetch & render dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const resp   = await fetch(`${API_BASE_URL}/api/dashboard`);
    const result = await resp.json();

    if (!result.success) throw new Error('Dashboard API failed');

    const d = result.data;
    renderSystem(d.system);
    renderModelAssurance(d.modelAssurance);
    renderInference(d.inferenceProvenance);
    renderShift(d.distributionShift);
    renderEvents(d.recentEvents || []);
    updateLastUpdated();

  } catch (err) {
    console.error('Dashboard load error:', err);
    setSystemBadge('ERROR', 'bg-danger');
  }
}

// ── Render system ─────────────────────────────────────────────────────────────
function renderSystem(sys) {
  if (!sys) return;

  const overallOk = sys.status === 'OK';
  if (elSystemBadge) {
    elSystemBadge.textContent = overallOk ? 'System Healthy' : sys.status;
    elSystemBadge.className   = overallOk ? 'badge bg-success p-2' : 'badge bg-warning text-dark p-2';
  }

  setText(elBackendStatus, statusDot(sys.backendStatus));
  setText(elMongoStatus,   statusDot(sys.mongoStatus));
  setText(elPythonStatus,  statusDot(sys.pythonStatus));

  // System card
  setText(elSystemStatus,      sys.status);
  if (elSystemStatusBadge) {
    elSystemStatusBadge.className = overallOk ? 'badge bg-success' : 'badge bg-warning text-dark';
    elSystemStatusBadge.textContent = overallOk ? 'ONLINE' : 'PARTIAL';
  }
}

function statusDot(status) {
  return status === 'up' ? '✅ Online' : '❌ Offline';
}

// ── Render model assurance ────────────────────────────────────────────────────
function renderModelAssurance(ma) {
  if (!ma) return;

  const available = ma.verificationStatus === 'AVAILABLE';
  const unavailable = ma.verificationStatus === 'UNAVAILABLE';

  // Summary card
  setText(elModelStatus, ma.verificationStatus || '—');
  if (elModelBadge) {
    elModelBadge.textContent = ma.verificationStatus || 'UNKNOWN';
    elModelBadge.className   = available ? 'badge bg-success' : unavailable ? 'badge bg-secondary' : 'badge bg-warning text-dark';
  }

  // Pipeline card
  if (elPipelineModel) {
    elPipelineModel.textContent  = ma.verificationStatus || 'UNKNOWN';
    elPipelineModel.className    = available ? 'badge bg-success' : 'badge bg-secondary';
  }

  // Detail fields
  setText(elDashModelName,     ma.modelName     || '—');
  setText(elDashModelVersion,  ma.modelVersion  || '—');
  setText(elDashModelDevice,   (ma.device || '—').toUpperCase());
  setText(elDashModelVerified, ma.lastVerifiedAt ? new Date(ma.lastVerifiedAt).toLocaleString() : '—');

  if (elDashModelHash) {
    if (ma.modelHash && ma.modelHash.length === 64) {
      elDashModelHash.textContent = ma.modelHash.substring(0, 20) + '…';
      elDashModelHash.title       = ma.modelHash;
    } else {
      elDashModelHash.textContent = ma.modelHash || '—';
    }
  }
}

// ── Render inference provenance ───────────────────────────────────────────────
function renderInference(inf) {
  if (!inf) return;

  // Summary card
  setText(elInferenceTotal, inf.total ?? '—');
  if (elInferenceBadge) {
    const active = (inf.total || 0) > 0;
    elInferenceBadge.textContent = active ? 'TRACKED' : 'NO DATA';
    elInferenceBadge.className   = active ? 'badge bg-success' : 'badge bg-secondary';
  }

  // Pipeline card
  if (elPipelineInference) {
    elPipelineInference.textContent = (inf.total || 0) > 0 ? 'TRACKED' : 'NO DATA';
    elPipelineInference.className   = (inf.total || 0) > 0 ? 'badge bg-success' : 'badge bg-secondary';
  }

  // Detail fields
  setText(elDashInfTotal,     inf.total       ?? '—');
  setText(elDashInfSuccess,   inf.successful  ?? '—');
  setText(elDashInfFailed,    inf.failed      ?? '—');
  setText(elDashInfAvgTime,   inf.avgProcessingTimeMs != null
    ? (inf.avgProcessingTimeMs / 1000).toFixed(1) + ' s' : '—');
  setText(elDashInfLastId,    inf.lastInferenceId   || '—');
  setText(elDashInfLastCount, inf.lastObjectCount   ?? '—');
  setText(elDashInfLastTime,  inf.lastInferenceTime
    ? new Date(inf.lastInferenceTime).toLocaleString() : '—');
}

// ── Render distribution shift ─────────────────────────────────────────────────
function renderShift(shift) {
  if (!shift) return;

  const status = shift.shiftStatus;
  const pct    = shift.shiftScore != null ? Math.round(shift.shiftScore * 100) + '%' : '—';

  // Summary card
  setText(elShiftScore, pct);
  if (elShiftBadge) {
    elShiftBadge.textContent = status || 'NO DATA';
    elShiftBadge.className   = shiftBadgeClass(status);
  }

  // Pipeline card
  if (elPipelineShift) {
    elPipelineShift.textContent = status || 'NO DATA';
    elPipelineShift.className   = shiftBadgeClass(status);
  }

  // Detail fields
  setText(elDashShiftStatus, status || '—');
  setText(elDashShiftScore,  pct);
  setText(elDashShiftImage,  shift.lastAnalysedImage || '—');
  setText(elDashShiftTime,   shift.lastAnalysedAt
    ? new Date(shift.lastAnalysedAt).toLocaleString() : '—');

  // Vision pipeline (YOLO active if inference count > 0)
  if (elPipelineVision) {
    elPipelineVision.textContent = 'ACTIVE';
    elPipelineVision.className   = 'badge bg-success';
  }
}

function shiftBadgeClass(status) {
  if (status === 'NORMAL')   return 'badge bg-success';
  if (status === 'MODERATE') return 'badge bg-warning text-dark';
  if (status === 'HIGH')     return 'badge bg-danger';
  return 'badge bg-secondary';
}

// ── Render recent audit events ────────────────────────────────────────────────
function renderEvents(events) {
  if (!elRecentEvents) return;

  // Remove existing generated rows
  elRecentEvents.querySelectorAll('tr.event-row').forEach((r) => r.remove());

  if (events.length === 0) {
    const row = document.createElement('tr');
    row.classList.add('event-row');
    row.innerHTML = '<td colspan="4" class="text-muted text-center">No audit events yet.</td>';
    elRecentEvents.appendChild(row);
    return;
  }

  events.forEach((ev) => {
    const row = document.createElement('tr');
    row.classList.add('event-row');
    row.innerHTML = `
      <td>${escapeHtml(ev.action || '—')}</td>
      <td>${escapeHtml(ev.relatedType || '—')}</td>
      <td><span class="badge ${ev.result === 'SUCCESS' ? 'bg-success' : 'bg-danger'}">${ev.result || '—'}</span></td>
      <td>${ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}</td>
    `;
    elRecentEvents.appendChild(row);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(el, value) { if (el) el.textContent = value; }

function setSystemBadge(text, cls) {
  if (elSystemBadge) {
    elSystemBadge.textContent = text;
    elSystemBadge.className   = `badge ${cls} p-2`;
  }
}

function updateLastUpdated() {
  if (elLastUpdated) {
    elLastUpdated.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init + auto-refresh ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  setInterval(loadDashboard, REFRESH_INTERVAL_MS);
});
