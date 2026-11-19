import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminQueries: {
    getDashboardMetrics: vi.fn(),
    listReports: vi.fn(),
    getReportById: vi.fn(),
    updateReportStatus: vi.fn(),
    listAdminPosts: vi.fn(),
    updatePostStatus: vi.fn(),
    deletePostPermanent: vi.fn(),
    listUsersAdmin: vi.fn(),
    getUserById: vi.fn(),
    updateUserVerification: vi.fn(),
    updateUserRole: vi.fn(),
    listUniversities: vi.fn(),
    getUniversityById: vi.fn(),
    createUniversity: vi.fn(),
    updateUniversity: vi.fn(),
    listDepartments: vi.fn(),
    getDepartmentById: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    listAllTagsAdmin: vi.fn(),
    getTagById: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
  },
}));

vi.mock("../src/db/queries/admin.queries.js", () => ({
  adminQueries: mocks.adminQueries,
}));

import { AdminService } from "../src/modules/admin/admin.service.js";
import { requireAdmin } from "../src/modules/auth/auth.session.js";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "99999999-9999-4999-8999-999999999999";

describe("AdminService", () => {
  const service = new AdminService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMetrics", () => {
    it("returns overview metrics correctly", async () => {
      const mockMetrics = {
        totalUsers: 10,
        verifiedStudents: 5,
        totalReviews: 20,
        publishedReviews: 18,
        hiddenReviews: 2,
        pendingReports: 3,
        totalUniversities: 4,
        totalDepartments: 8,
        totalTags: 7,
      };
      mocks.adminQueries.getDashboardMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics();
      expect(result).toEqual(mockMetrics);
    });
  });

  describe("reports moderation", () => {
    it("rejects invalid status filter on listReports", async () => {
      await expect(
        service.listReports({ status: "invalid_status" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("lists reports with pagination calculation", async () => {
      mocks.adminQueries.listReports.mockResolvedValue({
        reports: [{ reportId: VALID_ID, reason: "Spam" }],
        total: 25,
      });

      const result = await service.listReports({ page: 2, limit: 10 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.reports).toHaveLength(1);
    });

    it("rejects invalid reportId format when updating report status", async () => {
      await expect(
        service.updateReportStatus("invalid-uuid", { status: "reviewed" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects invalid report status value", async () => {
      await expect(
        // @ts-expect-error test invalid status
        service.updateReportStatus(VALID_ID, { status: "unknown_status" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("throws 404 if report is not found", async () => {
      mocks.adminQueries.getReportById.mockResolvedValue(null);
      await expect(
        service.updateReportStatus(VALID_ID, { status: "dismissed" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("successfully updates report status", async () => {
      mocks.adminQueries.getReportById.mockResolvedValue({ reportId: VALID_ID });
      mocks.adminQueries.updateReportStatus.mockResolvedValue({
        reportId: VALID_ID,
        status: "actioned",
      });

      const result = await service.updateReportStatus(VALID_ID, {
        status: "actioned",
      });
      expect(result.message).toBe("Report status updated to actioned");
      expect(mocks.adminQueries.updateReportStatus).toHaveBeenCalledWith(
        VALID_ID,
        "actioned",
      );
    });
  });

  describe("post moderation", () => {
    it("rejects invalid post status on updatePostStatus", async () => {
      await expect(
        // @ts-expect-error test invalid status
        service.updatePostStatus(VALID_ID, { status: "archived" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("throws 404 if post not found during updatePostStatus", async () => {
      mocks.adminQueries.updatePostStatus.mockResolvedValue(null);
      await expect(
        service.updatePostStatus(VALID_ID, { status: "hidden" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("updates post status to hidden or published", async () => {
      mocks.adminQueries.updatePostStatus.mockResolvedValue({
        postId: VALID_ID,
        status: "hidden",
      });

      const result = await service.updatePostStatus(VALID_ID, {
        status: "hidden",
      });
      expect(result.message).toBe("Post status updated to hidden");
    });

    it("deletes a post permanently", async () => {
      mocks.adminQueries.deletePostPermanent.mockResolvedValue({
        postId: VALID_ID,
      });

      const result = await service.deletePost(VALID_ID);
      expect(result.message).toBe("Review deleted successfully by admin");
      expect(mocks.adminQueries.deletePostPermanent).toHaveBeenCalledWith(
        VALID_ID,
      );
    });

    it("throws 404 when deleting a non-existent post", async () => {
      mocks.adminQueries.deletePostPermanent.mockResolvedValue(null);
      await expect(service.deletePost(VALID_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("user management", () => {
    it("rejects invalid role on updateUserRole", async () => {
      await expect(
        // @ts-expect-error test invalid role
        service.updateUserRole(VALID_ID, { role: "superadmin" }, ADMIN_ID),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("prevents an admin from demoting their own account", async () => {
      await expect(
        service.updateUserRole(ADMIN_ID, { role: "user" }, ADMIN_ID),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Administrators cannot demote their own account",
      });
    });

    it("updates user role", async () => {
      mocks.adminQueries.getUserById.mockResolvedValue({ userId: VALID_ID });
      mocks.adminQueries.updateUserRole.mockResolvedValue({
        userId: VALID_ID,
        role: "admin",
      });

      const result = await service.updateUserRole(
        VALID_ID,
        { role: "admin" },
        ADMIN_ID,
      );
      expect(result.message).toBe("User role changed to admin");
      expect(mocks.adminQueries.updateUserRole).toHaveBeenCalledWith(
        VALID_ID,
        "admin",
      );
    });

    it("updates user university verification", async () => {
      mocks.adminQueries.getUserById.mockResolvedValue({ userId: VALID_ID });
      mocks.adminQueries.updateUserVerification.mockResolvedValue({
        userId: VALID_ID,
        isVerified: true,
      });

      const result = await service.updateUserVerification(VALID_ID, {
        isVerified: true,
      });
      expect(result.message).toBe("Student university affiliation verified");
      expect(mocks.adminQueries.updateUserVerification).toHaveBeenCalledWith(
        VALID_ID,
        true,
      );
    });

    it("throws 404 if user not found when updating verification", async () => {
      mocks.adminQueries.getUserById.mockResolvedValue(null);
      await expect(
        service.updateUserVerification(VALID_ID, { isVerified: true }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("catalog management", () => {
    it("validates university creation name and shortName", async () => {
      await expect(
        service.createUniversity({ name: "U", shortName: "" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("creates university successfully", async () => {
      mocks.adminQueries.createUniversity.mockResolvedValue({
        universityId: VALID_ID,
        name: "Stanford University",
        shortName: "Stanford",
      });

      const result = await service.createUniversity({
        name: "Stanford University",
        shortName: "Stanford",
      });
      expect(result.message).toBe("University created successfully");
    });

    it("validates department creation fields", async () => {
      await expect(
        service.createDepartment({
          name: "",
          abbreviation: "CS",
          departmentType: "Engineering",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("creates tag and validates input", async () => {
      await expect(
        service.createTag({
          name: "A",
          description: "Short",
          displayOrder: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      mocks.adminQueries.createTag.mockResolvedValue({
        tagId: VALID_ID,
        name: "Housing & Dorms",
      });

      const result = await service.createTag({
        name: "Housing & Dorms",
        description: "Dormitories, dining, and on-campus living",
        displayOrder: 8,
      });
      expect(result.message).toBe("Tag created successfully");
    });
  });

  describe("requireAdmin middleware", () => {
    it("returns 401 when session user is absent", () => {
      const req = { session: {} } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when session user role is not admin", () => {
      const req = { session: { user: { role: "user" } } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden: Admin privileges required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next() when session user role is admin", () => {
      const req = { session: { user: { role: "admin" } } } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
