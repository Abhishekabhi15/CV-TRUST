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


    modelStatus.textContent = "VERIFYING...";

    modelStatus.className = "badge bg-warning text-dark p-2";


    verifyModelBtn.disabled = true;


    setTimeout(function () {


        modelStatus.textContent = "VERIFIED";

        modelStatus.className = "badge bg-success p-2";


        verifyModelBtn.textContent = "Verification Complete";


        verifyModelBtn.classList.remove("btn-primary");

        verifyModelBtn.classList.add("btn-success");


    }, 1200);


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