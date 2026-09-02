document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            if (email && password) {

                // Temporary frontend login.
                // Later we will connect this to:
                // POST /api/auth/login

                window.location.href = "dashboard.html";

            }

        });

    }

});