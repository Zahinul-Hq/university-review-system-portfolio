import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../index.js";
import {
  departments,
  posts,
  postTags,
  postVotes,
  reports,
  tags,
  universities,
  universityDepartments,
  users,
} from "../schema.js";
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
  UpdateTagInput,
  UpdateUniversityInput,
} from "../../modules/admin/admin.types.js";

const reporterUsers = alias(users, "reporter_users");

export const adminQueries = {
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const [userStats] = await db
      .select({
        totalUsers: count(users.userId),
        verifiedStudents: sql<number>`count(case when ${users.isVerified} = true then 1 end)`,
      })
      .from(users);

    const [postStats] = await db
      .select({
        totalReviews: count(posts.postId),
        publishedReviews: sql<number>`count(case when ${posts.status} = 'published' then 1 end)`,
        hiddenReviews: sql<number>`count(case when ${posts.status} = 'hidden' then 1 end)`,
      })
      .from(posts);

    const [reportStats] = await db
      .select({
        pendingReports: count(reports.reportId),
      })
      .from(reports)
      .where(eq(reports.status, "pending"));

    const [uniStats] = await db
      .select({ totalUniversities: count(universities.universityId) })
      .from(universities);

    const [deptStats] = await db
      .select({ totalDepartments: count(departments.departmentId) })
      .from(departments);

    const [tagStats] = await db
      .select({ totalTags: count(tags.tagId) })
      .from(tags);

    return {
      totalUsers: Number(userStats?.totalUsers ?? 0),
      verifiedStudents: Number(userStats?.verifiedStudents ?? 0),
      totalReviews: Number(postStats?.totalReviews ?? 0),
      publishedReviews: Number(postStats?.publishedReviews ?? 0),
      hiddenReviews: Number(postStats?.hiddenReviews ?? 0),
      pendingReports: Number(reportStats?.pendingReports ?? 0),
      totalUniversities: Number(uniStats?.totalUniversities ?? 0),
      totalDepartments: Number(deptStats?.totalDepartments ?? 0),
      totalTags: Number(tagStats?.totalTags ?? 0),
    };
  },

  async listReports(
    query: ListReportsQuery,
  ): Promise<{ reports: AdminReportItem[]; total: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.status) {
      conditions.push(eq(reports.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count(reports.reportId) })
      .from(reports)
      .where(whereClause);

    const rows = await db
      .select({
        reportId: reports.reportId,
        postId: reports.postId,
        postContent: posts.content,
        postStatus: posts.status,
        postSentiment: posts.sentiment,
        reporterUserId: reports.reporterUserId,
        reporterUsername: reporterUsers.username,
        authorUniversityName: universities.name,
        authorDepartmentName: departments.name,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .innerJoin(posts, eq(reports.postId, posts.postId))
      .innerJoin(reporterUsers, eq(reports.reporterUserId, reporterUsers.userId))
      .innerJoin(users, eq(posts.userId, users.userId))
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .innerJoin(
        universities,
        eq(universityDepartments.universityId, universities.universityId),
      )
      .innerJoin(
        departments,
        eq(universityDepartments.departmentId, departments.departmentId),
      )
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      reports: rows,
      total: Number(totalRow?.count ?? 0),
    };
  },

  async getReportById(reportId: string) {
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.reportId, reportId))
      .limit(1);

    return rows[0] ?? null;
  },

  async updateReportStatus(reportId: string, status: string) {
    const [updated] = await db
      .update(reports)
      .set({ status })
      .where(eq(reports.reportId, reportId))
      .returning();

    return updated ?? null;
  },

  async listAdminPosts(
    query: ListPostsAdminQuery,
  ): Promise<{ posts: AdminPostItem[]; total: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(posts.status, query.status));
    }
    if (query.sentiment) {
      conditions.push(eq(posts.sentiment, query.sentiment));
    }
    if (query.universityId) {
      conditions.push(eq(universities.universityId, query.universityId));
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(ilike(posts.content, term));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count(posts.postId) })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.userId))
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .innerJoin(
        universities,
        eq(universityDepartments.universityId, universities.universityId),
      )
      .where(whereClause);

    const rows = await db
      .select({
        postId: posts.postId,
        content: posts.content,
        sentiment: posts.sentiment,
        status: posts.status,
        authorUserId: users.userId,
        authorUsername: users.username,
        authorUniversityName: universities.name,
        authorDepartmentName: departments.name,
        authorVerified: users.isVerified,
        score: sql<number>`coalesce(sum(${postVotes.voteType}), 0)::int`,
        upvotes: sql<number>`coalesce(count(case when ${postVotes.voteType} = 1 then 1 end), 0)::int`,
        downvotes: sql<number>`coalesce(count(case when ${postVotes.voteType} = -1 then 1 end), 0)::int`,
        reportsCount: sql<number>`(select count(*) from ${reports} where ${reports.postId} = ${posts.postId})::int`,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.userId))
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .innerJoin(
        universities,
        eq(universityDepartments.universityId, universities.universityId),
      )
      .innerJoin(
        departments,
        eq(universityDepartments.departmentId, departments.departmentId),
      )
      .leftJoin(postVotes, eq(posts.postId, postVotes.postId))
      .where(whereClause)
      .groupBy(
        posts.postId,
        posts.content,
        posts.sentiment,
        posts.status,
        users.userId,
        users.username,
        universities.name,
        departments.name,
        users.isVerified,
        posts.createdAt,
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      posts: rows,
      total: Number(totalRow?.count ?? 0),
    };
  },

  async updatePostStatus(postId: string, status: string) {
    const [updated] = await db
      .update(posts)
      .set({ status })
      .where(eq(posts.postId, postId))
      .returning();

    return updated ?? null;
  },

  async deletePostPermanent(postId: string) {
    return db.transaction(async (tx) => {
      await tx.delete(postTags).where(eq(postTags.postId, postId));
      await tx.delete(postVotes).where(eq(postVotes.postId, postId));
      await tx.delete(reports).where(eq(reports.postId, postId));
      const [deleted] = await tx
        .delete(posts)
        .where(eq(posts.postId, postId))
        .returning({ postId: posts.postId });

      return deleted ?? null;
    });
  },

  async listUsersAdmin(
    query: ListUsersAdminQuery,
  ): Promise<{ users: AdminUserItem[]; total: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }
    if (query.isVerified !== undefined && query.isVerified !== "") {
      const isVer =
        query.isVerified === true ||
        query.isVerified === "true" ||
        query.isVerified === "1";
      conditions.push(eq(users.isVerified, isVer));
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(ilike(users.username, term), ilike(users.emailAddress, term)),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count(users.userId) })
      .from(users)
      .where(whereClause);

    const rows = await db
      .select({
        userId: users.userId,
        username: users.username,
        emailAddress: users.emailAddress,
        eduMailAddress: users.eduMailAddress,
        isVerified: users.isVerified,
        emailVerifiedAt: users.emailVerifiedAt,
        role: users.role,
        universityName: universities.name,
        departmentName: departments.name,
        postCount: sql<number>`(select count(*) from ${posts} where ${posts.userId} = ${users.userId})::int`,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .innerJoin(
        universities,
        eq(universityDepartments.universityId, universities.universityId),
      )
      .innerJoin(
        departments,
        eq(universityDepartments.departmentId, departments.departmentId),
      )
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      users: rows,
      total: Number(totalRow?.count ?? 0),
    };
  },

  async getUserById(userId: string) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    return rows[0] ?? null;
  },

  async updateUserVerification(userId: string, isVerified: boolean) {
    const [updated] = await db
      .update(users)
      .set({ isVerified })
      .where(eq(users.userId, userId))
      .returning({
        userId: users.userId,
        username: users.username,
        isVerified: users.isVerified,
        role: users.role,
      });

    return updated ?? null;
  },

  async updateUserRole(userId: string, role: string) {
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.userId, userId))
      .returning({
        userId: users.userId,
        username: users.username,
        isVerified: users.isVerified,
        role: users.role,
      });

    return updated ?? null;
  },

  async listUniversities(): Promise<AdminUniversityItem[]> {
    return db
      .select({
        universityId: universities.universityId,
        name: universities.name,
        shortName: universities.shortName,
        departmentsCount: count(universityDepartments.universityDepartmentId),
      })
      .from(universities)
      .leftJoin(
        universityDepartments,
        eq(universities.universityId, universityDepartments.universityId),
      )
      .groupBy(universities.universityId, universities.name, universities.shortName)
      .orderBy(asc(universities.name));
  },

  async getUniversityById(universityId: string) {
    const rows = await db
      .select()
      .from(universities)
      .where(eq(universities.universityId, universityId))
      .limit(1);

    return rows[0] ?? null;
  },

  async createUniversity(input: CreateUniversityInput) {
    const [created] = await db
      .insert(universities)
      .values({
        name: input.name,
        shortName: input.shortName,
      })
      .returning();

    return created ?? null;
  },

  async updateUniversity(universityId: string, input: UpdateUniversityInput) {
    const [updated] = await db
      .update(universities)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.shortName ? { shortName: input.shortName } : {}),
      })
      .where(eq(universities.universityId, universityId))
      .returning();

    return updated ?? null;
  },

  async listDepartments(): Promise<AdminDepartmentItem[]> {
    return db
      .select({
        departmentId: departments.departmentId,
        name: departments.name,
        abbreviation: departments.abbreviation,
        departmentType: departments.departmentType,
      })
      .from(departments)
      .orderBy(asc(departments.name));
  },

  async getDepartmentById(departmentId: string) {
    const rows = await db
      .select()
      .from(departments)
      .where(eq(departments.departmentId, departmentId))
      .limit(1);

    return rows[0] ?? null;
  },

  async createDepartment(input: CreateDepartmentInput) {
    const [created] = await db
      .insert(departments)
      .values({
        name: input.name,
        abbreviation: input.abbreviation,
        departmentType: input.departmentType,
      })
      .returning();

    return created ?? null;
  },

  async updateDepartment(departmentId: string, input: UpdateDepartmentInput) {
    const [updated] = await db
      .update(departments)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.abbreviation ? { abbreviation: input.abbreviation } : {}),
        ...(input.departmentType ? { departmentType: input.departmentType } : {}),
      })
      .where(eq(departments.departmentId, departmentId))
      .returning();

    return updated ?? null;
  },

  async listAllTagsAdmin(): Promise<AdminTagItem[]> {
    return db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        description: tags.description,
        isActive: tags.isActive,
        displayOrder: tags.displayOrder,
      })
      .from(tags)
      .orderBy(asc(tags.displayOrder), asc(tags.name));
  },

  async getTagById(tagId: string) {
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.tagId, tagId))
      .limit(1);

    return rows[0] ?? null;
  },

  async createTag(input: CreateTagInput) {
    const [created] = await db
      .insert(tags)
      .values({
        name: input.name,
        description: input.description,
        displayOrder: input.displayOrder,
        isActive: input.isActive ?? true,
      })
      .returning();

    return created ?? null;
  },

  async updateTag(tagId: string, input: UpdateTagInput) {
    const [updated] = await db
      .update(tags)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .where(eq(tags.tagId, tagId))
      .returning();

    return updated ?? null;
  },
};
