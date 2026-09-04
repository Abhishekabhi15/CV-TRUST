/* =========================================
   CV-TRUST MODEL ASSURANCE
   Fetches live model data from GET /api/model-assurance
   Nothing is hardcoded — all values come from the backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';

// ── DOM references ────────────────────────────────────────────────────────────
const modelStatus       = document.getElementById('modelStatus');
const verifyModelBtn    = document.getElementById('verifyModelBtn');
const lastVerifiedEl    = document.getElementById('lastVerified');
const loadingEl         = document.getElementById('modelLoadingState');
const errorEl           = document.getElementById('modelErrorState');
const dataEl            = document.getElementById('modelDataState');

// Info fields
const elModelName       = document.getElementById('infoModelName');
const elModelVersion    = document.getElementById('infoModelVersion');
const elFramework       = document.getElementById('infoFramework');
const elArchitecture    = document.getElementById('infoArchitecture');
const elDevice          = document.getElementById('infoDevice');
const elImgsz           = document.getElementById('infoImgsz');
const elConfThreshold   = document.getElementById('infoConfThreshold');
const elMaxDet          = document.getElementById('infoMaxDet');
const elModelHash       = document.getElementById('infoModelHash');
const elFileSize        = document.getElementById('infoFileSize');
const elLoadStatus      = document.getElementById('infoLoadStatus');
const elLoadTime        = document.getElementById('infoLoadTime');
const elIntegrityScore  = document.getElementById('integrityScore');
const elIntegrityBar    = document.getElementById('integrityBar');
const elPythonStatus    = document.getElementById('infoPythonStatus');
const elBaselineAvail   = document.getElementById('infoBaselineAvail');

// ── Fetch model assurance data ────────────────────────────────────────────────
async function loadModelAssurance() {
  showState('loading');

  if (verifyModelBtn) {
    verifyModelBtn.disabled = true;
    verifyModelBtn.textContent = 'Verifying…';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/model-assurance`);
    const result   = await response.json();

    if (!result.success) {
      throw new Error(result?.error?.message || 'Model assurance request failed');
    }

    renderModelData(result.data);
    showState('data');

  } catch (err) {
    console.error('Model assurance error:', err);
    showState('error', err.message);
  } finally {
    if (verifyModelBtn) {
      verifyModelBtn.disabled = false;
      verifyModelBtn.textContent = 'Re-verify Model';
    }
  }
}

// ── Render data into DOM ──────────────────────────────────────────────────────
function renderModelData(data) {
  // Status badge
  if (modelStatus) {
    const available = data.verificationStatus === 'AVAILABLE';
    const unavailable = data.verificationStatus === 'UNAVAILABLE';
    modelStatus.textContent  = data.verificationStatus || 'UNKNOWN';
    modelStatus.className    = available
      ? 'badge bg-success p-2'
      : unavailable ? 'badge bg-secondary p-2'
      : 'badge bg-warning text-dark p-2';
  }

  // Last verified
  if (lastVerifiedEl && data.verifiedAt) {
    lastVerifiedEl.textContent = 'Checked: ' + new Date(data.verifiedAt).toLocaleString();
  }

  // Info fields
  setText(elModelName,      data.modelName      || 'N/A');
  setText(elModelVersion,   data.modelVersion   || 'N/A');
  setText(elFramework,      data.framework      || 'N/A');
  setText(elArchitecture,   data.architecture   || 'YOLOv8 Nano');
  setText(elDevice,         (data.device || 'N/A').toUpperCase());
  setText(elImgsz,          data.imgsz != null ? `${data.imgsz}px` : 'N/A');
  setText(elConfThreshold,  data.confidenceThreshold != null
    ? (data.confidenceThreshold * 100).toFixed(0) + '%'
    : 'N/A');
  setText(elMaxDet,         data.maxDet != null ? data.maxDet : 'N/A');
  setText(elLoadStatus,     data.loadStatus     || 'N/A');
  setText(elLoadTime,       data.loadTimeMs != null ? `${data.loadTimeMs} ms` : 'N/A');
  setText(elPythonStatus,   data.pythonStatus   || 'N/A');
  setText(elBaselineAvail,  data.referenceBaselineAvailable ? 'Yes' : 'No');

  // File size
  if (elFileSize) {
    elFileSize.textContent = data.fileSizeBytes
      ? formatFileSize(data.fileSizeBytes)
      : 'N/A';
  }

  // Model hash
  if (elModelHash) {
    if (data.modelHash && data.modelHash.length === 64) {
      elModelHash.textContent = data.modelHash.substring(0, 24) + '…';
      elModelHash.title       = data.modelHash;
    } else {
      elModelHash.textContent = data.modelHash || 'Not available';
    }
  }

  // Integrity score: based on availability, not false verification claim.
  // AVAILABLE = model loaded + hash computed = good operational state
  // This is NOT the same as tamper verification against a trusted reference.
  const available = data.verificationStatus === 'AVAILABLE';
  const score = available ? 100 : 0;
  const barColor = available ? 'bg-success' : 'bg-secondary';
  const scoreLabel = available ? '100% — Hash computed, model loaded' : 'Not available';

  if (elIntegrityScore) {
    elIntegrityScore.textContent = available ? '100%' : 'N/A';
    elIntegrityScore.className   = available ? 'display-6 text-success' : 'display-6 text-secondary';
  }

  if (elIntegrityBar) {
    elIntegrityBar.style.width  = score + '%';
    elIntegrityBar.className    = `progress-bar ${barColor}`;
    elIntegrityBar.textContent  = scoreLabel;
  }
}

// ── State helpers ─────────────────────────────────────────────────────────────
function showState(state, errorMsg) {
  if (loadingEl) loadingEl.classList.toggle('d-none', state !== 'loading');
  if (errorEl)   errorEl.classList.toggle('d-none',   state !== 'error');
  if (dataEl)    dataEl.classList.toggle('d-none',    state !== 'data');

  if (state === 'error' && errorEl) {
    const msgEl = errorEl.querySelector('#modelErrorMsg');
    if (msgEl) msgEl.textContent = errorMsg || 'Failed to load model assurance data.';
  }
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function formatFileSize(bytes) {
  if (bytes < 1024)            return bytes + ' B';
  if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Wire up button ────────────────────────────────────────────────────────────
if (verifyModelBtn) {
  verifyModelBtn.addEventListener('click', loadModelAssurance);
}

// Auto-load on page open
document.addEventListener('DOMContentLoaded', loadModelAssurance);