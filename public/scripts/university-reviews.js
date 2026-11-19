import { getJson } from "./shared/api.js";

const main = document.querySelector("#university-results-main");
const resultsStatus = document.querySelector("#university-results-status");
const resultsRetry = document.querySelector("#university-results-retry");
const universityList = document.querySelector("#university-list");
const detail = document.querySelector("#university-detail");
const detailShortName = document.querySelector("#university-detail-short-name");
const detailTitle = document.querySelector("#university-detail-title");
const overallScore = document.querySelector("#university-overall-score");
const raterCount = document.querySelector("#university-rater-count");
const detailStatus = document.querySelector("#university-detail-status");
const detailRetry = document.querySelector("#university-detail-retry");
const averagesList = document.querySelector("#university-averages");
const selectedUniversityId = new URLSearchParams(window.location.search).get(
  "universityId",
);

function isUniversitySummary(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.universityId === "string" &&
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    (value.averageRating === null ||
      (typeof value.averageRating === "number" &&
        Number.isFinite(value.averageRating))) &&
    Number.isInteger(value.reviewCount) &&
    value.reviewCount >= 0
  );
}

function isCategoryAverage(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.tagId === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    (value.averageRating === null ||
      (typeof value.averageRating === "number" &&
        Number.isFinite(value.averageRating))) &&
    Number.isInteger(value.reviewCount) &&
    value.reviewCount >= 0
  );
}

function formatAverage(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(1)
    : "—";
}

function formatRaterCount(count) {
  return `${count} student ${count === 1 ? "rating" : "ratings"}`;
}

function setStatus(element, message, state = "") {
  element.textContent = message;
  if (state) {
    element.dataset.state = state;
  } else {
    delete element.dataset.state;
  }
}

function renderUniversityList(universities) {
  universityList.replaceChildren();

  for (const university of universities) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.className = "university-rating-card";
    link.href = `./university-reviews.html?universityId=${encodeURIComponent(
      university.universityId,
    )}`;
    link.setAttribute(
      "aria-label",
      `${university.name}, ${formatAverage(university.averageRating)} out of 5, ${formatRaterCount(university.reviewCount)}`,
    );

    if (university.universityId === selectedUniversityId) {
      link.setAttribute("aria-current", "true");
    }

    const name = document.createElement("span");
    name.className = "university-rating-card__name";
    name.textContent = university.name;

    const score = document.createElement("span");
    score.className = "university-rating-card__score";
    score.textContent = formatAverage(university.averageRating);

    const count = document.createElement("span");
    count.className = "university-rating-card__count";
    count.textContent = formatRaterCount(university.reviewCount);

    link.append(name, score, count);
    listItem.append(link);
    universityList.append(listItem);
  }
}

function renderCategoryAverages(tags) {
  averagesList.replaceChildren();

  if (tags.length === 0) {
    setStatus(detailStatus, "There are no active review categories.");
    return;
  }

  setStatus(detailStatus, "");

  for (const tag of tags) {
    const item = document.createElement("article");
    item.className = "average-item";

    const heading = document.createElement("div");
    heading.className = "average-item__head";

    const name = document.createElement("h4");
    name.className = "average-item__name";
    name.textContent = tag.name;

    const score = document.createElement("span");
    score.className = "average-item__score";
    score.textContent = formatAverage(tag.averageRating);
    heading.append(name, score);

    const description = document.createElement("p");
    description.className = "average-item__description";
    description.textContent = tag.description;

    const bar = document.createElement("div");
    bar.className = "average-item__bar";
    bar.setAttribute("aria-hidden", "true");

    const fill = document.createElement("div");
    fill.className = "average-item__fill";
    const average =
      typeof tag.averageRating === "number" ? tag.averageRating : 0;
    fill.style.width = `${Math.max(0, Math.min(100, (average / 5) * 100))}%`;
    bar.append(fill);

    const count = document.createElement("p");
    count.className = "average-item__count";
    if (tag.postCount && tag.postCount > 0) {
      count.textContent = `${formatRaterCount(tag.reviewCount)} • ${tag.postCount} community ${tag.postCount === 1 ? "post" : "posts"} factored in`;
    } else {
      count.textContent = formatRaterCount(tag.reviewCount);
    }

    item.append(heading, description, bar, count);

    if (tag.postCount && tag.postCount > 0 && selectedUniversityId) {
      const postLink = document.createElement("a");
      postLink.className = "average-item__post-link";
      postLink.href = `./posts.html?universityId=${encodeURIComponent(selectedUniversityId)}&tagId=${encodeURIComponent(tag.tagId)}`;
      postLink.textContent = `Read ${tag.postCount} ${tag.name} ${tag.postCount === 1 ? "review" : "reviews"} →`;
      item.append(postLink);
    }

    averagesList.append(item);
  }
}

