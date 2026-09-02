let currentReportData = null;

document.addEventListener("DOMContentLoaded", fetchReport);

async function fetchReport() {
    try {
        const response = await fetch("http://localhost:3000/api/reports/latest");
        if (!response.ok) throw new Error("API response not ok");

        const data = await response.json();
        if (!data.success) throw new Error("API returned failure");

        currentReportData = data.data;
        populateReport(data.data);
    } catch (error) {
        console.error("Failed to fetch report:", error);
        document.querySelector(".page-header h1").textContent = "Report Unavailable";
        document.querySelector(".page-header p").textContent = "Could not load the latest report from the backend.";
        const statusBadge = document.querySelector(".page-header .status");
        if (statusBadge) {
            statusBadge.textContent = "UNAVAILABLE";
        }
        document.querySelectorAll(".summary-value").forEach(function (el) {
            el.textContent = "N/A";
        });
    }
}

function populateReport(report) {
    if (!report) return;

    document.querySelector(".page-header h1").textContent = report.title || "Assurance Report";
    const reportId = formatReportId(report._id);
    const generatedAt = formatDate(report.createdAt || report.updatedAt);
    document.querySelector(".page-header p").textContent = `ID: ${reportId}${generatedAt ? " | Generated: " + generatedAt : ""}`;

    const statusBadge = document.querySelector(".page-header .status");
    if (statusBadge) {
        statusBadge.textContent = report.overallRisk || "UNKNOWN";
        statusBadge.className = `status ${getRiskClass(report.overallRisk)}`;
    }

    const summaryValues = document.querySelectorAll(".summary-value");
    const summaryBadges = document.querySelectorAll(".summary-card .badge");
    if (summaryValues.length >= 4) {
        if (typeof report.riskScore === "number") {
            summaryValues[0].textContent = `${Math.round(report.riskScore * 100)}%`;
        }
        if (summaryBadges[0]) {
            summaryBadges[0].textContent = report.overallRisk || "UNKNOWN";
            summaryBadges[0].className = `badge ${getRiskClass(report.overallRisk)}`;
        }
        summaryValues[1].textContent = "N/A";
        if (summaryBadges[1]) {
            summaryBadges[1].textContent = "NO API FIELD";
            summaryBadges[1].className = "badge review";
        }

        const findings = Array.isArray(report.findings) ? report.findings : [];
        summaryValues[2].textContent = findings.length;
        if (summaryBadges[2]) {
            summaryBadges[2].textContent = findings.length > 0 ? "ATTENTION" : "CLEAR";
            summaryBadges[2].className = `badge ${findings.length > 0 ? "suspicious" : "verified"}`;
        }

        const totalAssets = getTotalAssets(report);
        if (totalAssets !== null) {
            summaryValues[3].textContent = totalAssets;
        }
    }

    const infoValues = document.querySelectorAll(".report-info .info-value");
    if (infoValues.length >= 4) {
        infoValues[0].textContent = reportId;
        infoValues[1].textContent = report.generatedBy || "system";
        if (report.recommendation) {
            infoValues[3].innerHTML = "";
            const badge = document.createElement("span");
            badge.className = `badge ${getRecommendationBadge(report.recommendation)}`;
            badge.textContent = report.recommendation;
            infoValues[3].appendChild(badge);
        }
    }

    let findings = Array.isArray(report.findings) ? report.findings : [];
    findings = deduplicateFindings(findings);
    const findingsCard = document.querySelectorAll(".card")[2];
    if (findingsCard) {
        const titleElements = findingsCard.querySelectorAll("h2, .card-description");
        findingsCard.innerHTML = "";
        titleElements.forEach(el => findingsCard.appendChild(el));

        if (findings.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = report.summary || "No open findings detected.";
            findingsCard.appendChild(empty);
        } else {
            findings.forEach(finding => {
                const row = document.createElement("div");
                row.className = "finding";

                const content = document.createElement("div");
                const title = document.createElement("div");
                title.className = "finding-title";
                title.textContent = getFindingTitle(finding);

                const description = document.createElement("div");
                description.className = "finding-description";
                description.innerHTML = getFindingDetailsHTML(finding);

                const badge = document.createElement("span");
                badge.className = `badge ${getSeverityBadge(finding.severity)}`;
                badge.textContent = finding.severity || "REVIEW";

                content.appendChild(title);
                content.appendChild(description);
                row.appendChild(content);
                row.appendChild(badge);
                findingsCard.appendChild(row);
            });
        }
    }

    const tbody = document.querySelector("table tbody");
    if (tbody) {
        tbody.innerHTML = "";
        if (findings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No detailed findings available.</td></tr>`;
        } else {
            findings.forEach(finding => {
                const tr = document.createElement("tr");
                appendCell(tr, getSourceLabel(finding.source));
                appendHTMLCell(tr, `<strong>${getFindingTitle(finding)}</strong><br/>${getFindingDetailsHTML(finding)}`);
                appendCell(tr, finding.assetId || finding.relatedRecordId || "N/A");
                appendBadgeCell(tr, finding.severity || "UNKNOWN", getSeverityBadge(finding.severity));
                appendBadgeCell(tr, finding.status || "OPEN", getStatusBadge(finding.status));
                tbody.appendChild(tr);
            });
        }
    }
}

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
}

function appendHTMLCell(row, html) {
    const cell = document.createElement("td");
    cell.innerHTML = html;
    row.appendChild(cell);
}

function appendBadgeCell(row, value, className) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${className}`;
    badge.textContent = value;
    cell.appendChild(badge);
    row.appendChild(cell);
}

function formatReportId(id) {
    if (!id) return "CVT-RPT";
    return "CVT-RPT-" + id.toString().slice(-6).toUpperCase();
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
}

function getTotalAssets(report) {
    if (Array.isArray(report.affectedAssets)) return report.affectedAssets.length;
    if (Array.isArray(report.assetIds)) return report.assetIds.length;
    return null;
}

function getFindingTitle(finding) {
    return finding.type || finding.reason || "Finding";
}

function deduplicateFindings(findings) {
    const unique = [];
    const seen = new Set();

    findings.forEach(finding => {
        const sig = JSON.stringify({
            source: finding.source,
            type: finding.type,
            severity: finding.severity,
            relatedRecordId: finding.relatedRecordId || finding.assetId || "N/A",
            reason: finding.reason,
            evidence: finding.evidence
        });
        if (!seen.has(sig)) {
            seen.add(sig);
            unique.push(finding);
        }
    });

    return unique;
}

function getFindingDetailsHTML(finding) {
    let html = "";
    if (finding.reason) {
        html += `<div>${finding.reason}</div>`;
    }
    if (typeof finding.confidence === "number") {
        html += `<div>Confidence: ${Math.round(finding.confidence * 100)}%</div>`;
    }
    const evidenceHTML = formatEvidenceHTML(finding.evidence);
    if (evidenceHTML) {
        html += evidenceHTML;
    }
    return html || "No details provided.";
}

function formatEvidenceHTML(evidence) {
    if (!evidence || typeof evidence !== "object") return "";

    let html = "<ul style='margin: 5px 0 0 20px; padding: 0;'>";
    let hasItems = false;

    if (evidence.keysCompared !== undefined && evidence.metrics) {
        html += `<li>Keys compared: ${evidence.keysCompared}</li>`;
        hasItems = true;
        for (const [key, val] of Object.entries(evidence.metrics)) {
            if (val && val.reference !== undefined && val.incoming !== undefined) {
                const niceKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
                const capitalizedKey = niceKey.charAt(0).toUpperCase() + niceKey.slice(1);
                html += `<li>${capitalizedKey}: reference ${val.reference} &rarr; incoming ${val.incoming}</li>`;
            }
        }
    }
    else if (evidence.componentChecks) {
        const checks = evidence.componentChecks;
        for (const [key, val] of Object.entries(checks)) {
            if (val && val.match !== undefined) {
                const niceKey = key.charAt(0).toUpperCase() + key.slice(1);
                html += `<li>${niceKey}: ${val.match ? "MATCH" : "MISMATCH"}</li>`;
                hasItems = true;
            }
        }
    }
    else if (evidence.pixelCount && evidence.pixelCount.value !== undefined) {
        const pc = evidence.pixelCount;
        html += `<li>Value: ${pc.value}</li>`;
        hasItems = true;
        if (pc.median !== undefined) html += `<li>Median: ${pc.median}</li>`;
    }
    else if (evidence.duplicateGroups && Array.isArray(evidence.duplicateGroups)) {
        evidence.duplicateGroups.forEach(group => {
            if (Array.isArray(group)) {
                html += `<li>Files: ${group.join(", ")}</li>`;
                hasItems = true;
            }
        });
    }
    else {
        for (const [key, value] of Object.entries(evidence).slice(0, 3)) {
            if (value !== null && typeof value !== "object") {
                html += `<li>${key}: ${value}</li>`;
                hasItems = true;
            }
        }
    }

    html += "</ul>";
    if (!hasItems) return "";
    return `<div style='margin-top: 5px;'><strong>Evidence:</strong>${html}</div>`;
}

function getSourceLabel(source) {
    const map = {
        dataset_analysis: "Data Assurance",
        model_verification: "Model Assurance",
        inference_check: "Inference Provenance",
        shift_analysis: "Distribution Shift",
        manual: "Manual Review"
    };
    return map[source] || "System";
}

function getRiskClass(risk) {
    if (risk === 'CRITICAL' || risk === 'HIGH') return 'suspicious'; // Red
    if (risk === 'MEDIUM') return 'review'; // Yellow
    return 'verified'; // Green
}

function getSeverityBadge(severity) {
    if (severity === 'CRITICAL' || severity === 'HIGH') return 'suspicious';
    if (severity === 'MEDIUM') return 'review';
    return 'verified';
}

function getStatusBadge(status) {
    if (status === 'RESOLVED' || status === 'SUPPRESSED') return 'verified';
    if (status === 'OPEN') return 'review';
    return 'suspicious';
}

function getRecommendationBadge(recommendation) {
    if (recommendation === "ACCEPT") return "verified";
    if (recommendation === "REVIEW") return "review";
    return "suspicious";
}

window.downloadReport = function() {
    if (!currentReportData) {
        alert("No report data available to download.");
        return;
    }

    const filename = `${formatReportId(currentReportData._id)}.json`;

    const blob = new Blob([JSON.stringify(currentReportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
