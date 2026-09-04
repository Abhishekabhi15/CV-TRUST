/* =========================================
   CV-TRUST AUDIT LOGS
   Fetches live audit events from GET /api/audit-logs
   Nothing is hardcoded — all values from backend.
========================================= */

const API_BASE_URL = 'https://cv-trust-backend-oh3y.onrender.com';

// ── DOM references ────────────────────────────────────────────────────────────
const tableBody       = document.getElementById('auditLogsTableBody');
const loadingRow      = document.getElementById('auditLogsLoadingRow');
const emptyRow        = document.getElementById('auditLogsEmptyRow');
const errorRow        = document.getElementById('auditLogsErrorRow');
const totalCountEl    = document.getElementById('auditTotalCount');
const lastUpdatedEl   = document.getElementById('auditLastUpdated');

// Pagination
const prevBtn         = document.getElementById('auditPrevBtn');
const nextBtn         = document.getElementById('auditNextBtn');
const pageInfo        = document.getElementById('auditPageInfo');

// Filters
const filterAction    = document.getElementById('filterAction');
const filterDateFrom  = document.getElementById('filterDateFrom');
const filterDateTo    = document.getElementById('filterDateTo');
const applyFilterBtn  = document.getElementById('applyFilterBtn');
const clearFilterBtn  = document.getElementById('clearFilterBtn');

let currentPage = 1;
const PAGE_SIZE  = 20;

// ── Action labels for display ─────────────────────────────────────────────────
const ACTION_LABELS = {
  DETECTION_RUN:       'Detection Run',
  MODEL_VERIFIED:      'Model Verified',
  INFERENCE_CREATED:   'Inference Created',
  INFERENCE_VERIFIED:  'Inference Verified',
  SHIFT_ANALYZED:      'Shift Analyzed',
  DATASET_ANALYZED:    'Dataset Analyzed',
  REPORT_GENERATED:    'Report Generated',
  FINDING_CREATED:     'Finding Created',
};

// ── Load audit logs ───────────────────────────────────────────────────────────
async function loadAuditLogs(page = 1) {
  if (loadingRow) loadingRow.classList.remove('d-none');
  if (emptyRow)   emptyRow.classList.add('d-none');
  if (errorRow)   errorRow.classList.add('d-none');

  // Remove existing rows
  if (tableBody) {
    tableBody.querySelectorAll('tr.log-row').forEach((r) => r.remove());
  }

  // Build query params
  const params = new URLSearchParams();
  params.set('page',  page);
  params.set('limit', PAGE_SIZE);

  if (filterAction && filterAction.value) {
    params.set('action', filterAction.value);
  }
  if (filterDateFrom && filterDateFrom.value) {
    params.set('from', new Date(filterDateFrom.value).toISOString());
  }
  if (filterDateTo && filterDateTo.value) {
    const to = new Date(filterDateTo.value);
    to.setHours(23, 59, 59, 999);
    params.set('to', to.toISOString());
  }

  try {
    const resp   = await fetch(`${API_BASE_URL}/api/audit-logs?${params.toString()}`);
    const result = await resp.json();

    if (!result.success) throw new Error(result?.error?.message || 'Audit log request failed');

    const logs       = result.data || [];
    const pagination = result.pagination || {};

    if (loadingRow) loadingRow.classList.add('d-none');

    if (logs.length === 0) {
      if (emptyRow) emptyRow.classList.remove('d-none');
    } else {
      renderLogs(logs);
    }

    // Total count
    if (totalCountEl) totalCountEl.textContent = pagination.total ?? logs.length;

    // Pagination
    currentPage = pagination.page || 1;
    const totalPages = pagination.pages || 1;
    if (pageInfo)  pageInfo.textContent  = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn)   prevBtn.disabled      = currentPage <= 1;
    if (nextBtn)   nextBtn.disabled      = currentPage >= totalPages;

    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }

  } catch (err) {
    console.error('Audit logs error:', err);
    if (loadingRow) loadingRow.classList.add('d-none');
    if (errorRow) {
      errorRow.classList.remove('d-none');
      const msgEl = errorRow.querySelector('#auditErrorMsg');
      if (msgEl) msgEl.textContent = err.message;
    }
  }
}

// ── Render log rows ───────────────────────────────────────────────────────────
function renderLogs(logs) {
  if (!tableBody) return;

  logs.forEach((log) => {
    const row = document.createElement('tr');
    row.classList.add('log-row');

    const action    = ACTION_LABELS[log.action] || log.action || '—';
    const result    = log.result || '—';
    const user      = log.user   || 'system';
    const timestamp = log.createdAt ? new Date(log.createdAt).toLocaleString() : '—';
    const eventHash = log.eventHash
      ? log.eventHash.substring(0, 12) + '…'
      : '—';

    // Details summary
    const details = log.details && typeof log.details === 'object'
      ? Object.entries(log.details)
          .filter(([, v]) => v != null && v !== '')
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : '';

    row.innerHTML = `
      <td>
        <span class="${actionBadgeClass(log.action)}">${escapeHtml(action)}</span>
      </td>
      <td>${escapeHtml(user)}</td>
      <td><span class="${resultBadgeClass(result)}">${escapeHtml(result)}</span></td>
      <td class="small text-muted">${escapeHtml(details)}</td>
      <td><code class="small text-muted" title="${escapeHtml(log.eventHash || '')}">${eventHash}</code></td>
      <td class="small">${timestamp}</td>
    `;

    tableBody.appendChild(row);
  });
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function actionBadgeClass(action) {
  if (action === 'DETECTION_RUN')      return 'badge bg-primary';
  if (action === 'MODEL_VERIFIED')     return 'badge bg-success';
  if (action === 'INFERENCE_CREATED')  return 'badge bg-info text-dark';
  if (action === 'SHIFT_ANALYZED')     return 'badge bg-warning text-dark';
  if (action === 'REPORT_GENERATED')   return 'badge bg-secondary';
  return 'badge bg-light text-dark';
}

function resultBadgeClass(result) {
  if (result === 'SUCCESS') return 'badge bg-success';
  if (result === 'FAILURE') return 'badge bg-danger';
  if (result === 'PARTIAL') return 'badge bg-warning text-dark';
  return 'badge bg-secondary';
}

// ── Filters ───────────────────────────────────────────────────────────────────
if (applyFilterBtn) {
  applyFilterBtn.addEventListener('click', () => loadAuditLogs(1));
}

if (clearFilterBtn) {
  clearFilterBtn.addEventListener('click', () => {
    if (filterAction)   filterAction.value   = '';
    if (filterDateFrom) filterDateFrom.value = '';
    if (filterDateTo)   filterDateTo.value   = '';
    loadAuditLogs(1);
  });
}

// ── Pagination ────────────────────────────────────────────────────────────────
if (prevBtn) prevBtn.addEventListener('click', () => loadAuditLogs(currentPage - 1));
if (nextBtn) nextBtn.addEventListener('click', () => loadAuditLogs(currentPage + 1));

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => loadAuditLogs(1));
