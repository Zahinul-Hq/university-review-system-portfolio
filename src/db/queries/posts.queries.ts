import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../index.js";
import { votesQueries } from "./votes.queries.js";
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
  CreatePostInput,
  ListPostsQuery,
  PostDetail,
  PostTagItem,
} from "../../modules/posts/posts.types.js";

export const postsQueries = {
  async listActiveTags(): Promise<PostTagItem[]> {
    return db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        description: tags.description,
        displayOrder: tags.displayOrder,
      })
      .from(tags)
      .where(eq(tags.isActive, true))
      .orderBy(asc(tags.displayOrder), asc(tags.name));
  },

  async findActiveTagsByIds(tagIds: string[]): Promise<string[]> {
    if (tagIds.length === 0) return [];

    const found = await db
      .select({ tagId: tags.tagId })
      .from(tags)
      .where(and(inArray(tags.tagId, tagIds), eq(tags.isActive, true)));

    return found.map((t) => t.tagId);
  },

  async findUserAffiliation(userId: string) {
    const rows = await db
      .select({
        userId: users.userId,
        emailVerifiedAt: users.emailVerifiedAt,
        isVerified: users.isVerified,
        universityId: universities.universityId,
        universityName: universities.name,
        universityShortName: universities.shortName,
        departmentId: departments.departmentId,
        departmentName: departments.name,
        departmentAbbreviation: departments.abbreviation,
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
      .where(eq(users.userId, userId))
      .limit(1);

    return rows[0] ?? null;
  },

  async createPost(
    userId: string,
    input: CreatePostInput,
    validTagIds: string[],
  ): Promise<string> {
    return db.transaction(async (tx) => {
      const [newPost] = await tx
        .insert(posts)
        .values({
          userId,
          content: input.content,
          sentiment: input.sentiment,
          status: "published",
        })
        .returning({ postId: posts.postId });

      if (!newPost) {
        throw new Error("Failed to create post record");
      }

      if (validTagIds.length > 0) {
        await tx.insert(postTags).values(
          validTagIds.map((tagId) => ({
            postId: newPost.postId,
            tagId,
          })),
        );
      }

      return newPost.postId;
    });
  },

  async findPostAuthor(postId: string) {
    const rows = await db
      .select({
        postId: posts.postId,
        userId: posts.userId,
        status: posts.status,
      })
      .from(posts)
      .where(eq(posts.postId, postId))
      .limit(1);

    return rows[0] ?? null;
  },

  async getPostById(postId: string, currentUserId?: string): Promise<PostDetail | null> {
    const postRows = await db
      .select({
        postId: posts.postId,
        content: posts.content,
        sentiment: posts.sentiment,
        status: posts.status,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorUserId: posts.userId,
        authorVerified: users.isVerified,
        universityId: universities.universityId,
        universityName: universities.name,
        universityShortName: universities.shortName,
        departmentId: departments.departmentId,
        departmentName: departments.name,
        departmentAbbreviation: departments.abbreviation,
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
      .where(eq(posts.postId, postId))
      .limit(1);

    const post = postRows[0];
    if (!post) return null;

    // Fetch tags
    const attachedTags = await db
      .select({
        tagId: tags.tagId,
        name: tags.name,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.tagId))
      .where(eq(postTags.postId, postId))
      .orderBy(asc(tags.displayOrder), asc(tags.name));

    // Fetch vote summary
    const voteStats = await votesQueries.getVoteSummary(postId, currentUserId);

    return {
      postId: post.postId,
      content: post.content,
      sentiment: post.sentiment as PostDetail["sentiment"],
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      university: {
        universityId: post.universityId,
        name: post.universityName,
        shortName: post.universityShortName,
      },
      department: {
        departmentId: post.departmentId,
        name: post.departmentName,
        abbreviation: post.departmentAbbreviation,
      },
      authorVerified: post.authorVerified,
      tags: attachedTags,
      score: voteStats.score,
      upvotes: voteStats.upvotes,
      downvotes: voteStats.downvotes,
      userVote: voteStats.userVote,
      isAuthor: currentUserId ? post.authorUserId === currentUserId : false,
    };
  },

  async listPosts(
    query: ListPostsQuery,
    currentUserId?: string,
  ): Promise<{ posts: PostDetail[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(posts.status, "published")];

    if (query.universityId) {
      conditions.push(eq(universities.universityId, query.universityId));
    }
    if (query.departmentId) {
      conditions.push(eq(departments.departmentId, query.departmentId));
    }
    if (query.sentiment) {
      conditions.push(eq(posts.sentiment, query.sentiment));
    }
    if (query.tagId) {
      // Subquery filter for posts that have this tag
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${postTags} WHERE ${postTags.postId} = ${posts.postId} AND ${postTags.tagId} = ${query.tagId})`,
      );
    }

    const whereClause = and(...conditions);

    // Get total matching count
    const [totalResult] = await db
      .select({ total: count() })
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
      .where(whereClause);

    const total = Number(totalResult?.total ?? 0);

    // Vote aggregate expressions
    const scoreSql = sql<number>`COALESCE(SUM(${postVotes.voteType}), 0)`;
    const upvotesSql = sql<number>`COALESCE(SUM(CASE WHEN ${postVotes.voteType} = 1 THEN 1 ELSE 0 END), 0)`;
    const downvotesSql = sql<number>`COALESCE(SUM(CASE WHEN ${postVotes.voteType} = -1 THEN 1 ELSE 0 END), 0)`;

    // Select query
    const baseQuery = db
      .select({
        postId: posts.postId,
        content: posts.content,
        sentiment: posts.sentiment,
        status: posts.status,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorUserId: posts.userId,
        authorVerified: users.isVerified,
        universityId: universities.universityId,
        universityName: universities.name,
        universityShortName: universities.shortName,
        departmentId: departments.departmentId,
        departmentName: departments.name,
        departmentAbbreviation: departments.abbreviation,
        score: scoreSql,
        upvotes: upvotesSql,
        downvotes: downvotesSql,
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
        posts.createdAt,
        posts.updatedAt,
        posts.userId,
        users.isVerified,
        universities.universityId,
        universities.name,
        universities.shortName,
        departments.departmentId,
        departments.name,
        departments.abbreviation,
      );

    if (query.sort === "top") {
      baseQuery.orderBy(desc(scoreSql), desc(posts.createdAt));
    } else {
      baseQuery.orderBy(desc(posts.createdAt));
    }

    const postRows = await baseQuery.limit(limit).offset(offset);

    if (postRows.length === 0) {
      return { posts: [], total };
    }

    const postIds = postRows.map((p) => p.postId);

    // Batch fetch tags for all fetched posts
    const tagsForPosts = await db
      .select({
        postId: postTags.postId,
        tagId: tags.tagId,
        name: tags.name,
        displayOrder: tags.displayOrder,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.tagId))
      .where(inArray(postTags.postId, postIds))
      .orderBy(asc(tags.displayOrder), asc(tags.name));

    const tagsByPostId = new Map<string, { tagId: string; name: string }[]>();
    for (const t of tagsForPosts) {
      const list = tagsByPostId.get(t.postId) ?? [];
      list.push({ tagId: t.tagId, name: t.name });
      tagsByPostId.set(t.postId, list);
    }

    // Batch fetch user votes if currentUserId is provided
    const userVotesByPostId = new Map<string, 1 | -1>();
    if (currentUserId) {
      const userVotes = await db
        .select({
          postId: postVotes.postId,
          voteType: postVotes.voteType,
        })
        .from(postVotes)
        .where(
          and(
            inArray(postVotes.postId, postIds),
            eq(postVotes.userId, currentUserId),
          ),
        );

      for (const v of userVotes) {
        userVotesByPostId.set(v.postId, v.voteType as 1 | -1);
      }
    }

    const resultPosts: PostDetail[] = postRows.map((row) => ({
      postId: row.postId,
      content: row.content,
      sentiment: row.sentiment as PostDetail["sentiment"],
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      university: {
        universityId: row.universityId,
        name: row.universityName,
        shortName: row.universityShortName,
      },
      department: {
        departmentId: row.departmentId,
        name: row.departmentName,
        abbreviation: row.departmentAbbreviation,
      },
      authorVerified: row.authorVerified,
      tags: tagsByPostId.get(row.postId) ?? [],
      score: Number(row.score ?? 0),
      upvotes: Number(row.upvotes ?? 0),
      downvotes: Number(row.downvotes ?? 0),
      userVote: userVotesByPostId.get(row.postId) ?? null,
      isAuthor: currentUserId ? row.authorUserId === currentUserId : false,
    }));

    return { posts: resultPosts, total };
  },

  async deletePost(postId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(postTags).where(eq(postTags.postId, postId));
      await tx.delete(postVotes).where(eq(postVotes.postId, postId));
      await tx.delete(reports).where(eq(reports.postId, postId));
      await tx.delete(posts).where(eq(posts.postId, postId));
    });
  },

  async findPendingReport(postId: string, reporterUserId: string) {
    const rows = await db
      .select({ reportId: reports.reportId })
      .from(reports)
      .where(
        and(
          eq(reports.postId, postId),
          eq(reports.reporterUserId, reporterUserId),
          eq(reports.status, "pending"),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },

  async createReport(params: {
    postId: string;
    reporterUserId: string;
    reason: string;
    description: string;
  }): Promise<string> {
    const [created] = await db
      .insert(reports)
      .values({
        postId: params.postId,
        reporterUserId: params.reporterUserId,
        reason: params.reason,
        description: params.description,
        status: "pending",
      })
      .returning({ reportId: reports.reportId });

    if (!created) {
      throw new Error("Failed to create report");
    }

    return created.reportId;
  },
};
