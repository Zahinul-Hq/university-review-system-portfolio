import { deleteJson, getJson, patchJson, postJson } from "./shared/api.js";

// Global state
const state = {
  currentUser: null,
  reports: { page: 1, limit: 20, status: "pending", totalPages: 1 },
  posts: { page: 1, limit: 20, status: "", sentiment: "", search: "", totalPages: 1 },
  users: { page: 1, limit: 20, search: "", isVerified: "", role: "", totalPages: 1 },
};

document.addEventListener("DOMContentLoaded", initAdminPage);

async function initAdminPage() {
  setupTabs();
  setupModals();
  setupRefreshButtons();

  const isAuthed = await checkAdminAuth();
  if (!isAuthed) return;

  await loadMetrics();
  await loadReports();
}

async function checkAdminAuth() {
  const userStatusEl = document.getElementById("header-user-status");
  const unauthEl = document.getElementById("admin-unauth");
  const workspaceEl = document.getElementById("admin-workspace");
  const unauthMsg = document.getElementById("unauth-message");

  try {
    const res = await getJson("/api/auth/me");
    const user = res.user || res;
    state.currentUser = user;

    if (!user || user.role !== "admin") {
      unauthMsg.textContent = `You are signed in as @${user.username}, but administrative privileges are required.`;
      unauthEl.hidden = false;
      workspaceEl.hidden = true;
      userStatusEl.innerHTML = `
        <span class="user-pill">@${escapeHtml(user.username)} (Student)</span>
        <button type="button" class="btn btn--secondary btn--sm" id="btn-signout">Sign out</button>
      `;
      document.getElementById("btn-signout")?.addEventListener("click", handleSignOut);
      return false;
    }

    // Authenticated as Admin
    unauthEl.hidden = true;
    workspaceEl.hidden = false;
    userStatusEl.innerHTML = `
      <span class="user-pill">@${escapeHtml(user.username)} <span class="badge badge--admin">Admin</span></span>
      <button type="button" class="btn btn--secondary btn--sm" id="btn-signout">Sign out</button>
    `;
    document.getElementById("btn-signout")?.addEventListener("click", handleSignOut);
    return true;
  } catch (_error) {
    unauthMsg.textContent = "Please sign in with an administrator account to access the Chirpy control panel.";
    unauthEl.hidden = false;
    workspaceEl.hidden = true;
    userStatusEl.innerHTML = `
      <a class="btn btn--secondary btn--sm" href="./index.html">Sign in</a>
    `;
    return false;
  }
}

async function handleSignOut() {
  try {
    await postJson("/api/auth/logout", {});
    window.location.href = "./index.html";
  } catch (error) {
    showToast(error.message, true);
  }
}

// -------------------------------------------------------------
// Tabs Switching
// -------------------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const panelId = tab.getAttribute("aria-controls");
      switchTab(tab, panelId);
    });
  });
}

function switchTab(activeTab, panelId) {
  const tabs = document.querySelectorAll(".admin-tab");
  const panels = document.querySelectorAll(".admin-panel");

  tabs.forEach((t) => {
    t.classList.remove("admin-tab--active");
    t.setAttribute("aria-selected", "false");
  });
  panels.forEach((p) => {
    p.hidden = true;
  });

  activeTab.classList.add("admin-tab--active");
  activeTab.setAttribute("aria-selected", "true");

  const targetPanel = document.getElementById(panelId);
  if (targetPanel) {
    targetPanel.hidden = false;
  }

  // Trigger data load on switch
  if (panelId === "panel-reports") loadReports();
  if (panelId === "panel-posts") loadPosts();
  if (panelId === "panel-users") loadUsers();
  if (panelId === "panel-catalog") loadCatalog();
  if (panelId === "panel-tags") loadTags();
}

