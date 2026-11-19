import { getJson, postJson } from "./shared/api.js";

const userPanel = document.querySelector("#rating-user");
const username = document.querySelector("#rating-username");
const logoutButton = document.querySelector("#rating-logout");
const universityName = document.querySelector("#rating-university-name");
const departmentName = document.querySelector("#rating-department-name");
const gate = document.querySelector("#rating-gate");
const gateMessage = document.querySelector("#rating-gate-message");
const gateLink = document.querySelector("#rating-gate-link");
const retryButton = document.querySelector("#rating-retry");
const ratingForm = document.querySelector("#rating-form");
const ratingFields = document.querySelector("#rating-fields");
const submitButton = document.querySelector("#rating-submit");
const formStatus = document.querySelector("#rating-form-status");
const completion = document.querySelector("#rating-complete");
const completionTitle = document.querySelector("#rating-complete-title");
const completionMessage = document.querySelector("#rating-complete-message");

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    return null;
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Your account could not be checked.");
  }

  return result.user;
}

function showGate(message, state = "") {
  gate.hidden = false;
  gateMessage.textContent = message;
  if (state) {
    gate.dataset.state = state;
  } else {
    delete gate.dataset.state;
  }
}

function renderRatingFields(tags) {
  ratingFields.replaceChildren();

  for (const tag of tags) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "rating-item";
    fieldset.dataset.tagId = tag.tagId;

    const legend = document.createElement("legend");
    legend.id = `rating-legend-${tag.tagId}`;
    legend.textContent = tag.name;

    const description = document.createElement("p");
    description.className = "rating-item__description";
    description.id = `rating-description-${tag.tagId}`;
    description.textContent = tag.description;

    const options = document.createElement("div");
    options.className = "rating-options";
    options.setAttribute("role", "radiogroup");
    options.setAttribute("aria-labelledby", legend.id);

    const error = document.createElement("p");
    error.className = "rating-item__error";
    error.id = `rating-error-${tag.tagId}`;
    error.hidden = true;
    error.textContent = `Choose a rating for ${tag.name}.`;
    options.setAttribute("aria-describedby", error.id);

    for (let score = 1; score <= 5; score += 1) {
      const label = document.createElement("label");
      label.className = "rating-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `rating-${tag.tagId}`;
      input.value = String(score);
      input.required = true;
      input.setAttribute("aria-label", `${score} out of 5`);
      input.setAttribute(
        "aria-describedby",
        `${description.id} ${error.id}`,
      );

      const value = document.createElement("span");
      value.textContent = String(score);
      label.append(input, value);
      options.append(label);
    }

    fieldset.append(legend, description, options, error);
    ratingFields.append(fieldset);
  }
}

function showCompletion(title, message) {
  ratingForm.hidden = true;
  gate.hidden = true;
  completion.hidden = false;
  completionTitle.textContent = title;
  completionMessage.textContent = message;
}

function validateRatings() {
  let firstMissingInput = null;
  const fieldsets = ratingFields.querySelectorAll(".rating-item");

  for (const fieldset of fieldsets) {
    const options = fieldset.querySelector(".rating-options");
    const error = fieldset.querySelector(".rating-item__error");
    const selected = fieldset.querySelector("input:checked");

    if (!selected) {
      options.setAttribute("aria-invalid", "true");
      error.hidden = false;
      firstMissingInput ??= fieldset.querySelector("input");
      continue;
    }

    options.removeAttribute("aria-invalid");
    error.hidden = true;
  }

  if (firstMissingInput) {
    firstMissingInput.focus();
    return false;
  }

  return true;
}

function clearRatingError(event) {
  const fieldset = event.target.closest(".rating-item");
  if (!fieldset) return;

  fieldset.querySelector(".rating-options").removeAttribute("aria-invalid");
  fieldset.querySelector(".rating-item__error").hidden = true;
}

async function loadReviewPage() {
  retryButton.hidden = true;
  gateLink.hidden = true;
  ratingForm.hidden = true;
  completion.hidden = true;
  userPanel.hidden = true;
  showGate("Loading your review form.");

  try {
    const [tagResult, user] = await Promise.all([
      getJson("/api/reviews/tags"),
      loadCurrentUser(),
    ]);

    if (!Array.isArray(tagResult.tags) || tagResult.tags.length === 0) {
      showGate("There are no active review categories right now.", "error");
      return;
    }

    renderRatingFields(tagResult.tags);

    if (!user) {
      universityName.textContent = "Sign in to see your university";
      departmentName.textContent = "";
      showGate("Sign in to rate your university.");
      gateLink.hidden = false;
      return;
    }

    userPanel.hidden = false;
    username.textContent = `Signed in as ${user.username}`;

    const [reviewStatus, departmentResult] = await Promise.all([
      getJson("/api/reviews/me"),
      getJson("/api/auth/university-departments"),
    ]);
    const affiliation = departmentResult.universityDepartments.find(
      (item) => item.universityDepartmentId === user.universityDepartmentId,
    );

    if (!affiliation) {
      throw new Error("Your university affiliation could not be found.");
    }

    universityName.textContent = affiliation.universityName;
    departmentName.textContent = affiliation.departmentName;

    if (reviewStatus.hasReviewed) {
      showCompletion(
        "Ratings already submitted",
        "You have already rated this university. Your ratings are included in the category averages.",
      );
      return;
    }

    if (!user.isVerified) {
      showGate(
        "University verification is required before you can submit ratings.",
      );
      return;
    }

    gate.hidden = true;
    ratingForm.hidden = false;
  } catch (error) {
    showGate(
      error instanceof Error
        ? error.message
        : "Your review form could not be loaded.",
      "error",
    );
    retryButton.hidden = false;
  }
}

ratingFields.addEventListener("change", clearRatingError);

ratingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateRatings()) {
    formStatus.textContent = "Choose a rating for every category.";
    formStatus.dataset.state = "error";
    return;
  }

  const ratings = Array.from(ratingFields.querySelectorAll(".rating-item")).map(
    (fieldset) => ({
      tagId: fieldset.dataset.tagId,
      rating: Number(fieldset.querySelector("input:checked").value),
    }),
  );

  submitButton.disabled = true;
  formStatus.textContent = "Submitting your ratings.";
  delete formStatus.dataset.state;

  try {
    await postJson("/api/reviews", { ratings });
    showCompletion(
      "Ratings saved",
      "Your ratings have been added to the university’s results.",
    );
  } catch (error) {
    formStatus.textContent =
      error instanceof Error
        ? error.message
        : "Your ratings could not be submitted.";
    formStatus.dataset.state = "error";
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await postJson("/api/auth/logout", {});
    window.location.assign("./index.html");
  } catch (error) {
    showGate(
      error instanceof Error ? error.message : "Unable to log out.",
      "error",
    );
  } finally {
    logoutButton.disabled = false;
  }
});

retryButton.addEventListener("click", loadReviewPage);

loadReviewPage();
