const form = document.getElementById("ticket-form");
const message = document.getElementById("form-message");
const identityForm = document.getElementById("identity-form");
const identityMessage = document.getElementById("identity-message");
const identityEmailInput = document.getElementById("identity-email-input");
const emailInput = document.getElementById("email-input");
const verifiedPanel = document.getElementById("verified-panel");
const verifiedGreeting = document.getElementById("verified-greeting");
const changeEmailButton = document.getElementById("change-email-button");

let allowedDomain = "company.com";
let allowedUserListEnabled = false;
let currentVerifiedEmail = "";
const emailDomainErrorTemplate = "Please use your company email address (@{domain}) to submit this form.";

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type || ""}`.trim();
}

function setIdentityMessage(text, type) {
  identityMessage.textContent = text;
  identityMessage.className = `message ${type || ""}`.trim();
}

function getEmailDomainErrorMessage() {
  return emailDomainErrorTemplate.replace("{domain}", allowedDomain);
}

function configureEmailInput(input) {
  input.placeholder = `name@${allowedDomain}`;
  input.setAttribute("pattern", `^[^@\\s]+@${allowedDomain.replaceAll(".", "\\.")}$`);
  input.title = getEmailDomainErrorMessage();
}

function attachEmailValidation(input) {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });

  input.addEventListener("invalid", () => {
    if (input.validity.patternMismatch) {
      input.setCustomValidity(getEmailDomainErrorMessage());
    } else {
      input.setCustomValidity("");
    }
  });
}

function showTicketForm(email, displayName) {
  currentVerifiedEmail = email;
  emailInput.value = email;
  verifiedGreeting.textContent = `Hello ${displayName || email}`;
  identityForm.classList.add("hidden");
  verifiedPanel.classList.remove("hidden");
  form.classList.remove("hidden");
  showMessage("", "");
}

function showIdentityForm() {
  currentVerifiedEmail = "";
  form.reset();
  emailInput.value = "";
  verifiedGreeting.textContent = "";
  identityForm.classList.remove("hidden");
  verifiedPanel.classList.add("hidden");
  form.classList.add("hidden");
  setIdentityMessage("", "");
  showMessage("", "");
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    allowedDomain = data.allowedEmailDomain || allowedDomain;
    allowedUserListEnabled = Boolean(data.allowedUserListEnabled);
  } catch {
    allowedUserListEnabled = false;
  }

  configureEmailInput(identityEmailInput);
  configureEmailInput(emailInput);
}

attachEmailValidation(identityEmailInput);
attachEmailValidation(emailInput);

identityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setIdentityMessage("Checking your email...", "");

  const payload = Object.fromEntries(new FormData(identityForm).entries());
  try {
    const res = await fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setIdentityMessage(data.error || "This email cannot access the form", "error");
      return;
    }

    setIdentityMessage("", "");
    showTicketForm(data.email, data.displayName);
    form.querySelector("input[name='name']").focus();
  } catch {
    setIdentityMessage("Network error. Please try again.", "error");
  }
});

changeEmailButton.addEventListener("click", () => {
  showIdentityForm();
  identityEmailInput.focus();
});

emailInput.addEventListener("keydown", (event) => {
  if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
  }
});

emailInput.addEventListener("paste", (event) => {
  event.preventDefault();
});

emailInput.addEventListener("input", () => {
  if (currentVerifiedEmail && emailInput.value !== currentVerifiedEmail) {
    emailInput.value = currentVerifiedEmail;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentVerifiedEmail) {
    showMessage("Please verify your work email first.", "error");
    return;
  }

  emailInput.value = currentVerifiedEmail;
  showMessage("Submitting your ticket...", "");

  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || "Could not submit ticket", "error");
      return;
    }

    showMessage(`Ticket submitted. Reference ID: ${data.ticketId}`, "ok");
    form.reset();
    emailInput.value = currentVerifiedEmail;
  } catch {
    showMessage("Network error. Please try again.", "error");
  }
});

loadConfig();