async function loadUniversityDetails(university) {
  detail.hidden = false;
  detail.setAttribute("aria-busy", "true");
  detailTitle.textContent = university.name;
  detailShortName.textContent = university.shortName;
  overallScore.textContent = formatAverage(university.averageRating);
  raterCount.textContent = formatRaterCount(university.reviewCount);
  averagesList.replaceChildren();
  detailRetry.hidden = true;
  setStatus(detailStatus, "Loading category averages.");

  try {
    let result;
    try {
      result = await getJson(
        `/api/scores/universities/${encodeURIComponent(university.universityId)}`,
      );
    } catch {
      result = await getJson(
        `/api/reviews/universities/${encodeURIComponent(university.universityId)}`,
      );
    }

    if (!Array.isArray(result.tags) || !result.tags.every(isCategoryAverage)) {
      throw new Error("Category averages could not be loaded.");
    }

    if (result.overallRating !== undefined && result.overallRating !== null) {
      overallScore.textContent = formatAverage(result.overallRating);
    }
    if (result.totalReviewCount !== undefined) {
      const postsInfo =
        result.totalPostCount > 0
          ? ` • ${result.totalPostCount} community posts factored in`
          : "";
      raterCount.textContent = `${formatRaterCount(result.totalReviewCount)}${postsInfo}`;
    }

    renderCategoryAverages(result.tags);
  } catch (error) {
    setStatus(
      detailStatus,
      error instanceof Error
        ? error.message
        : "Category averages could not be loaded.",
      "error",
    );
    detailRetry.hidden = false;
  } finally {
    detail.setAttribute("aria-busy", "false");
  }
}

async function loadUniversityRatings() {
  resultsRetry.hidden = true;
  setStatus(resultsStatus, "Loading university ratings.");
  universityList.replaceChildren();
  main.classList.toggle("has-selection", Boolean(selectedUniversityId));

  try {
    const result = await getJson("/api/reviews/universities");
    if (
      !Array.isArray(result.universities) ||
      !result.universities.every(isUniversitySummary)
    ) {
      throw new Error("University ratings could not be loaded.");
    }

    const universities = result.universities;
    renderUniversityList(universities);

    if (universities.length === 0) {
      setStatus(resultsStatus, "There are no universities to show yet.");
      return;
    }

    setStatus(resultsStatus, "");
    if (selectedUniversityId) {
      const selectedUniversity = universities.find(
        (university) => university.universityId === selectedUniversityId,
      );
      if (selectedUniversity) {
        await loadUniversityDetails(selectedUniversity);
      } else {
        detail.hidden = false;
        detail.setAttribute("aria-busy", "false");
        detailTitle.textContent = "University not found";
        detailShortName.textContent = "";
        overallScore.textContent = "—";
        raterCount.textContent = "";
        setStatus(detailStatus, "This university is not available.", "error");
      }
    }
  } catch (error) {
    setStatus(
      resultsStatus,
      error instanceof Error
        ? error.message
        : "University ratings could not be loaded.",
      "error",
    );
    resultsRetry.hidden = false;
  }
}

resultsRetry.addEventListener("click", loadUniversityRatings);
detailRetry.addEventListener("click", loadUniversityRatings);

loadUniversityRatings();