// -------------------------------------------------------------
// Metrics
// -------------------------------------------------------------
async function loadMetrics() {
  try {
    const data = await getJson("/api/admin/metrics");
    document.getElementById("kpi-total-users").textContent = data.totalUsers.toLocaleString();
    document.getElementById("kpi-verified-sub").textContent = `${data.verifiedStudents.toLocaleString()} verified students`;

    document.getElementById("kpi-total-reviews").textContent = data.totalReviews.toLocaleString();
    document.getElementById("kpi-reviews-sub").textContent = `${data.publishedReviews.toLocaleString()} published, ${data.hiddenReviews.toLocaleString()} hidden`;

    const pendingEl = document.getElementById("kpi-pending-reports");
    pendingEl.textContent = data.pendingReports.toLocaleString();
    const reportsCard = document.getElementById("kpi-reports-card");
    if (data.pendingReports > 0) {
      reportsCard.classList.add("kpi-card--alert");
    } else {
      reportsCard.classList.remove("kpi-card--alert");
    }

    const badge = document.getElementById("reports-tab-badge");
    badge.textContent = data.pendingReports;
    badge.dataset.count = data.pendingReports;

    document.getElementById("kpi-universities").textContent = data.totalUniversities.toLocaleString();
    document.getElementById("kpi-catalog-sub").textContent = `${data.totalDepartments.toLocaleString()} departments`;

    document.getElementById("kpi-tags").textContent = data.totalTags.toLocaleString();
  } catch (error) {
    console.error("Failed to load metrics:", error);
  }
}

// -------------------------------------------------------------
// Reports Queue
// -------------------------------------------------------------
async function loadReports() {
  const loading = document.getElementById("reports-loading");
  const table = document.getElementById("reports-table");
  const tbody = document.getElementById("reports-tbody");
  const empty = document.getElementById("reports-empty");
  const pagination = document.getElementById("reports-pagination");

  loading.hidden = false;
  table.hidden = true;
  empty.hidden = true;
  pagination.hidden = true;

  try {
    const status = state.reports.status;
    const url = `/api/admin/reports?page=${state.reports.page}&limit=${state.reports.limit}${status ? `&status=${status}` : ""}`;
    const data = await getJson(url);

    loading.hidden = true;

    if (!data.reports || data.reports.length === 0) {
      empty.hidden = false;
      return;
    }

    table.hidden = false;
    pagination.hidden = false;
    state.reports.totalPages = data.totalPages;

    document.getElementById("reports-page-info").textContent = `Page ${data.page} of ${data.totalPages} (${data.total} reports)`;
    document.getElementById("reports-prev-page").disabled = data.page <= 1;
    document.getElementById("reports-next-page").disabled = data.page >= data.totalPages;

    tbody.innerHTML = data.reports.map((r) => `
      <tr>
        <td>
          <div class="content-preview" title="${escapeHtml(r.postContent)}">
            ${escapeHtml(r.postContent)}
          </div>
          <div class="author-info" style="margin-top: 4px;">
            <span>${escapeHtml(r.authorUniversityName)} · ${escapeHtml(r.authorDepartmentName)}</span>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(r.reason)}</strong>
          ${r.description ? `<p style="font-size:12px;color:var(--p-muted);margin-top:2px;">${escapeHtml(r.description)}</p>` : ""}
        </td>
        <td>
          <span style="font-weight:500;">@${escapeHtml(r.reporterUsername)}</span>
        </td>
        <td style="white-space:nowrap;color:var(--p-muted);">
          ${formatDate(r.createdAt)}
        </td>
        <td>
          <span class="badge badge--${escapeHtml(r.status)}">${escapeHtml(r.status)}</span>
        </td>
        <td>
          <div class="action-group">
            ${r.status === "pending" ? `
              <button type="button" class="btn-table-action" data-action="dismiss-report" data-id="${r.reportId}">Dismiss</button>
              <button type="button" class="btn-table-action btn-table-action--danger" data-action="hide-reported-post" data-report-id="${r.reportId}" data-post-id="${r.postId}">Hide Review</button>
              <button type="button" class="btn-table-action btn-table-action--danger" data-action="delete-reported-post" data-report-id="${r.reportId}" data-post-id="${r.postId}">Delete</button>
            ` : `
              <span style="font-size:12px;color:var(--p-muted);">Resolved</span>
            `}
          </div>
        </td>
      </tr>
    `).join("");

    attachReportActionListeners(tbody);
  } catch (error) {
    loading.hidden = true;
    showToast(error.message, true);
  }
}

