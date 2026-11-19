const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "";

function resolveUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return API_BASE ? `${API_BASE.replace(/\/$/, "")}${path}` : path;
}

const credentialsMode = API_BASE ? "include" : "same-origin";

export async function postJson(
  path,
  data,
  fallbackError = "The request could not be completed.",
) {
  const response = await fetch(resolveUrl(path), {
    method: "POST",
    credentials: credentialsMode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || fallbackError);
  }

  return result;
}

export async function getJson(
  path,
  fallbackError = "The request could not be completed.",
) {
  const response = await fetch(resolveUrl(path), {
    method: "GET",
    credentials: credentialsMode,
    headers: { Accept: "application/json" },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || fallbackError);
  }

  return result;
}

export async function patchJson(
  path,
  data,
  fallbackError = "The request could not be completed.",
) {
  const response = await fetch(resolveUrl(path), {
    method: "PATCH",
    credentials: credentialsMode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || fallbackError);
  }

  return result;
}

export async function deleteJson(
  path,
  fallbackError = "The request could not be completed.",
) {
  const response = await fetch(resolveUrl(path), {
    method: "DELETE",
    credentials: credentialsMode,
    headers: { Accept: "application/json" },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || fallbackError);
  }

  return result;
}
