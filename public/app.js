const form = document.getElementById("ticket-form");
const message = document.getElementById("form-message");
const domainNote = document.getElementById("domain-note");
const emailInput = document.getElementById("email-input");

let allowedDomain = "company.com";
const emailDomainErrorTemplate = "Please use your company email address (@{domain}) to submit this form.";

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type || ""}`.trim();
}

function getEmailDomainErrorMessage() {
  return emailDomainErrorTemplate.replace("{domain}", allowedDomain);
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    allowedDomain = data.allowedEmailDomain || allowedDomain;
    domainNote.textContent = `Only @${allowedDomain} email addresses are allowed.`;
    emailInput.placeholder = `name@${allowedDomain}`;
    emailInput.setAttribute("pattern", `^[^@\\s]+@${allowedDomain.replaceAll(".", "\\.")}$`);
    emailInput.title = getEmailDomainErrorMessage();
  } catch {
    domainNote.textContent = `Only @${allowedDomain} email addresses are allowed.`;
  }
}

emailInput.addEventListener("input", () => {
  emailInput.setCustomValidity("");
});

emailInput.addEventListener("invalid", () => {
  if (emailInput.validity.patternMismatch) {
    emailInput.setCustomValidity(getEmailDomainErrorMessage());
  } else {
    emailInput.setCustomValidity("");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
  } catch {
    showMessage("Network error. Please try again.", "error");
  }
});

loadConfig();
