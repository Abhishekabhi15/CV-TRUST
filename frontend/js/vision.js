/* =========================================
   CV-TRUST VISION DETECTION
   LIVE YOLO BACKEND INTEGRATION
========================================= */

const API_BASE_URL = "https://cv-trust-backend-oh3y.onrender.com";

let selectedImage = null;
let imageObject = null;

const imageInput = document.getElementById("imageInput");
const detectBtn = document.getElementById("detectBtn");
const selectedImageInfo = document.getElementById("selectedImageInfo");
const detectionSection = document.getElementById("detectionSection");
const detectionStatus = document.getElementById("detectionStatus");
const detectionCanvas = document.getElementById("detectionCanvas");
const ctx = detectionCanvas.getContext("2d");

const objectCount = document.getElementById("objectCount");
const averageConfidence = document.getElementById("averageConfidence");
const detectionResults = document.getElementById("detectionResults");

const modelName = document.getElementById("modelName");
const imageName = document.getElementById("imageName");
const resultStatus = document.getElementById("resultStatus");


/* =========================================
   IMAGE UPLOAD
========================================= */

imageInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        imageInput.value = "";
        return;
    }

    selectedImage = file;

    selectedImageInfo.textContent =
        file.name + " (" + formatFileSize(file.size) + ")";

    detectBtn.disabled = false;

    detectionStatus.className =
        "badge bg-primary p-2";

    detectionStatus.textContent =
        "IMAGE READY";

    detectionSection.classList.remove("d-none");

    imageName.textContent = file.name;
    resultStatus.textContent = "Ready";
    modelName.textContent = "YOLOv8";

    objectCount.textContent = "—";
    averageConfidence.textContent = "—";

    detectionResults.innerHTML = `
        <div class="text-muted">
            Run detection to see results.
        </div>
    `;

    /* Load selected image */
    const reader = new FileReader();

    reader.onload = function (event) {
        imageObject = new Image();

        imageObject.onload = function () {
            drawImage([]);
        };

        imageObject.src = event.target.result;
    };

    reader.readAsDataURL(file);
});


/* =========================================
   LIVE YOLO DETECTION
========================================= */

