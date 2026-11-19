import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../api/errors.js";
import type {
  CreatePostInput,
  ListPostsQuery,
  PaginatedPostsResult,
  PostDetail,
  PostTagItem,
  ReportInput,
  Sentiment,
} from "./posts.types.js";
import { postsQueries } from "../../db/queries/posts.queries.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_SENTIMENTS = new Set<Sentiment>([
  "positive",
  "neutral",
  "negative",
]);

export class PostsService {
  async listTags(): Promise<PostTagItem[]> {
    return postsQueries.listActiveTags();
  }

  async createPost(
    userId: string,
    input: CreatePostInput,
  ): Promise<PostDetail> {
    const content = input.content?.trim();
    if (!content || content.length < 10) {
      throw new BadRequestError(
        "Review content must be at least 10 characters long",
      );
    }
    if (content.length > 2000) {
      throw new BadRequestError(
        "Review content cannot exceed 2000 characters",
      );
    }

    if (!VALID_SENTIMENTS.has(input.sentiment)) {
      throw new BadRequestError(
        "Sentiment must be 'positive', 'neutral', or 'negative'",
      );
    }

    const affiliation = await postsQueries.findUserAffiliation(userId);
    if (!affiliation) {
      throw new NotFoundError("User account or affiliation not found");
    }

    if (!affiliation.emailVerifiedAt) {
      throw new ForbiddenError(
        "Verify your signup email before posting reviews",
      );
    }

    let validTagIds: string[] = [];
    if (input.tagIds && Array.isArray(input.tagIds)) {
      if (input.tagIds.length > 5) {
        throw new BadRequestError("You can attach at most 5 tags per review");
      }

      const uniqueTagIds = Array.from(new Set(input.tagIds));
      for (const id of uniqueTagIds) {
        if (typeof id !== "string" || !UUID_REGEX.test(id)) {
          throw new BadRequestError("Invalid tag ID format");
        }
      }

      validTagIds = await postsQueries.findActiveTagsByIds(uniqueTagIds);
      if (validTagIds.length !== uniqueTagIds.length) {
        throw new BadRequestError(
          "One or more selected tags do not exist or are inactive",
        );
      }
    }

    const postId = await postsQueries.createPost(
      userId,
      {
        content,
        sentiment: input.sentiment,
        tagIds: validTagIds,
      },
      validTagIds,
    );

    const post = await postsQueries.getPostById(postId, userId);
    if (!post) {
      throw new Error("Created post could not be retrieved");
    }

    return post;
  }

  async listPosts(
    query: ListPostsQuery,
    currentUserId?: string,
  ): Promise<PaginatedPostsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    if (query.universityId && !UUID_REGEX.test(query.universityId)) {
      throw new BadRequestError("Invalid university ID format");
    }
    if (query.departmentId && !UUID_REGEX.test(query.departmentId)) {
      throw new BadRequestError("Invalid department ID format");
    }
    if (query.tagId && !UUID_REGEX.test(query.tagId)) {
      throw new BadRequestError("Invalid tag ID format");
    }
    if (query.sentiment && !VALID_SENTIMENTS.has(query.sentiment)) {
      throw new BadRequestError("Invalid sentiment filter");
    }
    if (query.sort && query.sort !== "newest" && query.sort !== "top") {
      throw new BadRequestError("Sort must be 'newest' or 'top'");
    }

    const { posts, total } = await postsQueries.listPosts(
      {
        ...query,
        page,
        limit,
      },
      currentUserId,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      posts,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getPostById(
    postId: string,
    currentUserId?: string,
  ): Promise<PostDetail> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    const post = await postsQueries.getPostById(postId, currentUserId);
    if (!post || post.status !== "published") {
      throw new NotFoundError("Review not found");
    }

    return post;
  }

  async deletePost(
    postId: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    const author = await postsQueries.findPostAuthor(postId);
    if (!author) {
      throw new NotFoundError("Review not found");
    }

    if (author.userId !== currentUserId) {
      throw new ForbiddenError("You are not authorized to delete this review");
    }

    await postsQueries.deletePost(postId);
    return { message: "Review deleted successfully" };
  }

  async reportPost(
    postId: string,
    currentUserId: string,
    input: ReportInput,
  ): Promise<{ message: string }> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    const reason = input.reason?.trim();
    if (!reason || reason.length < 3 || reason.length > 100) {
      throw new BadRequestError(
        "Report reason must be between 3 and 100 characters",
      );
    }

    const description = input.description?.trim() ?? "";
    if (description.length > 500) {
      throw new BadRequestError(
        "Report description cannot exceed 500 characters",
      );
    }

    const post = await postsQueries.findPostAuthor(postId);
    if (!post || post.status !== "published") {
      throw new NotFoundError("Review not found");
    }

    if (post.userId === currentUserId) {
      throw new BadRequestError("You cannot report your own review");
    }

    const existingReport = await postsQueries.findPendingReport(
      postId,
      currentUserId,
    );
    if (existingReport) {
      throw new ConflictError(
        "You have already submitted a pending report for this review",
      );
    }

    await postsQueries.createReport({
      postId,
      reporterUserId: currentUserId,
      reason,
      description,
    });

    return {
      message:
        "Report submitted successfully. Our team will review the content.",
    };
  }
}

export const postsService = new PostsService();
