import {
  BadRequestError,
  NotFoundError,
} from "../../api/errors.js";
import type {
  AdminDashboardMetrics,
  AdminDepartmentItem,
  AdminPostItem,
  AdminReportItem,
  AdminTagItem,
  AdminUniversityItem,
  AdminUserItem,
  CreateDepartmentInput,
  CreateTagInput,
  CreateUniversityInput,
  ListPostsAdminQuery,
  ListReportsQuery,
  ListUsersAdminQuery,
  UpdateDepartmentInput,
  UpdatePostStatusInput,
  UpdateReportStatusInput,
  UpdateTagInput,
  UpdateUniversityInput,
  UpdateUserRoleInput,
  UpdateUserVerificationInput,
} from "./admin.types.js";
import { adminQueries } from "../../db/queries/admin.queries.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_REPORT_STATUSES = new Set([
  "pending",
  "reviewed",
  "dismissed",
  "actioned",
]);

const VALID_POST_STATUSES = new Set(["published", "hidden"]);
const VALID_ROLES = new Set(["user", "admin"]);

export class AdminService {
  async getMetrics(): Promise<AdminDashboardMetrics> {
    return adminQueries.getDashboardMetrics();
  }

  async listReports(
    query: ListReportsQuery,
  ): Promise<{ reports: AdminReportItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    if (query.status && !VALID_REPORT_STATUSES.has(query.status)) {
      throw new BadRequestError("Invalid report status filter");
    }

    const { reports, total } = await adminQueries.listReports({
      ...query,
      page,
      limit,
    });

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updateReportStatus(
    reportId: string,
    input: UpdateReportStatusInput,
  ) {
    if (!UUID_REGEX.test(reportId)) {
      throw new BadRequestError("Invalid report ID format");
    }

    if (!VALID_REPORT_STATUSES.has(input.status)) {
      throw new BadRequestError(
        "Report status must be 'pending', 'reviewed', 'dismissed', or 'actioned'",
      );
    }

    const report = await adminQueries.getReportById(reportId);
    if (!report) {
      throw new NotFoundError("Report not found");
    }

    const updated = await adminQueries.updateReportStatus(reportId, input.status);
    return {
      message: `Report status updated to ${input.status}`,
      report: updated,
    };
  }

  async listPosts(
    query: ListPostsAdminQuery,
  ): Promise<{ posts: AdminPostItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    if (query.status && !VALID_POST_STATUSES.has(query.status)) {
      throw new BadRequestError("Invalid post status filter");
    }
    if (query.universityId && !UUID_REGEX.test(query.universityId)) {
      throw new BadRequestError("Invalid university ID format");
    }

    const { posts, total } = await adminQueries.listAdminPosts({
      ...query,
      page,
      limit,
    });

    return {
      posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updatePostStatus(postId: string, input: UpdatePostStatusInput) {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    if (!VALID_POST_STATUSES.has(input.status)) {
      throw new BadRequestError("Post status must be 'published' or 'hidden'");
    }

    const updated = await adminQueries.updatePostStatus(postId, input.status);
    if (!updated) {
      throw new NotFoundError("Review post not found");
    }

    return {
      message: `Post status updated to ${input.status}`,
      post: updated,
    };
  }

  async deletePost(postId: string) {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    const deleted = await adminQueries.deletePostPermanent(postId);
    if (!deleted) {
      throw new NotFoundError("Review post not found");
    }

    return { message: "Review deleted successfully by admin" };
  }

  async listUsers(
    query: ListUsersAdminQuery,
  ): Promise<{ users: AdminUserItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    if (query.role && !VALID_ROLES.has(query.role)) {
      throw new BadRequestError("Invalid user role filter");
    }

    const { users, total } = await adminQueries.listUsersAdmin({
      ...query,
      page,
      limit,
    });

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updateUserVerification(
    userId: string,
    input: UpdateUserVerificationInput,
  ) {
    if (!UUID_REGEX.test(userId)) {
      throw new BadRequestError("Invalid user ID format");
    }

    if (typeof input.isVerified !== "boolean") {
      throw new BadRequestError("isVerified must be a boolean");
    }

    const existingUser = await adminQueries.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    const updated = await adminQueries.updateUserVerification(
      userId,
      input.isVerified,
    );

    return {
      message: input.isVerified
        ? "Student university affiliation verified"
        : "Student university affiliation unverified",
      user: updated,
    };
  }

  async updateUserRole(
    userId: string,
    input: UpdateUserRoleInput,
    currentAdminUserId: string,
  ) {
    if (!UUID_REGEX.test(userId)) {
      throw new BadRequestError("Invalid user ID format");
    }

    if (!VALID_ROLES.has(input.role)) {
      throw new BadRequestError("Role must be 'user' or 'admin'");
    }

    if (userId === currentAdminUserId && input.role !== "admin") {
      throw new BadRequestError("Administrators cannot demote their own account");
    }

    const existingUser = await adminQueries.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    const updated = await adminQueries.updateUserRole(userId, input.role);

    return {
      message: `User role changed to ${input.role}`,
      user: updated,
    };
  }

  async listUniversities(): Promise<AdminUniversityItem[]> {
    return adminQueries.listUniversities();
  }

  async createUniversity(input: CreateUniversityInput) {
    const name = input.name?.trim();
    const shortName = input.shortName?.trim();

    if (!name || name.length < 2 || name.length > 100) {
      throw new BadRequestError("University name must be between 2 and 100 characters");
    }
    if (!shortName || shortName.length < 1 || shortName.length > 20) {
      throw new BadRequestError("University short name must be between 1 and 20 characters");
    }

    const created = await adminQueries.createUniversity({ name, shortName });
    return {
      message: "University created successfully",
      university: created,
    };
  }

  async updateUniversity(universityId: string, input: UpdateUniversityInput) {
    if (!UUID_REGEX.test(universityId)) {
      throw new BadRequestError("Invalid university ID format");
    }

    const existing = await adminQueries.getUniversityById(universityId);
    if (!existing) {
      throw new NotFoundError("University not found");
    }

    const name = input.name?.trim();
    const shortName = input.shortName?.trim();

    if (name !== undefined && (name.length < 2 || name.length > 100)) {
      throw new BadRequestError("University name must be between 2 and 100 characters");
    }
    if (shortName !== undefined && (shortName.length < 1 || shortName.length > 20)) {
      throw new BadRequestError("University short name must be between 1 and 20 characters");
    }

    const updated = await adminQueries.updateUniversity(universityId, {
      ...(name ? { name } : {}),
      ...(shortName ? { shortName } : {}),
    });

    return {
      message: "University updated successfully",
      university: updated,
    };
  }

  async listDepartments(): Promise<AdminDepartmentItem[]> {
    return adminQueries.listDepartments();
  }

  async createDepartment(input: CreateDepartmentInput) {
    const name = input.name?.trim();
    const abbreviation = input.abbreviation?.trim();
    const departmentType = input.departmentType?.trim();

    if (!name || name.length < 2 || name.length > 100) {
      throw new BadRequestError("Department name must be between 2 and 100 characters");
    }
    if (!abbreviation || abbreviation.length < 1 || abbreviation.length > 20) {
      throw new BadRequestError("Department abbreviation must be between 1 and 20 characters");
    }
    if (!departmentType || departmentType.length < 1 || departmentType.length > 50) {
      throw new BadRequestError("Department type is required");
    }

    const created = await adminQueries.createDepartment({
      name,
      abbreviation,
      departmentType,
    });

    return {
      message: "Department created successfully",
      department: created,
    };
  }

  async updateDepartment(departmentId: string, input: UpdateDepartmentInput) {
    if (!UUID_REGEX.test(departmentId)) {
      throw new BadRequestError("Invalid department ID format");
    }

    const existing = await adminQueries.getDepartmentById(departmentId);
    if (!existing) {
      throw new NotFoundError("Department not found");
    }

    const name = input.name?.trim();
    const abbreviation = input.abbreviation?.trim();
    const departmentType = input.departmentType?.trim();

    if (name !== undefined && (name.length < 2 || name.length > 100)) {
      throw new BadRequestError("Department name must be between 2 and 100 characters");
    }
    if (abbreviation !== undefined && (abbreviation.length < 1 || abbreviation.length > 20)) {
      throw new BadRequestError("Department abbreviation must be between 1 and 20 characters");
    }

    const updated = await adminQueries.updateDepartment(departmentId, {
      ...(name ? { name } : {}),
      ...(abbreviation ? { abbreviation } : {}),
      ...(departmentType ? { departmentType } : {}),
    });

    return {
      message: "Department updated successfully",
      department: updated,
    };
  }

  async listTags(): Promise<AdminTagItem[]> {
    return adminQueries.listAllTagsAdmin();
  }

  async createTag(input: CreateTagInput) {
    const name = input.name?.trim();
    const description = input.description?.trim();
    const displayOrder = Number(input.displayOrder);

    if (!name || name.length < 2 || name.length > 50) {
      throw new BadRequestError("Tag name must be between 2 and 50 characters");
    }
    if (!description || description.length < 5 || description.length > 200) {
      throw new BadRequestError("Tag description must be between 5 and 200 characters");
    }
    if (Number.isNaN(displayOrder)) {
      throw new BadRequestError("Display order must be a valid number");
    }

    const created = await adminQueries.createTag({
      name,
      description,
      displayOrder,
      isActive: input.isActive ?? true,
    });

    return {
      message: "Tag created successfully",
      tag: created,
    };
  }

  async updateTag(tagId: string, input: UpdateTagInput) {
    if (!UUID_REGEX.test(tagId)) {
      throw new BadRequestError("Invalid tag ID format");
    }

    const existing = await adminQueries.getTagById(tagId);
    if (!existing) {
      throw new NotFoundError("Tag not found");
    }

    const name = input.name?.trim();
    const description = input.description?.trim();
    const displayOrder =
      input.displayOrder !== undefined ? Number(input.displayOrder) : undefined;

    if (name !== undefined && (name.length < 2 || name.length > 50)) {
      throw new BadRequestError("Tag name must be between 2 and 50 characters");
    }
    if (description !== undefined && (description.length < 5 || description.length > 200)) {
      throw new BadRequestError("Tag description must be between 5 and 200 characters");
    }
    if (displayOrder !== undefined && Number.isNaN(displayOrder)) {
      throw new BadRequestError("Display order must be a valid number");
    }

    const updated = await adminQueries.updateTag(tagId, {
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
    });

    return {
      message: "Tag updated successfully",
      tag: updated,
    };
  }
}

export const adminService = new AdminService();
