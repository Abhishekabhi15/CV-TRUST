const inferenceImage = document.getElementById("inferenceImage");
const imageInfo = document.getElementById("imageInfo");
const verifyInferenceBtn = document.getElementById("verifyInferenceBtn");
const inferenceStatus = document.getElementById("inferenceStatus");

const API_BASE_URL = "https://cv-trust-backend-oh3y.onrender.com";

inferenceImage.addEventListener("change", function () {
    if (inferenceImage.files.length === 0) {
        imageInfo.textContent = "No image selected.";
        return;
    }

    const file = inferenceImage.files[0];

    imageInfo.textContent =
        file.name + " (" + formatFileSize(file.size) + ")";
});

verifyInferenceBtn.addEventListener("click", async function () {
    if (inferenceImage.files.length === 0) {
        alert("Please select an input image first.");
        return;
    }

    const file = inferenceImage.files[0];

    inferenceStatus.textContent = "VERIFYING...";
    inferenceStatus.className = "badge bg-warning text-dark p-2";

    verifyInferenceBtn.disabled = true;
    verifyInferenceBtn.textContent = "Verifying...";

    try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(
            `${API_BASE_URL}/api/detect`,
            {
                method: "POST",
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result?.error?.message ||
                result?.message ||
                "Inference failed"
            );
        }

        inferenceStatus.textContent = "VERIFIED";
        inferenceStatus.className = "badge bg-success p-2";

        verifyInferenceBtn.textContent = "Verification Complete";
        verifyInferenceBtn.classList.remove("btn-primary");
        verifyInferenceBtn.classList.add("btn-success");

        console.log("CV-TRUST Detection Result:", result);

        alert(
            `Detection successful!\nObjects detected: ${
                result.data?.rawCount ?? result.data?.objects?.length ?? 0
            }`
        );

    } catch (error) {
        console.error("Inference error:", error);

        inferenceStatus.textContent = "FAILED";
        inferenceStatus.className = "badge bg-danger p-2";

        verifyInferenceBtn.textContent = "Try Again";
        verifyInferenceBtn.disabled = false;

        alert("Inference failed: " + error.message);
    }
});

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