function attachReportActionListeners(tbody) {
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const reportId = btn.dataset.id || btn.dataset.reportId;
      const postId = btn.dataset.postId;

      if (action === "dismiss-report") {
        try {
          await patchJson(`/api/admin/reports/${reportId}`, { status: "dismissed" });
          showToast("Report dismissed");
          loadReports();
          loadMetrics();
        } catch (err) {
          showToast(err.message, true);
        }
      } else if (action === "hide-reported-post") {
        confirmAction("Hide Reported Review", "Are you sure you want to hide this review from public view?", async () => {
          try {
            await patchJson(`/api/admin/posts/${postId}/status`, { status: "hidden" });
            await patchJson(`/api/admin/reports/${reportId}`, { status: "actioned" });
            showToast("Review hidden and report actioned");
            loadReports();
            loadMetrics();
          } catch (err) {
            showToast(err.message, true);
          }
        });
      } else if (action === "delete-reported-post") {
        confirmAction("Permanently Delete Review", "This cannot be undone. All votes, tags, and reports for this review will be removed.", async () => {
          try {
            await deleteJson(`/api/admin/posts/${postId}`);
            showToast("Review deleted permanently");
            loadReports();
            loadMetrics();
          } catch (err) {
            showToast(err.message, true);
          }
        });
      }
    });
  });
}

