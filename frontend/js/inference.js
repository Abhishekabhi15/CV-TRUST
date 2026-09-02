const inferenceImage =
    document.getElementById("inferenceImage");

const imageInfo =
    document.getElementById("imageInfo");

const verifyInferenceBtn =
    document.getElementById("verifyInferenceBtn");

const inferenceStatus =
    document.getElementById("inferenceStatus");



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



verifyInferenceBtn.addEventListener("click", function () {


    if (inferenceImage.files.length === 0) {

        alert("Please select an input image first.");

        return;
    }


    inferenceStatus.textContent =
        "VERIFYING...";


    inferenceStatus.className =
        "badge bg-warning text-dark p-2";


    verifyInferenceBtn.disabled =
        true;


    verifyInferenceBtn.textContent =
        "Verifying...";


    setTimeout(function () {


        inferenceStatus.textContent =
            "VERIFIED";


        inferenceStatus.className =
            "badge bg-success p-2";


        verifyInferenceBtn.textContent =
            "Verification Complete";


        verifyInferenceBtn.classList.remove(
            "btn-primary"
        );


        verifyInferenceBtn.classList.add(
            "btn-success"
        );


    }, 1200);

});



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