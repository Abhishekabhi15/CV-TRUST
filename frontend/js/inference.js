/* =========================================
   CV-TRUST INFERENCE PROVENANCE
   Fetches live records from:
     GET /api/inference/records
     GET /api/inference/stats
   Nothing is hardcoded — all values from backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';

// ── DOM references ────────────────────────────────────────────────────────────
const statusBadge         = document.getElementById('inferenceStatus');
const lastUpdatedEl       = document.getElementById('provenanceLastUpdated');

// Stats cards
const elTotal             = document.getElementById('statTotal');
const elSuccessful        = document.getElementById('statSuccessful');
const elFailed            = document.getElementById('statFailed');
const elAvgTime           = document.getElementById('statAvgTime');
const elLastId            = document.getElementById('statLastId');
const elLastObjectCount   = document.getElementById('statLastObjectCount');

// Table
const tableBody           = document.getElementById('provenanceTableBody');
const loadingRow          = document.getElementById('provenanceLoadingRow');
const emptyRow            = document.getElementById('provenanceEmptyRow');
const errorRow            = document.getElementById('provenanceErrorRow');

// Detail panel
const detailPanel         = document.getElementById('inferenceDetailPanel');

// Pagination
const prevBtn             = document.getElementById('prevPageBtn');
const nextBtn             = document.getElementById('nextPageBtn');
const pageInfo            = document.getElementById('pageInfo');

let currentPage = 1;
const PAGE_SIZE  = 10;

// ── Load stats ────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const resp   = await fetch(`${API_BASE_URL}/api/inference/stats`);
    const result = await resp.json();

    if (!result.success) throw new Error(result?.error?.message || 'Stats failed');
    const d = result.data;

    setText(elTotal,           d.total           ?? '—');
    setText(elSuccessful,      d.successful       ?? '—');
    setText(elFailed,          d.failed           ?? '—');
    setText(elAvgTime,         d.avgProcessingTimeMs != null
      ? (d.avgProcessingTimeMs / 1000).toFixed(1) + ' s'
      : '—');
    setText(elLastId,          d.lastInferenceId  || '—');
    setText(elLastObjectCount, d.lastObjectCount  ?? '—');

    // Status badge
    if (statusBadge) {
      if (d.total > 0) {
        statusBadge.textContent = 'TRACKED';
        statusBadge.className   = 'badge bg-success p-2';
      } else {
        statusBadge.textContent = 'NO DATA';
        statusBadge.className   = 'badge bg-secondary p-2';
      }
    }

  } catch (err) {
    console.warn('Inference stats error:', err.message);
  }
}

// ── Load records ──────────────────────────────────────────────────────────────
async function loadRecords(page = 1) {
  if (loadingRow) loadingRow.classList.remove('d-none');
  if (emptyRow)   emptyRow.classList.add('d-none');
  if (errorRow)   errorRow.classList.add('d-none');

  // Clear existing rows
  if (tableBody) {
    const rows = tableBody.querySelectorAll('tr.record-row');
    rows.forEach((r) => r.remove());
  }

  try {
    const resp   = await fetch(`${API_BASE_URL}/api/inference/records?page=${page}&limit=${PAGE_SIZE}`);
    const result = await resp.json();

    if (!result.success) throw new Error(result?.error?.message || 'Records failed');

    const records    = result.data || [];
    const pagination = result.pagination || {};

    if (loadingRow) loadingRow.classList.add('d-none');

    if (records.length === 0) {
      if (emptyRow) emptyRow.classList.remove('d-none');
    } else {
      renderRecords(records);
    }

    // Pagination
    currentPage = pagination.page || 1;
    const totalPages = pagination.pages || 1;
    if (pageInfo)  pageInfo.textContent  = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn)   prevBtn.disabled      = currentPage <= 1;
    if (nextBtn)   nextBtn.disabled      = currentPage >= totalPages;

    // Last updated
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }

  } catch (err) {
    console.error('Records load error:', err);
    if (loadingRow) loadingRow.classList.add('d-none');
    if (errorRow) {
      errorRow.classList.remove('d-none');
      const msgEl = errorRow.querySelector('#provenanceErrorMsg');
      if (msgEl) msgEl.textContent = err.message;
    }
  }
}

// ── Render table rows ─────────────────────────────────────────────────────────
function renderRecords(records) {
  if (!tableBody) return;

  records.forEach((rec) => {
    const row  = document.createElement('tr');
    row.classList.add('record-row');
    row.style.cursor = 'pointer';

    const avgConf    = rec.averageConfidence != null
      ? (rec.averageConfidence * 100).toFixed(1) + '%'
      : '—';
    const procTime   = rec.processingTimeMs != null
      ? (rec.processingTimeMs / 1000).toFixed(2) + ' s'
      : '—';
    const statusBadge = rec.inferenceStatus === 'COMPLETED'
      ? '<span class="badge bg-success">COMPLETED</span>'
      : '<span class="badge bg-danger">FAILED</span>';
    const timestamp  = rec.createdAt ? new Date(rec.createdAt).toLocaleString() : '—';
    const classes    = rec.detectedClasses?.length > 0
      ? rec.detectedClasses.slice(0, 3).join(', ') + (rec.detectedClasses.length > 3 ? '…' : '')
      : 'None';

    row.innerHTML = `
      <td><code class="small">${escapeHtml(rec.inferenceId || rec._id)}</code></td>
      <td>${timestamp}</td>
      <td>${escapeHtml(rec.imageName || '—')}</td>
      <td>${escapeHtml(rec.modelName || '—')}</td>
      <td>${rec.objectCount ?? '—'}</td>
      <td>${classes}</td>
      <td>${avgConf}</td>
      <td>${procTime}</td>
      <td>${statusBadge}</td>
    `;

    row.addEventListener('click', () => showDetail(rec));
    tableBody.appendChild(row);
  });
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function showDetail(rec) {
  if (!detailPanel) return;

  const avgConf  = rec.averageConfidence != null
    ? (rec.averageConfidence * 100).toFixed(1) + '%' : '—';
  const procTime = rec.processingTimeMs != null
    ? (rec.processingTimeMs / 1000).toFixed(2) + ' s' : '—';

  detailPanel.innerHTML = `
    <div class="dashboard-section mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="fw-bold mb-0">Inference Record Detail</h5>
        <button class="btn btn-sm btn-outline-secondary" onclick="clearDetail()">✕ Close</button>
      </div>
      <div class="row g-3">
        <div class="col-md-4"><div class="info-item"><span>Inference ID</span><strong>${escapeHtml(rec.inferenceId || rec._id)}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Timestamp</span><strong>${rec.createdAt ? new Date(rec.createdAt).toLocaleString() : '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Status</span><strong>${rec.inferenceStatus || '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Image</span><strong>${escapeHtml(rec.imageName || '—')}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Image Size</span><strong>${formatFileSize(rec.imageFileSizeBytes)}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Dimensions</span><strong>${rec.imageWidth > 0 ? rec.imageWidth + ' × ' + rec.imageHeight + 'px' : '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Model</span><strong>${escapeHtml(rec.modelName || '—')}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Model Version</span><strong>${escapeHtml(rec.modelVersion || '—')}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Device</span><strong>${(rec.device || '—').toUpperCase()}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Inference Size</span><strong>${rec.imgsz ? rec.imgsz + 'px' : '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Confidence Threshold</span><strong>${rec.confidenceThreshold != null ? (rec.confidenceThreshold * 100).toFixed(0) + '%' : '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Objects Detected</span><strong>${rec.objectCount ?? '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Detected Classes</span><strong>${rec.detectedClasses?.join(', ') || 'None'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Avg. Confidence</span><strong>${avgConf}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Processing Time</span><strong>${procTime}</strong></div></div>
        <div class="col-md-8"><div class="info-item"><span>Model Hash</span><strong class="font-monospace small" title="${escapeHtml(rec.modelHash || '')}">${rec.modelHash ? rec.modelHash.substring(0, 32) + '…' : '—'}</strong></div></div>
        <div class="col-md-4"><div class="info-item"><span>Integrity Hash</span><strong class="font-monospace small">${rec.integrityHash ? rec.integrityHash.substring(0, 16) + '…' : '—'}</strong></div></div>
      </div>
    </div>
  `;
  detailPanel.scrollIntoView({ behavior: 'smooth' });
}

function clearDetail() {
  if (detailPanel) detailPanel.innerHTML = '';
}

// ── Pagination ────────────────────────────────────────────────────────────────
if (prevBtn) prevBtn.addEventListener('click', () => loadRecords(currentPage - 1));
if (nextBtn) nextBtn.addEventListener('click', () => loadRecords(currentPage + 1));

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(el, value) { if (el) el.textContent = value; }

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadRecords(1);
});
