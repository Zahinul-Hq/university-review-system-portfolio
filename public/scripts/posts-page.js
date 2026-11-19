import { deleteJson, getJson, postJson } from "./shared/api.js";
import { setStatus } from "./shared/form-validation.js";

// State
let currentUser = null;
let activeTags = [];
let currentPage = 1;
const pageSize = 20;

// Elements
const headerUserStatus = document.querySelector("#header-user-status");
const composerDialog = document.querySelector("#composer-dialog");
const openComposerButton = document.querySelector("#open-composer");
const promptOpenComposer = document.querySelector("#prompt-open-composer");
const closeComposerButton = document.querySelector("#composer-dialog-close");
const composerForm = document.querySelector("#composer-form");
const composerUnauth = document.querySelector("#composer-unauth");
const composerAffiliationText = document.querySelector("#composer-affiliation-text");
const composerTagsContainer = document.querySelector("#composer-tags-container");
const postContentInput = document.querySelector("#post-content");
const charCounter = document.querySelector("#char-counter");
const composerSubmitBtn = document.querySelector("#composer-submit-btn");
const composerStatus = document.querySelector("#composer-status");

const filterUniversity = document.querySelector("#filter-university");
const filterSentiment = document.querySelector("#filter-sentiment");
const filterTag = document.querySelector("#filter-tag");
const filterSort = document.querySelector("#filter-sort");
const filterResetBtn = document.querySelector("#filter-reset-btn");

const feedCountHeading = document.querySelector("#feed-count-heading");
const feedActiveFilterText = document.querySelector("#feed-active-filter-text");
const feedStatus = document.querySelector("#feed-status");
const feedScoreBanner = document.querySelector("#feed-score-banner");
const feedScoreValue = document.querySelector("#feed-score-value");
const feedScoreDesc = document.querySelector("#feed-score-desc");
const feedScoreLink = document.querySelector("#feed-score-link");
const postsList = document.querySelector("#posts-list");
const paginationBar = document.querySelector("#pagination-bar");
const prevPageBtn = document.querySelector("#prev-page-btn");
const nextPageBtn = document.querySelector("#next-page-btn");
const paginationInfo = document.querySelector("#pagination-info");

const reportDialog = document.querySelector("#report-dialog");
const reportDialogClose = document.querySelector("#report-dialog-close");
const reportForm = document.querySelector("#report-form");
const reportPostIdInput = document.querySelector("#report-post-id");
const reportCancelBtn = document.querySelector("#report-cancel-btn");
const reportStatus = document.querySelector("#report-status");

function openComposerModal() {
  composerDialog.showModal();
  const firstComposerControl = composerForm.hidden
    ? composerUnauth.querySelector("a")
    : composerForm.querySelector("select");
  firstComposerControl?.focus();
}

openComposerButton.addEventListener("click", openComposerModal);
promptOpenComposer?.addEventListener("click", openComposerModal);

closeComposerButton.addEventListener("click", () => composerDialog.close());

// 1. Initial Session Check
async function checkSession() {
  try {
    const res = await getJson("/api/auth/me");
    if (res && res.user) {
      currentUser = res.user;
      renderAuthenticatedUser(res.user);
    } else {
      renderUnauthenticatedUser();
    }
  } catch {
    renderUnauthenticatedUser();
  }
}

function renderAuthenticatedUser(user) {
  headerUserStatus.innerHTML = `
    <div class="user-badge">
      <span>Signed in as</span>
      <strong>${escapeHtml(user.username)}</strong>
      ${user.role === "admin" ? `<a class="btn btn--primary btn--sm" href="./admin.html">Admin Panel</a>` : ""}
      <button class="btn btn--secondary btn--sm" id="logout-header-btn" type="button">Log out</button>
    </div>
  `;

  document.querySelector("#logout-header-btn")?.addEventListener("click", async () => {
    try {
      await postJson("/api/auth/logout", {});
      window.location.reload();
    } catch {
      window.location.reload();
    }
  });

  composerForm.hidden = false;
  composerUnauth.hidden = true;
}

function renderUnauthenticatedUser() {
  headerUserStatus.replaceChildren();
  composerForm.hidden = true;
  composerUnauth.hidden = false;
}

