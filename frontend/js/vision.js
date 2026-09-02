/* =========================================
   CV-TRUST VISION DETECTION
   FRONTEND DEMO
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

    modelName.textContent = "YOLO";

    /* Load image */

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
   DETECTION BUTTON
========================================= */

detectBtn.addEventListener("click", function () {

    if (!selectedImage || !imageObject) {
        return;
    }

    detectBtn.disabled = true;

    detectBtn.textContent =
        "Analyzing...";

    detectionStatus.className =
        "badge bg-warning text-dark p-2";

    detectionStatus.textContent =
        "ANALYZING";


    /*
       Small delay only for prototype
       to simulate model processing.
    */

    setTimeout(function () {

        runDemoDetection();

        detectBtn.disabled = false;

        detectBtn.textContent =
            "Run YOLO Detection";

    }, 1000);

});


/* =========================================
   DEMO YOLO RESULT
========================================= */

function runDemoDetection() {

    /*
       Demo detections.

       These are frontend demonstration values.
       Later backend data can replace them.
    */

    const detections = createDemoDetections();


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
        "YOLO";


    resultStatus.textContent =
        detections.length + " objects detected";


    detectionStatus.className =
        "badge bg-success p-2";

    detectionStatus.textContent =
        "DETECTION COMPLETE";


    drawImage(detections);

    displayResults(detections);

}


/* =========================================
   CREATE DEMO DETECTIONS
========================================= */

function createDemoDetections() {

    const width = imageObject.width;
    const height = imageObject.height;


    /*
       The boxes are calculated according
       to the uploaded image size.
    */

    return [

        {
            label: "Person",
            confidence: 0.94,
            box: {
                x1: width * 0.10,
                y1: height * 0.15,
                x2: width * 0.40,
                y2: height * 0.85
            }
        },

        {
            label: "Vehicle",
            confidence: 0.89,
            box: {
                x1: width * 0.50,
                y1: height * 0.45,
                x2: width * 0.85,
                y2: height * 0.85
            }
        }

    ];

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
                    ${index + 1}. ${item.label}
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