detectBtn.addEventListener("click", async function () {

    if (!selectedImage || !imageObject) {
        alert("Please select an image first.");
        return;
    }

    detectBtn.disabled = true;
    detectBtn.textContent = "Analyzing...";

    detectionStatus.className =
        "badge bg-warning text-dark p-2";

    detectionStatus.textContent =
        "ANALYZING";

    resultStatus.textContent =
        "Processing image...";

    try {

        const formData = new FormData();

        formData.append("image", selectedImage);

        const response = await fetch(
            `${API_BASE_URL}/api/detect`,
            {
                method: "POST",
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            let errorMessage = "Detection failed.";

            if (result.message) {
                errorMessage = result.message;
            } else if (typeof result.error === "string") {
                errorMessage = result.error;
            } else if (result.error) {
                errorMessage = JSON.stringify(result.error, null, 2);
            }

throw new Error(errorMessage);
        }

        /*
         * Backend response:
         *
         * result.data.objects
         *
         * Each object contains:
         * label
         * confidence
         * bbox [x1, y1, x2, y2]
         */

        const backendObjects =
            result.data?.objects || [];

        const detections =
            backendObjects.map(function (item) {

                return {
                    label: item.label,
                    confidence: Number(item.confidence) || 0,
                    box: {
                        x1: Number(item.bbox?.[0]) || 0,
                        y1: Number(item.bbox?.[1]) || 0,
                        x2: Number(item.bbox?.[2]) || 0,
                        y2: Number(item.bbox?.[3]) || 0
                    }
                };

            });

        displayDetectionData(detections, result);

    } catch (error) {

        console.error("YOLO detection error:", error);

        detectionStatus.className =
            "badge bg-danger p-2";

        detectionStatus.textContent =
            "DETECTION FAILED";

        resultStatus.textContent =
            "Detection failed";

        detectionResults.innerHTML = `
            <div class="text-danger">
                <strong>Detection failed</strong>
                <br>
                <small>${escapeHtml(error.message)}</small>
            </div>
        `;

        alert(
    "YOLO detection failed.\n\n" +
    error.message
);

    } finally {

        detectBtn.disabled = false;

        detectBtn.textContent =
            "Run YOLO Detection";
    }
});


/* =========================================
   DISPLAY LIVE DETECTION DATA
========================================= */

function displayDetectionData(detections, result) {

    objectCount.textContent =
        detections.length;

    let totalConfidence = 0;

    detections.forEach(function (item) {
        totalConfidence += item.confidence;
    });

    const average =
        detections.length > 0
            ? totalConfidence / detections.length
            : 0;

    averageConfidence.textContent =
        Math.round(average * 100) + "%";

    modelName.textContent =
        result.data?.modelUsed || "YOLOv8";

    resultStatus.textContent =
        detections.length +
        " objects detected";

    detectionStatus.className =
        "badge bg-success p-2";

    detectionStatus.textContent =
        "DETECTION COMPLETE";

    drawImage(detections);

    displayResults(detections);
}


/* =========================================
   DRAW IMAGE
========================================= */

function drawImage(detections) {

    if (!imageObject) {
        return;
    }

    const maxWidth = 850;
    const maxHeight = 600;

    const scale = Math.min(
        maxWidth / imageObject.width,
        maxHeight / imageObject.height,
        1
    );

    detectionCanvas.width =
        imageObject.width * scale;

    detectionCanvas.height =
        imageObject.height * scale;

    ctx.clearRect(
        0,
        0,
        detectionCanvas.width,
        detectionCanvas.height
    );

    ctx.drawImage(
        imageObject,
        0,
        0,
        detectionCanvas.width,
        detectionCanvas.height
    );

    detections.forEach(function (item) {
        drawBoundingBox(item, scale);
    });
}


/* =========================================
   DRAW BOUNDING BOX
========================================= */

function drawBoundingBox(item, scale) {

    const x =
        item.box.x1 * scale;

    const y =
        item.box.y1 * scale;

    const width =
        (item.box.x2 - item.box.x1) * scale;

    const height =
        (item.box.y2 - item.box.y1) * scale;

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2563eb";

    ctx.strokeRect(
        x,
        y,
        width,
        height
    );

    const confidence =
        Math.round(item.confidence * 100);

    const label =
        item.label + " " + confidence + "%";

    ctx.font =
        "bold 14px Arial";

    const textWidth =
        ctx.measureText(label).width;

    ctx.fillStyle =
        "#2563eb";

    ctx.fillRect(
        x,
        Math.max(0, y - 25),
        textWidth + 12,
        25
    );

    ctx.fillStyle =
        "#ffffff";

    ctx.fillText(
        label,
        x + 6,
        Math.max(17, y - 8)
    );
}


/* =========================================
   DISPLAY RESULTS
========================================= */

function displayResults(detections) {

    detectionResults.innerHTML = "";

    if (detections.length === 0) {

        detectionResults.innerHTML = `
            <div class="text-muted">
                No objects detected.
            </div>
        `;

        return;
    }

    detections.forEach(function (item, index) {

        const confidence =
            Math.round(item.confidence * 100);

        const resultItem =
            document.createElement("div");

        resultItem.className =
            "detection-result-item";

        resultItem.innerHTML = `
            <div>
                <strong>
                    ${index + 1}. ${escapeHtml(item.label)}
                </strong>
                <br>
                <small class="text-muted">
                    Bounding box detected
                </small>
            </div>

            <span class="badge bg-success">
                ${confidence}%
            </span>
        `;

        detectionResults.appendChild(resultItem);
    });
}


/* =========================================
   FILE SIZE
========================================= */

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


/* =========================================
   HTML ESCAPING
========================================= */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