// 2. Load Filter Data & Affiliation
async function loadFilterOptions() {
  try {
    const [deptRes, tagsRes] = await Promise.all([
      getJson("/api/auth/university-departments"),
      getJson("/api/posts/tags"),
    ]);

    // Populate universities
    if (deptRes && Array.isArray(deptRes.universityDepartments)) {
      const uniqueUnis = new Map();
      for (const item of deptRes.universityDepartments) {
        if (!uniqueUnis.has(item.universityId)) {
          uniqueUnis.set(item.universityId, item.universityName);
        }

        // If user logged in, find their affiliation text
        if (currentUser && currentUser.universityDepartmentId === item.universityDepartmentId) {
          composerAffiliationText.textContent = `${item.universityName} • ${item.departmentName}`;
        }
      }

      filterUniversity.innerHTML = '<option value="">All universities</option>';
      for (const [id, name] of uniqueUnis) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        filterUniversity.appendChild(opt);
      }
    }

    // Populate tags
    if (tagsRes && Array.isArray(tagsRes.tags)) {
      activeTags = tagsRes.tags;
      filterTag.innerHTML = '<option value="">All topics</option>';
      composerTagsContainer.innerHTML = "";

      for (const tag of activeTags) {
        // Filter option
        const opt = document.createElement("option");
        opt.value = tag.tagId;
        opt.textContent = tag.name;
        filterTag.appendChild(opt);

        // Composer checkbox
        const label = document.createElement("label");
        label.className = "tag-checkbox-label";
        label.innerHTML = `
          <input type="checkbox" name="tags" value="${escapeHtml(tag.tagId)}">
          <span>#${escapeHtml(tag.name)}</span>
        `;
        composerTagsContainer.appendChild(label);
      }

      // Limit tag selections to max 3
      composerTagsContainer.addEventListener("change", () => {
        const checked = composerTagsContainer.querySelectorAll("input[type='checkbox']:checked");
        if (checked.length > 3) {
          const lastChecked = checked[checked.length - 1];
          if (lastChecked) lastChecked.checked = false;
        }
      });

      // Apply initial filters from URL query parameters if present
      const urlParams = new URLSearchParams(window.location.search);
      const urlUniId = urlParams.get("universityId");
      const urlTagId = urlParams.get("tagId");
      if (urlUniId && filterUniversity.querySelector(`option[value="${urlUniId}"]`)) {
        filterUniversity.value = urlUniId;
      }
      if (urlTagId && filterTag.querySelector(`option[value="${urlTagId}"]`)) {
        filterTag.value = urlTagId;
      }
    }
  } catch (err) {
    console.error("Failed to load filter options", err);
  }
}

async function updateUniversityScoreBanner(universityId) {
  if (!feedScoreBanner) return;
  if (!universityId) {
    feedScoreBanner.hidden = true;
    return;
  }

  try {
    const data = await getJson(`/api/scores/universities/${encodeURIComponent(universityId)}`);
    if (data && typeof data.overallRating === "number") {
      feedScoreBanner.hidden = false;
      feedScoreValue.textContent = `${data.overallRating.toFixed(1)} / 5`;
      const uniName = filterUniversity.options[filterUniversity.selectedIndex]?.text || "this university";
      const postsCount = data.totalPostCount || 0;
      feedScoreDesc.textContent = `Blended score for ${uniName} (${data.totalReviewCount} verified reviews, ${postsCount} community posts)`;
      feedScoreLink.href = `./university-reviews.html?universityId=${encodeURIComponent(universityId)}`;
    } else {
      feedScoreBanner.hidden = true;
    }
  } catch {
    feedScoreBanner.hidden = true;
  }
}

// 3. Load Posts Feed
async function loadFeed() {
  postsList.setAttribute("aria-busy", "true");
  feedStatus.textContent = "";
  delete feedStatus.dataset.state;
  updateFeedSummary();
  updateUniversityScoreBanner(filterUniversity.value);

  const params = new URLSearchParams({
    page: String(currentPage),
    limit: String(pageSize),
  });

  if (filterUniversity.value) params.set("universityId", filterUniversity.value);
  if (filterSentiment.value) params.set("sentiment", filterSentiment.value);
  if (filterTag.value) params.set("tagId", filterTag.value);
  if (filterSort.value) params.set("sort", filterSort.value);

  try {
    const data = await getJson(`/api/posts?${params.toString()}`);
    renderPosts(data.posts, data.pagination);
  } catch (error) {
    feedStatus.textContent = error.message;
    feedStatus.dataset.state = "error";
    postsList.innerHTML = "";
  } finally {
    postsList.removeAttribute("aria-busy");
  }
}

function updateFeedSummary() {
  const selectedFilters = [
    ["University", filterUniversity],
    ["Sentiment", filterSentiment],
    ["Topic", filterTag],
  ]
    .filter(([, control]) => control.value)
    .map(([label, control]) => {
      const selectedLabel = control.selectedOptions[0]?.textContent?.trim() ?? control.value;
      return `${label}: ${selectedLabel}`;
    });
  const selectedSort = filterSort.selectedOptions[0]?.textContent?.trim() ?? "Newest first";
  const filterSummary = selectedFilters.length
    ? `Filtered by ${selectedFilters.join(" · ")}`
    : "All reviews";

  feedActiveFilterText.textContent = `${filterSummary} · ${selectedSort.toLowerCase()}`;
}

