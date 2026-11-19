import { postJson } from "./shared/api.js";

const verifyButton = document.querySelector("#verify-email-button");
const status = document.querySelector("#verify-email-status");
const token = new URLSearchParams(window.location.search).get("token");

window.history.replaceState(null, "", window.location.pathname);

if (!token) {
  verifyButton.disabled = true;
  status.textContent = "This verification link is missing its token.";
  status.dataset.state = "error";
} else {
  verifyButton.addEventListener("click", async () => {
    verifyButton.disabled = true;
    status.textContent = "Verifying your email address.";
    delete status.dataset.state;

    try {
      await postJson(
        "/api/auth/verify-email",
        { token },
        "Email verification failed.",
      );

      status.textContent =
        "Email address verified. You can now sign in. University affiliation is verified separately.";
      status.dataset.state = "success";
      verifyButton.hidden = true;
    } catch (error) {
      status.textContent = error.message;
      status.dataset.state = "error";
      verifyButton.disabled = false;
    }
  });
}
