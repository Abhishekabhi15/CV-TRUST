/* =========================================
   CV-TRUST VISION DETECTION
========================================= */

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


imageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        imageInput.value = "";
        return;
    }

    selectedImage = file;
    selectedImageInfo.textContent = file.name + " (" + formatFileSize(file.size) + ")";
    detectBtn.disabled = false;
    detectionStatus.className = "badge bg-primary p-2";
    detectionStatus.textContent = "IMAGE READY";
    detectionSection.classList.remove("d-none");
    imageName.textContent = file.name;
    resultStatus.textContent = "Ready";
    modelName.textContent = "YOLO";

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

detectBtn.addEventListener("click", async function (event) {
    event.preventDefault();
    if (!selectedImage || !imageObject) return;

    detectBtn.disabled = true;
    detectBtn.textContent = "Analyzing...";
    detectionStatus.className = "badge bg-warning text-dark p-2";
    detectionStatus.textContent = "ANALYZING";

    const formData = new FormData();
    formData.append("image", selectedImage);

    try {
        const response = await fetch("http://localhost:3000/api/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error(data.message || "Detection failed");

        const detections = data.data.objects.map(det => {
            // Map bbox array or object into {x1,y1,x2,y2}
            let x1=0, y1=0, x2=0, y2=0;
            if (Array.isArray(det.bbox)) {
                [x1, y1, x2, y2] = det.bbox;
            } else if (det.bbox && typeof det.bbox === 'object') {
                x1 = det.bbox.x1 ?? det.bbox.x ?? 0;
                y1 = det.bbox.y1 ?? det.bbox.y ?? 0;
                x2 = det.bbox.x2 ?? (det.bbox.x + det.bbox.w) ?? 0;
                y2 = det.bbox.y2 ?? (det.bbox.y + det.bbox.h) ?? 0;
            }
            return {
                label: det.label,
                confidence: det.confidence,
                box: { x1, y1, x2, y2 }
            };
        });

        objectCount.textContent = detections.length;

        let totalConfidence = 0;
        detections.forEach(item => totalConfidence += item.confidence);
        const average = detections.length > 0 ? totalConfidence / detections.length : 0;
        averageConfidence.textContent = Math.round(average * 100) + "%";

        modelName.textContent = data.data.modelUsed || "YOLO";
        resultStatus.textContent = detections.length + " objects detected";

        detectionStatus.className = "badge bg-success p-2";
        detectionStatus.textContent = "DETECTION COMPLETE";

        drawImage(detections);
        displayResults(detections);

    } catch (err) {
        console.error("Detection error:", err);
        detectionStatus.className = "badge bg-danger p-2";
        detectionStatus.textContent = "FAILED";
        resultStatus.textContent = "Detection failed. Is the Python service running?";
    } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = "Run YOLO Detection";
    }
});

function drawImage(detections) {
    if (!imageObject) return;
    const maxWidth = 850;
    const maxHeight = 600;
    const scale = Math.min(maxWidth / imageObject.width, maxHeight / imageObject.height, 1);

    detectionCanvas.width = imageObject.width * scale;
    detectionCanvas.height = imageObject.height * scale;
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
    ctx.drawImage(imageObject, 0, 0, detectionCanvas.width, detectionCanvas.height);

    if (detections) {
        detections.forEach(function (item) {
            drawBoundingBox(item, scale);
        });
    }
}

function drawBoundingBox(item, scale) {
    const x = item.box.x1 * scale;
    const y = item.box.y1 * scale;
    const width = (item.box.x2 - item.box.x1) * scale;
    const height = (item.box.y2 - item.box.y1) * scale;

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2563eb";
    ctx.strokeRect(x, y, width, height);

    const confidence = Math.round(item.confidence * 100);
    const label = item.label + " " + confidence + "%";
    ctx.font = "bold 14px Arial";
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x, Math.max(0, y - 25), textWidth + 12, 25);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + 6, Math.max(17, y - 8));
}

function displayResults(detections) {
    detectionResults.innerHTML = "";
    if (detections.length === 0) {
        detectionResults.innerHTML = "<div class='text-muted p-3'>No objects detected.</div>";
        return;
    }
    detections.forEach(function (item, index) {
        const confidence = Math.round(item.confidence * 100);
        const resultItem = document.createElement("div");
        resultItem.className = "detection-result-item";
        resultItem.innerHTML = `
            <div>
                <strong>${index + 1}. ${item.label}</strong><br>
                <small class="text-muted">Bounding box detected</small>
            </div>
            <span class="badge bg-success">${confidence}%</span>
        `;
        detectionResults.appendChild(resultItem);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
