function findFieldError(field) {
  const errorId = field
    .getAttribute("aria-describedby")
    ?.split(/\s+/)
    .find((id) =>
      document.getElementById(id)?.classList.contains("field__error"),
    );

  return errorId ? document.getElementById(errorId) : null;
}

function getFieldError(field) {
  if (field.validity.valueMissing) {
    return field.dataset.requiredError || "Complete this field.";
  }
  if (field.validity.typeMismatch) {
    return field.dataset.typeError || "Enter a value in the correct format.";
  }
  if (field.validity.tooShort) {
    return `Use at least ${field.minLength} characters.`;
  }
  if (field.validity.patternMismatch) {
    return field.dataset.patternError || "Check the format and try again.";
  }
  return "";
}

export function clearFieldError(field) {
  field.removeAttribute("aria-invalid");

  const error = findFieldError(field);
  if (error) {
    error.textContent = "";
    error.hidden = true;
  }
}

export function validateForm(form) {
  const fields = [...form.querySelectorAll("input, select")];
  const invalidFields = fields.filter((field) => !field.validity.valid);

  for (const field of fields) {
    clearFieldError(field);
  }

  for (const field of invalidFields) {
    const error = findFieldError(field);
    field.setAttribute("aria-invalid", "true");

    if (error) {
      error.textContent = getFieldError(field);
      error.hidden = false;
    }
  }

  if (!invalidFields.length) {
    return true;
  }

  const status = form.querySelector(".form__status");
  status.textContent = `Check ${invalidFields.length} ${invalidFields.length === 1 ? "field" : "fields"}.`;
  status.dataset.state = "error";
  invalidFields[0].focus();
  return false;
}

export function setStatus(form, message, state = "") {
  const status = form.querySelector(".form__status");
  status.textContent = message;

  if (state) {
    status.dataset.state = state;
  } else {
    delete status.dataset.state;
  }
}