function renderPosts(posts, pagination) {
  feedCountHeading.textContent = `Reviews (${pagination.total})`;

  if (!posts || posts.length === 0) {
    postsList.innerHTML = `
      <div class="feed-empty">
        <h3>No reviews found</h3>
        <p>No reviews match these filters. Try changing or clearing the filters.</p>
      </div>
    `;
    paginationBar.hidden = true;
    return;
  }

  postsList.innerHTML = "";
  for (const post of posts) {
    const card = document.createElement("article");
    card.className = "post-card";
    card.id = `post-${post.postId}`;

    const sentimentClass = `badge--sentiment-${post.sentiment}`;
    const sentimentLabel = post.sentiment.charAt(0).toUpperCase() + post.sentiment.slice(1);

    const verifiedBadge = post.authorVerified
      ? '<span class="badge badge--verified" title="Author university affiliation verified">✓ Verified Student</span>'
      : "";

    const tagsHtml = post.tags && post.tags.length > 0
      ? `<div class="post-card__tags">
          ${post.tags.map((t) => `<span class="tag-pill">#${escapeHtml(t.name)}</span>`).join("")}
        </div>`
      : "";

    const userVote = post.userVote;
    const upActiveClass = userVote === 1 ? "vote-btn--active-up" : "";
    const downActiveClass = userVote === -1 ? "vote-btn--active-down" : "";

    const deleteBtn = post.isAuthor
      ? `<button class="post-action-btn post-action-btn--delete" data-action="delete" data-post-id="${escapeHtml(post.postId)}" type="button">Delete</button>`
      : "";

    const formattedDate = formatDate(post.createdAt);

    const monogram = getMonogram(post.university.shortName || post.university.name);

    card.innerHTML = `
      <div class="post-card__avatar" aria-hidden="true">
        <span>${escapeHtml(monogram)}</span>
      </div>
      <div class="post-card__main">
        <header class="post-card__header">
          <div class="post-card__meta">
            <span class="post-card__uni">${escapeHtml(post.university.name)}</span>
            <span class="post-card__dept">@${escapeHtml(post.department.abbreviation || post.department.name)}</span>
            <span class="post-card__dot" aria-hidden="true">·</span>
            <time class="post-card__time" datetime="${escapeHtml(post.createdAt)}">${escapeHtml(formattedDate)}</time>
          </div>
          <div class="post-card__badges">
            ${verifiedBadge}
            <span class="badge ${sentimentClass}">${escapeHtml(sentimentLabel)}</span>
          </div>
        </header>

        <div class="post-card__content">${escapeHtml(post.content)}</div>

        ${tagsHtml}

        <footer class="post-card__footer">
          <div class="vote-widget" title="Votes directly factor into this university's category score">
            <button class="vote-btn vote-btn--up ${upActiveClass}" data-action="upvote" data-post-id="${escapeHtml(post.postId)}" type="button" aria-label="Upvote this review" aria-pressed="${userVote === 1}">
              <svg class="vote-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span class="vote-score" id="score-${escapeHtml(post.postId)}">${post.score}</span>
            <button class="vote-btn vote-btn--down ${downActiveClass}" data-action="downvote" data-post-id="${escapeHtml(post.postId)}" type="button" aria-label="Downvote this review" aria-pressed="${userVote === -1}">
              <svg class="vote-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          <div class="post-card__actions">
            <button class="post-action-btn post-action-btn--report" data-action="report" data-post-id="${escapeHtml(post.postId)}" type="button" aria-label="Report review">
              <svg class="action-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span>Report</span>
            </button>
            ${deleteBtn}
          </div>
        </footer>
      </div>
    `;

    postsList.appendChild(card);
  }

  // Update pagination bar
  if (pagination.totalPages > 1) {
    paginationBar.hidden = false;
    paginationInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    prevPageBtn.disabled = pagination.page <= 1;
    nextPageBtn.disabled = pagination.page >= pagination.totalPages;
  } else {
    paginationBar.hidden = true;
  }
}

// 4. Feed Event Delegation (Vote, Delete, Report)
postsList.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const postId = target.dataset.postId;
  if (!postId) return;

  if (action === "upvote" || action === "downvote") {
    if (!currentUser) {
      window.location.href = "./index.html";
      return;
    }

    const isUpvote = action === "upvote";
    const currentPressed = target.getAttribute("aria-pressed") === "true";
    const newVoteType = currentPressed ? 0 : (isUpvote ? 1 : -1);

    target.disabled = true;
    try {
      const summary = await postJson(`/api/posts/${postId}/vote`, {
        voteType: newVoteType,
      });

      // Update score display
      const scoreElem = document.querySelector(`#score-${postId}`);
      if (scoreElem) scoreElem.textContent = String(summary.score);

      // Update button active states
      const card = document.querySelector(`#post-${postId}`);
      if (card) {
        const upBtn = card.querySelector('[data-action="upvote"]');
        const downBtn = card.querySelector('[data-action="downvote"]');
        if (upBtn) {
          upBtn.classList.toggle("vote-btn--active-up", summary.userVote === 1);
          upBtn.setAttribute("aria-pressed", String(summary.userVote === 1));
        }
        if (downBtn) {
          downBtn.classList.toggle("vote-btn--active-down", summary.userVote === -1);
          downBtn.setAttribute("aria-pressed", String(summary.userVote === -1));
        }
      }
    } catch (error) {
      feedStatus.textContent = error.message;
      feedStatus.dataset.state = "error";
    } finally {
      target.disabled = false;
    }
    return;
  }

  if (action === "delete") {
    if (!confirm("Are you sure you want to permanently delete your review?")) return;
    target.disabled = true;
    try {
      await deleteJson(`/api/posts/${postId}`);
      const card = document.querySelector(`#post-${postId}`);
      card?.remove();
      loadFeed();
    } catch (error) {
      feedStatus.textContent = error.message;
      feedStatus.dataset.state = "error";
      target.disabled = false;
    }
    return;
  }

  if (action === "report") {
    if (!currentUser) {
      window.location.href = "./index.html";
      return;
    }
    reportPostIdInput.value = postId;
    reportForm.reset();
    reportStatus.textContent = "";
    delete reportStatus.dataset.state;
    reportDialog.showModal();
    return;
  }
});

