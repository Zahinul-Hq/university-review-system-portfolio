import { postJson } from "./shared/api.js";
import {
  clearFieldError,
  setStatus,
  validateForm,
} from "./shared/form-validation.js";
import { createUniversityDepartmentSelector } from "./university-departments.js";

const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const loginTab = document.querySelector("#login-tab");
const authTabs = document.querySelector(".auth-tabs");
const loginPanel = document.querySelector("#login-panel");
const signupPanel = document.querySelector("#signup-panel");
const universitySelect = document.querySelector("#signup-university");
const departmentSelect = document.querySelector("#signup-department");
const universityNote = document.querySelector("#university-note");
const departmentNote = document.querySelector("#department-note");
const signupButton = document.querySelector("#signup-submit");
const sessionPanel = document.querySelector("#session-panel");
const sessionMessage = document.querySelector("#session-message");
const logoutButton = document.querySelector("#logout-button");
const signupVerification = document.querySelector("#signup-verification");
const signupVerificationMessage = document.querySelector(
  "#signup-verification-message",
);
const resendVerificationButton = document.querySelector(
  "#resend-verification-button",
);
const resendVerificationStatus = document.querySelector(
  "#resend-verification-status",
);
let pendingVerificationEmail = "";

function showSession(user) {
  sessionMessage.textContent = `Signed in as ${user.username}${user.role === "admin" ? " (Admin)" : ""}.`;
  const adminBtn = document.querySelector("#admin-session-btn");
  if (adminBtn) {
    adminBtn.hidden = user.role !== "admin";
  }
  sessionPanel.hidden = false;
  authTabs.hidden = true;
  loginPanel.hidden = true;
  signupPanel.hidden = true;
}

const departmentSelector = createUniversityDepartmentSelector({
  universitySelect,
  departmentSelect,
  universityNote,
  departmentNote,
  signupButton,
});
departmentSelector.load();

for (const form of [loginForm, signupForm]) {
  form.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
      return;
    }
    if (field.validity.valid) clearFieldError(field);
  });
}

signupForm.addEventListener("change", (event) => {
  const field = event.target;
  if (field instanceof HTMLSelectElement && field.validity.valid) {
    clearFieldError(field);
  }
  signupButton.disabled =
    !universitySelect.value || !departmentSelect.value;
});

resendVerificationButton.addEventListener("click", async () => {
  resendVerificationButton.disabled = true;
  resendVerificationStatus.textContent = "Sending verification email.";
  delete resendVerificationStatus.dataset.state;

  try {
    const result = await postJson("/api/auth/resend-email-verification", {
      emailAddress: pendingVerificationEmail,
    });
    resendVerificationStatus.textContent = result.message;
    resendVerificationStatus.dataset.state = "success";
  } catch (error) {
    resendVerificationStatus.textContent = error.message;
    resendVerificationStatus.dataset.state = "error";
  } finally {
    resendVerificationButton.disabled = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm(loginForm)) return;

  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  setStatus(loginForm, "Signing in.");

  try {
    const result = await postJson("/api/auth/login", {
      identifier: loginForm.elements.identifier.value,
      password: loginForm.elements.password.value,
    });
    showSession(result.user);
    sessionMessage.focus();
  } catch (error) {
    setStatus(loginForm, error.message, "error");
  } finally {
    button.disabled = false;
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm(signupForm)) return;

  const association = departmentSelector.findAssociation(
    universitySelect.value,
    departmentSelect.value,
  );
  if (!association) {
    setStatus(
      signupForm,
      "That department is not available at the selected university. Choose both again.",
      "error",
    );
    return;
  }

  const button = signupForm.querySelector('[type="submit"]');
  button.disabled = true;
  setStatus(signupForm, "Creating your account.");

  try {
    await postJson("/api/auth/register", {
      username: signupForm.elements.username.value,
      emailAddress: signupForm.elements.emailAddress.value,
      password: signupForm.elements.password.value,
      universityDepartmentId: association.universityDepartmentId,
    });

    const emailAddress = signupForm.elements.emailAddress.value;
    pendingVerificationEmail = emailAddress;
    signupVerificationMessage.textContent =
      `We sent a verification link to ${emailAddress}. Confirm your email before signing in.`;
    signupForm.reset();
    signupForm.hidden = true;
    signupVerification.hidden = false;
    departmentSelect.replaceChildren(
      new Option("Choose a university first", ""),
    );
    departmentSelect.disabled = true;
    signupButton.disabled = true;
  } catch (error) {
    setStatus(signupForm, error.message, "error");
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await postJson("/api/auth/logout", {});
    sessionPanel.hidden = true;
    authTabs.hidden = false;
    loginPanel.hidden = false;
    signupPanel.hidden = true;
    setStatus(loginForm, "You are signed out.", "success");
    loginTab.click();
    loginTab.focus();
  } catch (error) {
    sessionMessage.textContent = error.message;
  } finally {
    logoutButton.disabled = false;
  }
});

async function loadSession() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });
    if (!response.ok) return;
    const result = await response.json();
    showSession(result.user);
  } catch {
    setStatus(loginForm, "Account status could not be checked.", "error");
  }
}

loadSession();
