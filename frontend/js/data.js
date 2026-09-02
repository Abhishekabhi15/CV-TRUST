/* =========================================
   CV-TRUST DATA ASSURANCE
========================================= */

let selectedFiles = [];

const datasetInput = document.getElementById("datasetInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const fileInfo = document.getElementById("fileInfo");

const resultsSection = document.getElementById("resultsSection");

const totalImages = document.getElementById("totalImages");
const uniqueImages = document.getElementById("uniqueImages");
const duplicateImages = document.getElementById("duplicateImages");
const suspiciousImages = document.getElementById("suspiciousImages");

const duplicateStatus = document.getElementById("duplicateStatus");
const suspiciousStatus = document.getElementById("suspiciousStatus");

const riskScore = document.getElementById("riskScore");
const riskBar = document.getElementById("riskBar");
const riskMessage = document.getElementById("riskMessage");

const fileTableBody = document.getElementById("fileTableBody");
const findingsContainer = document.getElementById("findingsContainer");

const analysisStatus = document.getElementById("analysisStatus");


/* =========================================
   FILE SELECTION
========================================= */

datasetInput.addEventListener("change", function () {

    selectedFiles = Array.from(this.files);

    if (selectedFiles.length === 0) {

        fileInfo.className = "alert alert-secondary mt-3 mb-0";

        fileInfo.textContent = "No dataset selected.";

        analyzeBtn.disabled = true;

        return;
    }


    fileInfo.className = "alert alert-info mt-3 mb-0";

    fileInfo.innerHTML =
        "<strong>" +
        selectedFiles.length +
        "</strong> image(s) selected.";


    analyzeBtn.disabled = false;

    resultsSection.classList.add("d-none");

    analysisStatus.className = "badge bg-secondary p-2";

    analysisStatus.textContent = "READY TO ANALYZE";

});


/* =========================================
   ANALYZE DATASET
========================================= */

analyzeBtn.addEventListener("click", async function () {

    if (selectedFiles.length === 0) {
        return;
    }


    analyzeBtn.disabled = true;

    analyzeBtn.textContent = "Analyzing...";


    analysisStatus.className = "badge bg-warning text-dark p-2";

    analysisStatus.textContent = "ANALYZING";


    try {

        const results = await analyzeDataset(selectedFiles);

        displayResults(results);

    }

    catch (error) {

        console.error(error);

        alert("Unable to analyze the selected dataset.");

    }


    analyzeBtn.disabled = false;

    analyzeBtn.textContent = "Analyze Dataset";

});


/* =========================================
   MAIN ANALYSIS
========================================= */

async function analyzeDataset(files) {

    const fileResults = [];

    const hashes = new Map();


    for (const file of files) {

        const hash = await calculateHash(file);

        const imageInfo = await getImageInfo(file);


        let duplicate = false;

        if (hashes.has(hash)) {

            duplicate = true;

        }
        else {

            hashes.set(hash, file.name);

        }


        fileResults.push({

            file: file,

            hash: hash,

            duplicate: duplicate,

            width: imageInfo.width,

            height: imageInfo.height,

            brightness: imageInfo.brightness

        });

    }


    const uniqueCount = hashes.size;

    const duplicateCount = files.length - uniqueCount;


    /*
        Basic anomaly detection.

        Images are considered suspicious when their
        dimensions are significantly different from
        the median dimensions of the dataset.
    */

    const widths = fileResults
        .map(item => item.width)
        .filter(value => value > 0);

    const heights = fileResults
        .map(item => item.height)
        .filter(value => value > 0);


    const medianWidth = getMedian(widths);

    const medianHeight = getMedian(heights);


    let suspiciousCount = 0;


    fileResults.forEach(item => {

        const widthDifference =
            Math.abs(item.width - medianWidth) /
            medianWidth;

        const heightDifference =
            Math.abs(item.height - medianHeight) /
            medianHeight;


        item.suspicious =
            widthDifference > 0.50 ||
            heightDifference > 0.50;


        if (item.suspicious) {

            suspiciousCount++;

        }

    });


    /*
        Risk calculation.

        Duplicate samples contribute to risk.
        Suspicious samples contribute to risk.
    */

    let risk = 0;


    if (files.length > 0) {

        const duplicateRisk =
            (duplicateCount / files.length) * 60;

        const suspiciousRisk =
            (suspiciousCount / files.length) * 40;


        risk = Math.round(
            duplicateRisk + suspiciousRisk
        );

    }


    return {

        total: files.length,

        unique: uniqueCount,

        duplicates: duplicateCount,

        suspicious: suspiciousCount,

        risk: risk,

        files: fileResults

    };

}


/* =========================================
   SHA-256 FILE HASH
========================================= */

async function calculateHash(file) {

    const buffer = await file.arrayBuffer();

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            buffer
        );


    const hashArray =
        Array.from(new Uint8Array(hashBuffer));


    return hashArray
        .map(byte =>
            byte.toString(16).padStart(2, "0")
        )
        .join("");

}


/* =========================================
   IMAGE INFORMATION
========================================= */

