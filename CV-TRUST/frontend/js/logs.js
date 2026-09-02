const eventFilter = document.getElementById("eventFilter");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

document.addEventListener("DOMContentLoaded", fetchLogs);

async function fetchLogs() {
    const tableBody = document.getElementById("logTable");

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading audit logs...</td></tr>`;

    try {
        const response = await fetch("http://localhost:3000/api/audit-logs");
        if (!response.ok) throw new Error("API response not ok");

        const data = await response.json();
        if (!data.success) throw new Error("API returned failure");
        if (!Array.isArray(data.data)) throw new Error("Unexpected audit log payload");

        renderLogs(data.data);
    } catch (error) {
        console.error("Failed to fetch logs:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Failed to load audit logs. Backend might be unreachable.</td></tr>`;
    }
}

function renderLogs(logs) {
    const tableBody = document.getElementById("logTable");
    tableBody.innerHTML = "";

    if (!logs || logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No audit logs found.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement("tr");

        const { type, moduleName, text } = mapAction(log.action);

        const { status, badge, statusText } = mapResult(log.result);

        tr.setAttribute("data-type", type);
        tr.setAttribute("data-status", status);

        const timestamp = new Date(log.timestamp || log.createdAt).toISOString().replace("T", " ").substring(0, 19);
        const eventId = "EVT-" + (log._id || "000000").toString().slice(-6).toUpperCase();
        const user = log.user || 'Analyst';

        tr.innerHTML = `
            <td>${timestamp}</td>
            <td>${eventId}</td>
            <td>${user}</td>
            <td class="event-type">${text}</td>
            <td>${moduleName}</td>
            <td><span class="badge ${badge}">${statusText}</span></td>
        `;

        tableBody.appendChild(tr);
    });

    filterLogs();
    updateSummaryCards(logs);
}

function mapAction(action) {
    const map = {
        'DATASET_ANALYZED': { type: 'data', moduleName: 'Data Assurance', text: 'Dataset Analysis' },
        'MODEL_VERIFIED': { type: 'model', moduleName: 'Model Assurance', text: 'Model Verification' },
        'INFERENCE_CREATED': { type: 'inference', moduleName: 'Inference Provenance', text: 'Inference Creation' },
        'INFERENCE_VERIFIED': { type: 'inference', moduleName: 'Inference Provenance', text: 'Inference Verification' },
        'REPORT_GENERATED': { type: 'report', moduleName: 'Reporting', text: 'Report Generation' },
        'DETECTION_RUN': { type: 'vision', moduleName: 'Vision Detection', text: 'Object Detection' },
        'SHIFT_ANALYZED': { type: 'shift', moduleName: 'Distribution Shift', text: 'Distribution Shift' },
        'FINDING_CREATED': { type: 'finding', moduleName: 'System', text: 'Finding Created' }
    };
    return map[action] || { type: 'other', moduleName: 'System', text: action };
}

function mapResult(result) {
    if (result === 'SUCCESS') return { status: 'verified', badge: 'verified', statusText: 'VERIFIED' };
    if (result === 'PARTIAL') return { status: 'warning', badge: 'warning', statusText: 'WARNING' };
    if (result === 'FAILURE') return { status: 'critical', badge: 'critical', statusText: 'CRITICAL' };
    return { status: 'info', badge: 'info', statusText: result || 'UNKNOWN' };
}

function filterLogs() {
    const rows = document.querySelectorAll("#logTable tr");
    const eventValue = eventFilter.value.toLowerCase();
    const statusValue = statusFilter.value.toLowerCase();
    const searchValue = searchInput.value.toLowerCase();

    rows.forEach(row => {
        if (!row.dataset.type) {
            row.style.display = "";
            return;
        }

        const rowType = row.dataset.type;
        const rowStatus = row.dataset.status;
        const rowText = row.innerText.toLowerCase();

        const eventMatch = eventValue === "all" || rowType === eventValue;
        const statusMatch = statusValue === "all" || rowStatus === statusValue;
        const searchMatch = rowText.includes(searchValue);

        if (eventMatch && statusMatch && searchMatch) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

eventFilter.addEventListener("change", filterLogs);
statusFilter.addEventListener("change", filterLogs);
searchInput.addEventListener("input", filterLogs);

function clearFilters() {
    eventFilter.value = "all";
    statusFilter.value = "all";
    searchInput.value = "";
    filterLogs();
}

function updateSummaryCards(logs) {
    const cardValues = document.querySelectorAll('.card-value');
    if (cardValues.length >= 4) {
        let verified = 0, warning = 0, critical = 0;
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                if (log.result === 'SUCCESS') verified++;
                else if (log.result === 'PARTIAL') warning++;
                else if (log.result === 'FAILURE') critical++;
            });
        }
        cardValues[0].textContent = logs ? logs.length : 0;
        cardValues[1].textContent = verified;
        cardValues[2].textContent = warning;
        cardValues[3].textContent = critical;
    }
}