// 5. Composer Form
postContentInput.addEventListener("input", () => {
  const count = postContentInput.value.length;
  charCounter.textContent = `${count} / 2000`;
  if (count > 2000) {
    charCounter.style.color = "#c92a2a";
  } else {
    charCounter.style.color = "var(--p-muted)";
  }
});

composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = postContentInput.value.trim();
  const sentiment = composerForm.elements.sentiment.value;

  if (content.length < 10) {
    setStatus(composerForm, "Review must be at least 10 characters long.", "error");
    return;
  }

  const selectedTags = Array.from(
    composerForm.querySelectorAll("input[name='tags']:checked"),
  ).map((cb) => cb.value);

  composerSubmitBtn.disabled = true;
  setStatus(composerForm, "Publishing your review.");

  try {
    await postJson("/api/posts", {
      content,
      sentiment,
      tagIds: selectedTags,
    });

    setStatus(composerForm, "Review published successfully!", "success");
    composerForm.reset();
    charCounter.textContent = "0 / 2000";
    setTimeout(() => {
      composerStatus.textContent = "";
    }, 4000);
    currentPage = 1;
    loadFeed();
  } catch (error) {
    setStatus(composerForm, error.message, "error");
  } finally {
    composerSubmitBtn.disabled = false;
  }
});

// 6. Filter Controls
for (const control of [filterUniversity, filterSentiment, filterTag, filterSort]) {
  control.addEventListener("change", () => {
    currentPage = 1;
    loadFeed();
  });
}

filterResetBtn.addEventListener("click", () => {
  filterUniversity.value = "";
  filterSentiment.value = "";
  filterTag.value = "";
  filterSort.value = "newest";
  currentPage = 1;
  loadFeed();
});

// 7. Pagination
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadFeed();
    document.querySelector("#feed-header")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
});

nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  loadFeed();
  document.querySelector("#feed-header")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

// 8. Report Modal
reportDialogClose.addEventListener("click", () => reportDialog.close());
reportCancelBtn.addEventListener("click", () => reportDialog.close());

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const postId = reportPostIdInput.value;
  const reason = reportForm.elements.reason.value;
  const description = reportForm.elements.description.value.trim();

  const submitBtn = document.querySelector("#report-submit-btn");
  submitBtn.disabled = true;
  reportStatus.textContent = "Submitting report...";

  try {
    const res = await postJson(`/api/posts/${postId}/report`, {
      reason,
      description: description || undefined,
    });
    reportStatus.textContent = res.message;
    reportStatus.dataset.state = "success";
    setTimeout(() => {
      reportDialog.close();
    }, 1500);
  } catch (error) {
    reportStatus.textContent = error.message;
    reportStatus.dataset.state = "error";
  } finally {
    submitBtn.disabled = false;
  }
});

// Utility helpers
function getMonogram(name) {
  if (!name) return "U";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
    if (diffSeconds < 86400 * 7) return `${Math.floor(diffSeconds / 86400)}d`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

// Initialize
async function init() {
  await checkSession();
  await loadFilterOptions();
  await loadFeed();
}

init();