function getImageInfo(file) {

    return new Promise(function (resolve) {

        const image = new Image();

        const url =
            URL.createObjectURL(file);


        image.onload = function () {

            let brightness = 0;


            /*
                Small canvas used only to estimate
                average image brightness.
            */

            try {

                const canvas =
                    document.createElement("canvas");

                const context =
                    canvas.getContext("2d");


                canvas.width = 50;

                canvas.height = 50;


                context.drawImage(
                    image,
                    0,
                    0,
                    50,
                    50
                );


                const data =
                    context.getImageData(
                        0,
                        0,
                        50,
                        50
                    ).data;


                let total = 0;

                let pixels = 0;


                for (
                    let i = 0;
                    i < data.length;
                    i += 4
                ) {

                    const r = data[i];

                    const g = data[i + 1];

                    const b = data[i + 2];


                    total +=
                        (r + g + b) / 3;

                    pixels++;

                }


                brightness =
                    Math.round(
                        total / pixels
                    );

            }

            catch (error) {

                brightness = 0;

            }


            URL.revokeObjectURL(url);


            resolve({

                width: image.width,

                height: image.height,

                brightness: brightness

            });

        };


        image.onerror = function () {

            URL.revokeObjectURL(url);


            resolve({

                width: 0,

                height: 0,

                brightness: 0

            });

        };


        image.src = url;

    });

}


/* =========================================
   MEDIAN
========================================= */

function getMedian(values) {

    if (values.length === 0) {
        return 1;
    }


    const sorted =
        [...values].sort(
            (a, b) => a - b
        );


    const middle =
        Math.floor(sorted.length / 2);


    if (sorted.length % 2 === 0) {

        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;

    }


    return sorted[middle];

}


/* =========================================
   DISPLAY RESULTS
========================================= */

function displayResults(results) {

    resultsSection.classList.remove("d-none");


    /* Summary cards */

    totalImages.textContent =
        results.total;


    uniqueImages.textContent =
        results.unique;


    duplicateImages.textContent =
        results.duplicates;


    suspiciousImages.textContent =
        results.suspicious;


    /* Duplicate status */

    if (results.duplicates > 0) {

        duplicateStatus.className =
            "badge bg-danger";

        duplicateStatus.textContent =
            "DUPLICATES FOUND";

    }
    else {

        duplicateStatus.className =
            "badge bg-success";

        duplicateStatus.textContent =
            "NONE";

    }


    /* Suspicious status */

    if (results.suspicious > 0) {

        suspiciousStatus.className =
            "badge bg-warning text-dark";

        suspiciousStatus.textContent =
            "REVIEW";

    }
    else {

        suspiciousStatus.className =
            "badge bg-success";

        suspiciousStatus.textContent =
            "CLEAN";

    }


    /* Risk */

    riskScore.textContent =
        results.risk + "%";


    riskBar.style.width =
        results.risk + "%";


    riskBar.textContent =
        results.risk + "%";


    if (results.risk === 0) {

        riskBar.className =
            "progress-bar bg-success";

        riskMessage.className =
            "alert alert-success mt-3 mb-0";

        riskMessage.textContent =
            "Dataset integrity looks healthy. No duplicate or basic dimension anomalies were detected.";

        analysisStatus.className =
            "badge bg-success p-2";

        analysisStatus.textContent =
            "VERIFIED";

    }

    else if (results.risk < 30) {

        riskBar.className =
            "progress-bar bg-warning";

        riskMessage.className =
            "alert alert-warning mt-3 mb-0";

        riskMessage.textContent =
            "Minor integrity findings detected. Review the affected samples.";

        analysisStatus.className =
            "badge bg-warning text-dark p-2";

        analysisStatus.textContent =
            "REVIEW REQUIRED";

    }

    else {

        riskBar.className =
            "progress-bar bg-danger";

        riskMessage.className =
            "alert alert-danger mt-3 mb-0";

        riskMessage.textContent =
            "Significant integrity findings detected. Dataset requires investigation.";

        analysisStatus.className =
            "badge bg-danger p-2";

        analysisStatus.textContent =
            "SUSPICIOUS";

    }


    /* File table */

    fileTableBody.innerHTML = "";


    results.files.forEach(function (item, index) {

        const row =
            document.createElement("tr");


        let statusHTML;


        if (item.duplicate) {

            statusHTML =
                '<span class="badge bg-danger">DUPLICATE</span>';

        }

        else if (item.suspicious) {

            statusHTML =
                '<span class="badge bg-warning text-dark">SUSPICIOUS</span>';

        }

        else {

            statusHTML =
                '<span class="badge bg-success">NORMAL</span>';

        }


        const size =
            formatFileSize(
                item.file.size
            );


        const dimensions =
            item.width +
            " × " +
            item.height;


        row.innerHTML = `

            <td>
                ${index + 1}
            </td>

            <td>
                ${escapeHTML(item.file.name)}
            </td>

            <td>
                ${size}
            </td>

            <td>
                ${dimensions}
            </td>

            <td>
                ${statusHTML}
            </td>

        `;


        fileTableBody.appendChild(row);

    });


    /* Findings */

    findingsContainer.innerHTML = "";


    if (
        results.duplicates === 0 &&
        results.suspicious === 0
    ) {

        findingsContainer.innerHTML = `

            <div class="alert alert-success">

                <strong>No integrity findings.</strong>

                All uploaded images passed the basic
                duplicate and anomaly checks.

            </div>

        `;

    }
    else {

        if (results.duplicates > 0) {

            findingsContainer.innerHTML += `

                <div class="alert alert-danger">

                    <strong>
                        Duplicate samples detected:
                    </strong>

                    ${results.duplicates}
                    duplicate image(s) were found
                    using SHA-256 file hashing.

                </div>

            `;

        }


        if (results.suspicious > 0) {

            findingsContainer.innerHTML += `

                <div class="alert alert-warning">

                    <strong>
                        Suspicious samples detected:
                    </strong>

                    ${results.suspicious}
                    image(s) have dimensions that
                    significantly differ from the
                    dataset median.

                </div>

            `;

        }

    }

}


/* =========================================
   FORMAT FILE SIZE
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
        bytes /
        (1024 * 1024)
    ).toFixed(1) + " MB";

}


/* =========================================
   HTML SAFETY
========================================= */

function escapeHTML(value) {

    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}