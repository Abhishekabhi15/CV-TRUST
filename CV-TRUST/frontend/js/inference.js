const inferenceImage =
    document.getElementById("inferenceImage");

const imageInfo =
    document.getElementById("imageInfo");

const verifyInferenceBtn =
    document.getElementById("verifyInferenceBtn");

const inferenceStatus =
    document.getElementById("inferenceStatus");

const inferenceIdInput =
    document.getElementById("inferenceId");



inferenceImage.addEventListener("change", function () {

    if (inferenceImage.files.length === 0) {

        imageInfo.textContent =
            "No image selected.";

        return;
    }


    const file =
        inferenceImage.files[0];


    imageInfo.textContent =
        file.name +
        " (" +
        formatFileSize(file.size) +
        ")";

});



verifyInferenceBtn.addEventListener("click", async function () {

    const inferenceId = (inferenceIdInput.value || "").trim();

    if (!inferenceId) {
        alert("Please enter an inference ID.");
        return;
    }

    inferenceStatus.textContent = "VERIFYING...";
    inferenceStatus.className = "badge bg-warning text-dark p-2";
    verifyInferenceBtn.disabled = true;
    verifyInferenceBtn.textContent = "Verifying...";

    try {
        const response = await fetch("http://localhost:3000/api/inference/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inferenceId })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
            const message = payload.error?.message || payload.message || `Verification failed (${response.status})`;
            throw new Error(message);
        }

        displayVerification(payload.data);
    } catch (err) {
        inferenceStatus.textContent = "FAILED";
        inferenceStatus.className = "badge bg-danger p-2";
        verifyInferenceBtn.classList.remove("btn-success");
        verifyInferenceBtn.classList.add("btn-primary");
        const provenanceBadge = document.querySelector(".dashboard-section.mb-4 .d-flex .badge");
        if (provenanceBadge) {
            provenanceBadge.textContent = "FAILED";
            provenanceBadge.className = "badge bg-danger";
        }
        alert(err.message || "Inference verification failed.");
    } finally {
        verifyInferenceBtn.disabled = false;
        verifyInferenceBtn.textContent = "Verify Inference";
    }

});



function displayVerification(result) {
    const verified = result && result.verified === true;
    const status = result.status || (verified ? "VERIFIED" : "TAMPERING_DETECTED");

    inferenceStatus.textContent = status;
    inferenceStatus.className = verified ? "badge bg-success p-2" : "badge bg-danger p-2";

    verifyInferenceBtn.classList.remove("btn-primary", "btn-success");
    verifyInferenceBtn.classList.add(verified ? "btn-success" : "btn-primary");

    const summaryId = document.querySelector(".row.g-4.mb-4 .col-md-3 h4");
    if (summaryId && result.inferenceId) {
        summaryId.textContent = String(result.inferenceId);
    }

    const provenanceBadge = document.querySelector(".dashboard-section.mb-4 .d-flex .badge");
    if (provenanceBadge) {
        provenanceBadge.textContent = status;
        provenanceBadge.className = verified ? "badge bg-success" : "badge bg-danger";
    }

    const checks = result.componentChecks || {};
    const cards = document.querySelectorAll(".verification-card");
    const cardMap = [
        { key: "model", label: "Model Identity" },
        { key: "input", label: "Input Integrity" },
        { key: "config", label: "Execution Trace" },
        { key: "output", label: "Output Integrity" }
    ];

    cardMap.forEach(function (item, index) {
        const card = cards[index];
        if (!card) return;
        const check = checks[item.key];
        const badge = card.querySelector(".badge");
        const detail = card.querySelector("p");
        const match = !!(check && check.match === true);
        if (badge) {
            badge.textContent = match ? "VERIFIED" : "MISMATCH";
            badge.className = match ? "badge bg-success" : "badge bg-danger";
        }
        if (detail && check) {
            detail.textContent = "stored " + shortHash(check.stored) + " | current " + shortHash(check.current);
        }
    });

    const chainBadges = document.querySelectorAll(".dashboard-section.mb-4 table tbody .badge");
    const chainKeys = ["input", "model", "config", "output"];
    chainKeys.forEach(function (key, index) {
        const badge = chainBadges[index];
        if (!badge) return;
        const check = checks[key];
        const match = !!(check && check.match === true);
        badge.textContent = match ? "VERIFIED" : "MISMATCH";
        badge.className = match ? "badge bg-success" : "badge bg-danger";
    });

    const detailId = document.querySelector(".info-item strong");
    if (detailId && result.inferenceId) {
        detailId.textContent = String(result.inferenceId);
    }
}



function shortHash(value) {
    if (!value) return "n/a";
    const text = String(value);
    return text.length <= 12 ? text : text.slice(0, 12) + "...";
}



function formatFileSize(bytes) {

    if (bytes < 1024) {

        return bytes + " B";

    }


    if (bytes < 1024 * 1024) {

        return (
            bytes / 1024
        ).toFixed(1) + " KB";

    }


    return (
        bytes / (1024 * 1024)
    ).toFixed(1) + " MB";

}
