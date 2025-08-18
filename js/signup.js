(function () {
  "use strict";

  const openBtn = document.getElementById("openSignup");
  const form = document.getElementById("signupForm");
  const thanks = document.getElementById("signupThanks");
  const emailInput = form.querySelector("input[type='email']");
  const errorMsg = document.getElementById("errorMsg");
  const submitBtn = form.querySelector("button[type='submit']");
  const icon = submitBtn.querySelector("i");

  // Simple regex for custom email validation.
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  // When the button is clicked, hide it and show the form.
  openBtn.addEventListener("click", () => {
    openBtn.classList.add("dn");
    form.classList.remove("dn");
    emailInput.focus();
  });

  // When the form is submitted (by clicking the icon or hitting Enter)
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopPropagation();

    // Clear previous error messages.
    errorMsg.innerText = "";
    errorMsg.classList.add("dn");

    // Use HTML5 built-in validation.
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(":invalid");
      if (firstInvalid) firstInvalid.focus();
      form.classList.add("was-validated");
      errorMsg.innerText = "Please enter a valid email address.";
      errorMsg.classList.remove("dn");
      return;
    }

    // Custom email validation.
    if (!validateEmail(emailInput.value)) {
      errorMsg.innerText = "Please enter a valid email address.";
      errorMsg.classList.remove("dn");
      emailInput.focus();
      return;
    }

    // Immediately switch the icon (from check to hourglass).
    icon.classList.remove("bi-check2-circle");
    icon.classList.add("bi-hourglass-split");

    // Disable input to prevent duplicate submissions.
    emailInput.disabled = true;
    submitBtn.disabled = true;

    // Prepare form data as JSON.
    const formData = new FormData(form);
    const object = {};
    formData.forEach((value, key) => {
      object[key] = value;
    });
    const json = JSON.stringify(object);

    // Submit the form data using fetch.
    fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: json
    })
      .then(async (response) => {
        let jsonResponse = await response.json();
        if (response.status === 200) {
          // Wait 1 second before showing the thank-you message.
          setTimeout(() => {
            form.classList.add("dn");
            thanks.classList.remove("dn");
          }, 1000);
        } else {
          throw new Error(jsonResponse.message || "Submission failed. Please try again.");
        }
      })
      .catch((error) => {
        console.error(error);
        errorMsg.innerText = error.message || "Something went wrong. Please try again.";
        errorMsg.classList.remove("dn");
        // Revert the icon change and re-enable inputs.
        icon.classList.remove("bi-hourglass-split");
        icon.classList.add("bi-check2-circle");
        emailInput.disabled = false;
        submitBtn.disabled = false;
      })
      .finally(() => {
        form.reset();
        form.classList.remove("was-validated");
      });
  });
})();