// -------------------------------------------------------------
// Reviews & Posts Moderation
// -------------------------------------------------------------
async function loadPosts() {
  const loading = document.getElementById("posts-loading");
  const table = document.getElementById("posts-table");
  const tbody = document.getElementById("posts-tbody");
  const empty = document.getElementById("posts-empty");
  const pagination = document.getElementById("posts-pagination");

  loading.hidden = false;
  table.hidden = true;
  empty.hidden = true;
  pagination.hidden = true;

  try {
    const { page, limit, status, sentiment, search } = state.posts;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set("status", status);
    if (sentiment) params.set("sentiment", sentiment);
    if (search) params.set("search", search);

    const data = await getJson(`/api/admin/posts?${params.toString()}`);

    loading.hidden = true;

    if (!data.posts || data.posts.length === 0) {
      empty.hidden = false;
      return;
    }

    table.hidden = false;
    pagination.hidden = false;
    state.posts.totalPages = data.totalPages;

    document.getElementById("posts-page-info").textContent = `Page ${data.page} of ${data.totalPages} (${data.total} reviews)`;
    document.getElementById("posts-prev-page").disabled = data.page <= 1;
    document.getElementById("posts-next-page").disabled = data.page >= data.totalPages;

    tbody.innerHTML = data.posts.map((p) => `
      <tr>
        <td>
          <div class="content-preview" title="${escapeHtml(p.content)}">
            ${escapeHtml(p.content)}
          </div>
          <span style="font-size:11px;color:var(--p-muted);">${formatDate(p.createdAt)}</span>
        </td>
        <td>
          <div class="author-info">
            <strong>@${escapeHtml(p.authorUsername)} ${p.authorVerified ? '✓' : ''}</strong>
            <span>${escapeHtml(p.authorUniversityName)} · ${escapeHtml(p.authorDepartmentName)}</span>
          </div>
        </td>
        <td>
          <span class="badge badge--${escapeHtml(p.sentiment)}">${escapeHtml(p.sentiment)}</span>
        </td>
        <td style="white-space:nowrap;">
          <strong>${p.score > 0 ? `+${p.score}` : p.score}</strong>
          <span style="color:var(--p-muted);font-size:11px;">(${p.upvotes}↑ / ${p.downvotes}↓)</span>
        </td>
        <td>
          ${p.reportsCount > 0 ? `<span class="badge badge--hidden">${p.reportsCount} reported</span>` : `<span style="color:var(--p-muted);">0</span>`}
        </td>
        <td>
          <span class="badge badge--${escapeHtml(p.status)}">${escapeHtml(p.status)}</span>
        </td>
        <td>
          <div class="action-group">
            ${p.status === "published" ? `
              <button type="button" class="btn-table-action" data-action="toggle-post-status" data-id="${p.postId}" data-target-status="hidden">Hide</button>
            ` : `
              <button type="button" class="btn-table-action btn-table-action--success" data-action="toggle-post-status" data-id="${p.postId}" data-target-status="published">Publish</button>
            `}
            <button type="button" class="btn-table-action btn-table-action--danger" data-action="delete-post" data-id="${p.postId}">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");

    attachPostActionListeners(tbody);
  } catch (error) {
    loading.hidden = true;
    showToast(error.message, true);
  }
}

function attachPostActionListeners(tbody) {
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const postId = btn.dataset.id;

      if (action === "toggle-post-status") {
        const targetStatus = btn.dataset.targetStatus;
        patchJson(`/api/admin/posts/${postId}/status`, { status: targetStatus })
          .then(() => {
            showToast(`Review marked as ${targetStatus}`);
            loadPosts();
            loadMetrics();
          })
          .catch((err) => showToast(err.message, true));
      } else if (action === "delete-post") {
        confirmAction("Delete Review Permanently", "Are you sure you want to permanently delete this review?", async () => {
          try {
            await deleteJson(`/api/admin/posts/${postId}`);
            showToast("Review deleted successfully");
            loadPosts();
            loadMetrics();
          } catch (err) {
            showToast(err.message, true);
          }
        });
      }
    });
  });
}

// -------------------------------------------------------------
// Student & User Management
// -------------------------------------------------------------
async function loadUsers() {
  const loading = document.getElementById("users-loading");
  const table = document.getElementById("users-table");
  const tbody = document.getElementById("users-tbody");
  const empty = document.getElementById("users-empty");
  const pagination = document.getElementById("users-pagination");

  loading.hidden = false;
  table.hidden = true;
  empty.hidden = true;
  pagination.hidden = true;

  try {
    const { page, limit, search, isVerified, role } = state.users;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (isVerified !== "") params.set("isVerified", String(isVerified));
    if (role) params.set("role", role);

    const data = await getJson(`/api/admin/users?${params.toString()}`);

    loading.hidden = true;

    if (!data.users || data.users.length === 0) {
      empty.hidden = false;
      return;
    }

    table.hidden = false;
    pagination.hidden = false;
    state.users.totalPages = data.totalPages;

    document.getElementById("users-page-info").textContent = `Page ${data.page} of ${data.totalPages} (${data.total} users)`;
    document.getElementById("users-prev-page").disabled = data.page <= 1;
    document.getElementById("users-next-page").disabled = data.page >= data.totalPages;

    tbody.innerHTML = data.users.map((u) => `
      <tr>
        <td>
          <div class="author-info">
            <strong>@${escapeHtml(u.username)}</strong>
            <span>${escapeHtml(u.emailAddress)}</span>
            ${u.eduMailAddress ? `<span style="color:#0284c7;">${escapeHtml(u.eduMailAddress)}</span>` : ""}
          </div>
        </td>
        <td>
          <div class="author-info">
            <span>${escapeHtml(u.universityName)}</span>
            <span style="color:var(--p-muted);">${escapeHtml(u.departmentName)}</span>
          </div>
        </td>
        <td>
          ${u.emailVerifiedAt ? `<span class="badge badge--positive">Verified</span>` : `<span class="badge badge--neutral">Pending</span>`}
        </td>
        <td>
          ${u.isVerified ? `
            <span class="badge badge--verified">Affiliation Verified</span>
          ` : `
            <span class="badge badge--neutral">Unverified</span>
          `}
        </td>
        <td>
          <span class="badge badge--${escapeHtml(u.role)}">${escapeHtml(u.role)}</span>
        </td>
        <td style="text-align:center;">
          ${u.postCount}
        </td>
        <td>
          <div class="action-group">
            ${u.isVerified ? `
              <button type="button" class="btn-table-action" data-action="toggle-user-verification" data-id="${u.userId}" data-target="false">Unverify</button>
            ` : `
              <button type="button" class="btn-table-action btn-table-action--success" data-action="toggle-user-verification" data-id="${u.userId}" data-target="true">Verify Affiliation</button>
            `}

            ${u.userId !== state.currentUser?.userId ? (
              u.role === "admin" ? `
                <button type="button" class="btn-table-action btn-table-action--danger" data-action="toggle-user-role" data-id="${u.userId}" data-target-role="user">Demote</button>
              ` : `
                <button type="button" class="btn-table-action" data-action="toggle-user-role" data-id="${u.userId}" data-target-role="admin">Make Admin</button>
              `
            ) : `<span style="font-size:11px;color:var(--p-muted);">(You)</span>`}
          </div>
        </td>
      </tr>
    `).join("");

    attachUserActionListeners(tbody);
  } catch (error) {
    loading.hidden = true;
    showToast(error.message, true);
  }
}

function attachUserActionListeners(tbody) {
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const userId = btn.dataset.id;

      if (action === "toggle-user-verification") {
        const isVerified = btn.dataset.target === "true";
        patchJson(`/api/admin/users/${userId}/verification`, { isVerified })
          .then((res) => {
            showToast(res.message);
            loadUsers();
            loadMetrics();
          })
          .catch((err) => showToast(err.message, true));
      } else if (action === "toggle-user-role") {
        const newRole = btn.dataset.targetRole;
        confirmAction(
          newRole === "admin" ? "Promote User to Admin" : "Demote Admin to User",
          `Are you sure you want to change this user's role to ${newRole}?`,
          async () => {
            try {
              const res = await patchJson(`/api/admin/users/${userId}/role`, { role: newRole });
              showToast(res.message);
              loadUsers();
            } catch (err) {
              showToast(err.message, true);
            }
          }
        );
      }
    });
  });
}

