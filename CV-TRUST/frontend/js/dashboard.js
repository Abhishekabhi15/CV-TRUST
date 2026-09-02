document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
    let findingsLoaded = false;
    let reportLoaded = false;
    let findings = [];
    let report = null;

    try {
        const [findingsRes, reportRes] = await Promise.all([
            fetch("http://localhost:3000/api/findings").catch(() => null),
            fetch("http://localhost:3000/api/reports/latest").catch(() => null)
        ]);

        if (findingsRes && findingsRes.ok) {
            const data = await findingsRes.json();
            if (data.success && Array.isArray(data.data)) {
                findings = data.data;
                findingsLoaded = true;
            }
        }

        if (reportRes && reportRes.ok) {
            const data = await reportRes.json();
            if (data.success && data.data) {
                report = data.data;
                reportLoaded = true;
            }
        }

        updateDashboard(findings, report, findingsLoaded, reportLoaded);
    } catch (err) {
        console.error("Dashboard init error:", err);
    }
}

function updateDashboard(findings, report, findingsLoaded, reportLoaded) {
    const cards = document.querySelectorAll(".row.g-4 .col-md-6");

    if (reportLoaded && report && cards[0]) {
        const riskVal = cards[0].querySelector("h2");
        const riskBadge = cards[0].querySelector(".badge");
        if (typeof report.riskScore === "number" && riskVal) {
            riskVal.textContent = `${Math.round(report.riskScore * 100)}%`;
        }
        if (riskBadge) {
            riskBadge.textContent = report.overallRisk || "UNKNOWN";
            riskBadge.className = `badge ${getBadgeClass(report.overallRisk)}`;
        }
    }

    if (findingsLoaded && cards[2]) {
        const findingsVal = cards[2].querySelector("h2");
        const findingsBadge = cards[2].querySelector(".badge");
        const activeCount = findings.filter(f => f.status === "OPEN").length;
        if (findingsVal) findingsVal.textContent = activeCount;
        if (findingsBadge) {
            findingsBadge.textContent = activeCount > 0 ? "ATTENTION" : "CLEAR";
            findingsBadge.className = `badge ${activeCount > 0 ? "bg-danger" : "bg-success"}`;
        }
    }

    if (reportLoaded && cards[3]) {
        const confVal = cards[3].querySelector("h2");
        if (confVal) confVal.textContent = "N/A";
    }

    const tbody = document.querySelector("table tbody");
    if (tbody && findingsLoaded) {
        tbody.innerHTML = "";
        if (findings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center">No recent findings</td></tr>`;
        } else {
            const recent = [...findings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
            recent.forEach(f => {
                const tr = document.createElement("tr");
                const title = f.type || f.reason || "Finding";
                const asset = f.relatedRecordId || f.relatedRecordType || "System";
                tr.innerHTML = `
                    <td></td>
                    <td></td>
                    <td><span class="badge ${getBadgeClass(f.severity)}"></span></td>
                    <td><span class="badge ${getBadgeClass(f.status)}"></span></td>
                `;
                tr.children[0].textContent = title;
                tr.children[1].textContent = asset;
                tr.children[2].querySelector("span").textContent = f.severity || "UNKNOWN";
                tr.children[3].querySelector("span").textContent = f.status || "OPEN";
                tbody.appendChild(tr);
            });
        }
    }
}

function getBadgeClass(val) {
    if (val === "CRITICAL" || val === "HIGH" || val === "SUSPICIOUS") return "bg-danger";
    if (val === "MEDIUM" || val === "REVIEW" || val === "OPEN") return "bg-warning text-dark";
    if (val === "LOW" || val === "VERIFIED" || val === "NORMAL" || val === "RESOLVED" || val === "SUPPRESSED") return "bg-success";
    return "bg-secondary";
}
