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

    // ── PASS 1: Hash all files + collect image info ───────────────────────────
    const fileResults = [];

    for (const file of files) {
        const hash      = await calculateHash(file);
        const imageInfo = await getImageInfo(file);

        fileResults.push({
            file:   file,
            hash:   hash,
            width:  imageInfo.width,
            height: imageInfo.height,
            brightness: imageInfo.brightness,
            // filled in pass 2:
            isDuplicate: false,
            duplicateOf: null,
            isCanonical: false,
            suspicious:  false,
        });
    }

    // ── GROUP by SHA-256 ──────────────────────────────────────────────────────
    // hashGroups: Map<hash, fileResult[]>
    const hashGroups = new Map();
    for (const item of fileResults) {
        if (!hashGroups.has(item.hash)) {
            hashGroups.set(item.hash, []);
        }
        hashGroups.get(item.hash).push(item);
    }

    // ── CANONICAL SELECTION ───────────────────────────────────────────────────
    // For every group with more than one member, elect one canonical file.
    //
    // Rule (deterministic, independent of scan order):
    //   1. Shortest filename wins  — originals tend to have simpler names;
    //      copies/duplicates typically gain a suffix ("-copy", "(1)", etc.)
    //   2. On length tie: lexicographically smallest name wins
    //      (ASCII order, case-sensitive, consistent across browsers).
    //
    // This rule never pattern-matches on words like "copy" or "original";
    // it uses only filename length + alphabetic order.
    //
    function selectCanonical(group) {
        return group.slice().sort(function (a, b) {
            const lenDiff = a.file.name.length - b.file.name.length;
            if (lenDiff !== 0) return lenDiff;           // shorter = canonical
            return a.file.name.localeCompare(b.file.name); // tiebreak: a–z
        })[0];
    }

    // ── PASS 2: Annotate each file ────────────────────────────────────────────
    const canonicalNames = new Map(); // hash → canonical filename

    for (const [hash, group] of hashGroups) {
        const canonical = selectCanonical(group);
        canonicalNames.set(hash, canonical.file.name);

        for (const item of group) {
            if (item.file.name === canonical.file.name) {
                item.isCanonical = true;
                item.isDuplicate = false;
                item.duplicateOf = null;
            } else {
                item.isCanonical = false;
                item.isDuplicate = true;
                item.duplicateOf = canonical.file.name;
            }
        }
    }

    // ── SUSPICIOUS DETECTION ──────────────────────────────────────────────────
    // Only check non-duplicate files: a duplicate is already classified.
    // Suspicious = dimensions differ from the dataset median by > 50 %.
    const widths  = fileResults.map(i => i.width ).filter(v => v > 0);
    const heights = fileResults.map(i => i.height).filter(v => v > 0);

    const medianWidth  = getMedian(widths);
    const medianHeight = getMedian(heights);

    let suspiciousCount = 0;

    for (const item of fileResults) {
        if (item.isDuplicate) {
            item.suspicious = false;        // never double-classify
            continue;
        }
        const widthDiff  = Math.abs(item.width  - medianWidth)  / (medianWidth  || 1);
        const heightDiff = Math.abs(item.height - medianHeight) / (medianHeight || 1);
        item.suspicious  = widthDiff > 0.50 || heightDiff > 0.50;
        if (item.suspicious) suspiciousCount++;
    }

    // ── COUNTS ────────────────────────────────────────────────────────────────
    // uniqueCount  = number of distinct hashes (= number of canonical files)
    // duplicateCount = total files minus canonical files
    const uniqueCount    = hashGroups.size;
    const duplicateCount = files.length - uniqueCount;

    // ── RISK SCORE ────────────────────────────────────────────────────────────
    let risk = 0;
    if (files.length > 0) {
        const duplicateRisk  = (duplicateCount  / files.length) * 60;
        const suspiciousRisk = (suspiciousCount / files.length) * 40;
        risk = Math.round(duplicateRisk + suspiciousRisk);
    }

    return {
        total:      files.length,
        unique:     uniqueCount,
        duplicates: duplicateCount,
        suspicious: suspiciousCount,
        risk:       risk,
        files:      fileResults,
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

        const row = document.createElement("tr");

        let statusHTML;

        if (item.isDuplicate) {
            // Duplicate of a previously seen hash
            const origLabel = item.duplicateOf
                ? ` of <em>${escapeHTML(item.duplicateOf)}</em>`
                : '';
            statusHTML = `<span class="badge bg-danger">DUPLICATE${origLabel ? ' — ' + origLabel : ''}</span>`;
        } else if (item.suspicious) {
            statusHTML = '<span class="badge bg-warning text-dark">SUSPICIOUS</span>';
        } else {
            // First occurrence of this hash = ORIGINAL for this session
            statusHTML = '<span class="badge bg-success">ORIGINAL</span>';
        }

        const size       = formatFileSize(item.file.size);
        const dimensions = item.width + " × " + item.height;
        const hashShort  = item.hash ? item.hash.substring(0, 12) + "…" : "—";

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.file.name)}</td>
            <td>${size}</td>
            <td>${dimensions}</td>
            <td><code class="small text-muted" title="${item.hash || ''}">${hashShort}</code></td>
            <td>${statusHTML}</td>
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