export function createUniversityDepartmentSelector({
  universitySelect,
  departmentSelect,
  universityNote,
  departmentNote,
  signupButton,
}) {
  let universityDepartments = [];

  function updateDepartments() {
    const universityId = universitySelect.value;
    const options = universityDepartments.filter(
      (option) => option.universityId === universityId,
    );

    departmentSelect.replaceChildren(new Option("Choose a department", ""));
    for (const option of options) {
      departmentSelect.add(
        new Option(
          `${option.departmentName} (${option.departmentAbbreviation})`,
          option.departmentId,
        ),
      );
    }

    departmentSelect.disabled = options.length === 0;
    if (!universityId) {
      departmentSelect.replaceChildren(
        new Option("Choose a university first", ""),
      );
      departmentNote.textContent =
        "Choose a department offered by your university.";
    } else if (options.length === 0) {
      departmentSelect.replaceChildren(
        new Option("No active departments available", ""),
      );
      departmentNote.textContent =
        "This university has no active departments available.";
    } else {
      departmentNote.textContent =
        "Choose a department offered by your university.";
    }

    signupButton.disabled = true;
  }

  async function load() {
    try {
      const response = await fetch("/api/auth/university-departments", {
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.universityDepartments)) {
        throw new Error("University and department options could not be loaded.");
      }

      if (result.universityDepartments.length === 0) {
        universitySelect.replaceChildren(
          new Option("No active universities available", ""),
        );
        departmentSelect.replaceChildren(
          new Option("Choose a university first", ""),
        );
        universityNote.textContent =
          "Registration is unavailable until active university departments are added.";
        signupButton.disabled = true;
        return;
      }

      universityDepartments = result.universityDepartments;
      const universities = new Map(
        universityDepartments.map((option) => [
          option.universityId,
          `${option.universityName} (${option.universityShortName})`,
        ]),
      );

      universitySelect.replaceChildren(new Option("Choose a university", ""));
      for (const [universityId, name] of universities) {
        universitySelect.add(new Option(name, universityId));
      }

      departmentSelect.replaceChildren(
        new Option("Choose a university first", ""),
      );
      universitySelect.disabled = false;
      universitySelect.addEventListener("change", updateDepartments);
    } catch {
      universitySelect.replaceChildren(
        new Option("Universities could not be loaded", ""),
      );
      departmentSelect.replaceChildren(
        new Option("Choose a university first", ""),
      );
      universityNote.textContent =
        "University options could not be loaded. Reload the page to try again.";
      signupButton.disabled = true;
    }
  }

  function findAssociation(universityId, departmentId) {
    return universityDepartments.find(
      (option) =>
        option.universityId === universityId &&
        option.departmentId === departmentId,
    );
  }

  return { load, findAssociation };
}
