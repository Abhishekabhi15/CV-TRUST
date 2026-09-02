const modelInput = document.getElementById("modelInput");

const verifyModelBtn = document.getElementById("verifyModelBtn");

const modelFileInfo = document.getElementById("modelFileInfo");

const modelStatus = document.getElementById("modelStatus");



modelInput.addEventListener("change", function () {

    if (modelInput.files.length === 0) {

        modelFileInfo.textContent = "No model selected.";

        verifyModelBtn.disabled = true;

        return;

    }


    const file = modelInput.files[0];


    modelFileInfo.textContent =
        file.name +
        " (" +
        formatFileSize(file.size) +
        ")";


    verifyModelBtn.disabled = false;

});



verifyModelBtn.addEventListener("click", function () {

    modelStatus.textContent = "BLOCKED";

    modelStatus.className = "badge bg-danger p-2";

    verifyModelBtn.disabled = false;

    verifyModelBtn.textContent = "Verify Model";

    verifyModelBtn.classList.remove("btn-success");

    verifyModelBtn.classList.add("btn-primary");

    alert("MODEL PAGE BLOCKED: backend requires a server-side modelPath. A browser file cannot be verified from this page.");

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