// -------------------------------------------------------------
// Academic Catalog (Universities & Departments)
// -------------------------------------------------------------
async function loadCatalog() {
  await Promise.all([loadUniversities(), loadDepartments()]);
}

async function loadUniversities() {
  const container = document.getElementById("universities-list");
  try {
    const data = await getJson("/api/admin/universities");
    if (!data.universities || data.universities.length === 0) {
      container.innerHTML = `<p class="admin-empty">No universities configured.</p>`;
      return;
    }

    container.innerHTML = data.universities.map((u) => `
      <div class="catalog-item">
        <div class="catalog-item__details">
          <h4>${escapeHtml(u.name)}</h4>
          <p>Acronym: <strong>${escapeHtml(u.shortName)}</strong> · ${u.departmentsCount ?? 0} active departments</p>
        </div>
        <button type="button" class="btn-table-action" data-edit-uni='${JSON.stringify(u)}'>Edit</button>
      </div>
    `).join("");

    container.querySelectorAll("[data-edit-uni]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = JSON.parse(btn.dataset.editUni);
        openUniversityModal(u);
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="dialog-error">${escapeHtml(error.message)}</p>`;
  }
}

async function loadDepartments() {
  const container = document.getElementById("departments-list");
  try {
    const data = await getJson("/api/admin/departments");
    if (!data.departments || data.departments.length === 0) {
      container.innerHTML = `<p class="admin-empty">No departments configured.</p>`;
      return;
    }

    container.innerHTML = data.departments.map((d) => `
      <div class="catalog-item">
        <div class="catalog-item__details">
          <h4>${escapeHtml(d.name)}</h4>
          <p>Abbreviation: <strong>${escapeHtml(d.abbreviation)}</strong> · Type: ${escapeHtml(d.departmentType)}</p>
        </div>
        <button type="button" class="btn-table-action" data-edit-dept='${JSON.stringify(d)}'>Edit</button>
      </div>
    `).join("");

    container.querySelectorAll("[data-edit-dept]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = JSON.parse(btn.dataset.editDept);
        openDepartmentModal(d);
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="dialog-error">${escapeHtml(error.message)}</p>`;
  }
}

// -------------------------------------------------------------
// Review Tags
// -------------------------------------------------------------
async function loadTags() {
  const loading = document.getElementById("tags-loading");
  const table = document.getElementById("tags-table");
  const tbody = document.getElementById("tags-tbody");

  loading.hidden = false;
  table.hidden = true;

  try {
    const data = await getJson("/api/admin/tags");
    loading.hidden = true;
    table.hidden = false;

    tbody.innerHTML = data.tags.map((t) => `
      <tr>
        <td style="font-weight:600;width:80px;text-align:center;">#${t.displayOrder}</td>
        <td><strong>${escapeHtml(t.name)}</strong></td>
        <td>${escapeHtml(t.description)}</td>
        <td>
          ${t.isActive ? `<span class="badge badge--active">Active</span>` : `<span class="badge badge--neutral">Inactive</span>`}
        </td>
        <td>
          <div class="action-group">
            <button type="button" class="btn-table-action" data-edit-tag='${JSON.stringify(t)}'>Edit</button>
            <button type="button" class="btn-table-action" data-toggle-tag-active="${t.tagId}" data-current-active="${t.isActive}">
              ${t.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-edit-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = JSON.parse(btn.dataset.editTag);
        openTagModal(tag);
      });
    });

    tbody.querySelectorAll("[data-toggle-tag-active]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tagId = btn.dataset.toggleTagActive;
        const currentActive = btn.dataset.currentActive === "true";
        try {
          await patchJson(`/api/admin/tags/${tagId}`, { isActive: !currentActive });
          showToast(`Tag ${currentActive ? "deactivated" : "activated"}`);
          loadTags();
          loadMetrics();
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });
  } catch (error) {
    loading.hidden = true;
    showToast(error.message, true);
  }
}

// -------------------------------------------------------------
// Modals & Dialog Management
// -------------------------------------------------------------
function setupModals() {
  // Confirm Dialog
  const confirmDialog = document.getElementById("admin-confirm-dialog");
  document.getElementById("confirm-cancel-btn").addEventListener("click", () => confirmDialog.close());

  // University Dialog
  const uniDialog = document.getElementById("admin-uni-dialog");
  const uniForm = document.getElementById("uni-form");
  document.getElementById("btn-add-university").addEventListener("click", () => openUniversityModal());
  document.getElementById("uni-cancel-btn").addEventListener("click", () => uniDialog.close());
  uniForm.addEventListener("submit", handleUniversitySubmit);

  // Department Dialog
  const deptDialog = document.getElementById("admin-dept-dialog");
  const deptForm = document.getElementById("dept-form");
  document.getElementById("btn-add-department").addEventListener("click", () => openDepartmentModal());
  document.getElementById("dept-cancel-btn").addEventListener("click", () => deptDialog.close());
  deptForm.addEventListener("submit", handleDepartmentSubmit);

  // Tag Dialog
  const tagDialog = document.getElementById("admin-tag-dialog");
  const tagForm = document.getElementById("tag-form");
  document.getElementById("btn-add-tag").addEventListener("click", () => openTagModal());
  document.getElementById("tag-cancel-btn").addEventListener("click", () => tagDialog.close());
  tagForm.addEventListener("submit", handleTagSubmit);
}

function confirmAction(title, message, onConfirm) {
  const dialog = document.getElementById("admin-confirm-dialog");
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;

  const okBtn = document.getElementById("confirm-ok-btn");
  const handler = async () => {
    okBtn.removeEventListener("click", handler);
    dialog.close();
    await onConfirm();
  };
  okBtn.replaceWith(okBtn.cloneNode(true));
  document.getElementById("confirm-ok-btn").addEventListener("click", handler);

  dialog.showModal();
}

function openUniversityModal(university) {
  const dialog = document.getElementById("admin-uni-dialog");
  const errorEl = document.getElementById("uni-dialog-error");
  errorEl.hidden = true;

  if (university) {
    document.getElementById("uni-dialog-title").textContent = "Edit University";
    document.getElementById("uni-id-input").value = university.universityId;
    document.getElementById("uni-name-input").value = university.name;
    document.getElementById("uni-shortname-input").value = university.shortName;
  } else {
    document.getElementById("uni-dialog-title").textContent = "Add University";
    document.getElementById("uni-id-input").value = "";
    document.getElementById("uni-name-input").value = "";
    document.getElementById("uni-shortname-input").value = "";
  }

  dialog.showModal();
}

async function handleUniversitySubmit(e) {
  e.preventDefault();
  const id = document.getElementById("uni-id-input").value;
  const name = document.getElementById("uni-name-input").value.trim();
  const shortName = document.getElementById("uni-shortname-input").value.trim();
  const errorEl = document.getElementById("uni-dialog-error");

  try {
    if (id) {
      await patchJson(`/api/admin/universities/${id}`, { name, shortName });
      showToast("University updated successfully");
    } else {
      await postJson("/api/admin/universities", { name, shortName });
      showToast("University created successfully");
    }
    document.getElementById("admin-uni-dialog").close();
    loadUniversities();
    loadMetrics();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function openDepartmentModal(department) {
  const dialog = document.getElementById("admin-dept-dialog");
  const errorEl = document.getElementById("dept-dialog-error");
  errorEl.hidden = true;

  if (department) {
    document.getElementById("dept-dialog-title").textContent = "Edit Department";
    document.getElementById("dept-id-input").value = department.departmentId;
    document.getElementById("dept-name-input").value = department.name;
    document.getElementById("dept-abbrev-input").value = department.abbreviation;
    document.getElementById("dept-type-input").value = department.departmentType;
  } else {
    document.getElementById("dept-dialog-title").textContent = "Add Department";
    document.getElementById("dept-id-input").value = "";
    document.getElementById("dept-name-input").value = "";
    document.getElementById("dept-abbrev-input").value = "";
    document.getElementById("dept-type-input").value = "";
  }

  dialog.showModal();
}

async function handleDepartmentSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("dept-id-input").value;
  const name = document.getElementById("dept-name-input").value.trim();
  const abbreviation = document.getElementById("dept-abbrev-input").value.trim();
  const departmentType = document.getElementById("dept-type-input").value.trim();
  const errorEl = document.getElementById("dept-dialog-error");

  try {
    if (id) {
      await patchJson(`/api/admin/departments/${id}`, { name, abbreviation, departmentType });
      showToast("Department updated successfully");
    } else {
      await postJson("/api/admin/departments", { name, abbreviation, departmentType });
      showToast("Department created successfully");
    }
    document.getElementById("admin-dept-dialog").close();
    loadDepartments();
    loadMetrics();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function openTagModal(tag) {
  const dialog = document.getElementById("admin-tag-dialog");
  const errorEl = document.getElementById("tag-dialog-error");
  errorEl.hidden = true;

  if (tag) {
    document.getElementById("tag-dialog-title").textContent = "Edit Review Tag";
    document.getElementById("tag-id-input").value = tag.tagId;
    document.getElementById("tag-name-input").value = tag.name;
    document.getElementById("tag-desc-input").value = tag.description;
    document.getElementById("tag-order-input").value = tag.displayOrder;
    document.getElementById("tag-active-input").checked = Boolean(tag.isActive);
  } else {
    document.getElementById("tag-dialog-title").textContent = "Add Review Tag";
    document.getElementById("tag-id-input").value = "";
    document.getElementById("tag-name-input").value = "";
    document.getElementById("tag-desc-input").value = "";
    document.getElementById("tag-order-input").value = "1";
    document.getElementById("tag-active-input").checked = true;
  }

  dialog.showModal();
}

async function handleTagSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("tag-id-input").value;
  const name = document.getElementById("tag-name-input").value.trim();
  const description = document.getElementById("tag-desc-input").value.trim();
  const displayOrder = parseInt(document.getElementById("tag-order-input").value, 10);
  const isActive = document.getElementById("tag-active-input").checked;
  const errorEl = document.getElementById("tag-dialog-error");

  try {
    if (id) {
      await patchJson(`/api/admin/tags/${id}`, { name, description, displayOrder, isActive });
      showToast("Tag updated successfully");
    } else {
      await postJson("/api/admin/tags", { name, description, displayOrder, isActive });
      showToast("Tag created successfully");
    }
    document.getElementById("admin-tag-dialog").close();
    loadTags();
    loadMetrics();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// -------------------------------------------------------------
// Filters & Pagination Buttons
// -------------------------------------------------------------
function setupRefreshButtons() {
  document.getElementById("btn-refresh-all")?.addEventListener("click", () => {
    loadMetrics();
    loadReports();
    loadPosts();
    loadUsers();
    showToast("Dashboard refreshed");
  });

  // Reports
  document.getElementById("reports-status-filter")?.addEventListener("change", (e) => {
    state.reports.status = e.target.value;
    state.reports.page = 1;
    loadReports();
  });
  document.getElementById("btn-refresh-reports")?.addEventListener("click", loadReports);
  document.getElementById("reports-prev-page")?.addEventListener("click", () => {
    if (state.reports.page > 1) {
      state.reports.page--;
      loadReports();
    }
  });
  document.getElementById("reports-next-page")?.addEventListener("click", () => {
    if (state.reports.page < state.reports.totalPages) {
      state.reports.page++;
      loadReports();
    }
  });

  // Posts
  document.getElementById("btn-filter-posts")?.addEventListener("click", () => {
    state.posts.search = document.getElementById("posts-search-input").value.trim();
    state.posts.status = document.getElementById("posts-status-filter").value;
    state.posts.sentiment = document.getElementById("posts-sentiment-filter").value;
    state.posts.page = 1;
    loadPosts();
  });
  document.getElementById("posts-prev-page")?.addEventListener("click", () => {
    if (state.posts.page > 1) {
      state.posts.page--;
      loadPosts();
    }
  });
  document.getElementById("posts-next-page")?.addEventListener("click", () => {
    if (state.posts.page < state.posts.totalPages) {
      state.posts.page++;
      loadPosts();
    }
  });

  // Users
  document.getElementById("btn-filter-users")?.addEventListener("click", () => {
    state.users.search = document.getElementById("users-search-input").value.trim();
    state.users.isVerified = document.getElementById("users-verified-filter").value;
    state.users.role = document.getElementById("users-role-filter").value;
    state.users.page = 1;
    loadUsers();
  });
  document.getElementById("users-prev-page")?.addEventListener("click", () => {
    if (state.users.page > 1) {
      state.users.page--;
      loadUsers();
    }
  });
  document.getElementById("users-next-page")?.addEventListener("click", () => {
    if (state.users.page < state.users.totalPages) {
      state.users.page++;
      loadUsers();
    }
  });
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function showToast(message, isError = false) {
  const toast = document.getElementById("admin-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `admin-toast ${isError ? "admin-toast--error" : ""}`;
  toast.hidden = false;

  setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
