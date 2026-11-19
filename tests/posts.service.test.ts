import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postsQueries: {
    listActiveTags: vi.fn(),
    findActiveTagsByIds: vi.fn(),
    findUserAffiliation: vi.fn(),
    createPost: vi.fn(),
    findPostAuthor: vi.fn(),
    getPostById: vi.fn(),
    listPosts: vi.fn(),
    deletePost: vi.fn(),
    findPendingReport: vi.fn(),
    createReport: vi.fn(),
  },
}));

vi.mock("../src/db/queries/posts.queries.js", () => ({
  postsQueries: mocks.postsQueries,
}));

import { PostsService } from "../src/modules/posts/posts.service.js";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const VALID_POST_ID = "33333333-3333-4333-8333-333333333333";
const VALID_TAG_ID = "44444444-4444-4444-8444-444444444444";

describe("PostsService", () => {
  const service = new PostsService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPost", () => {
    it("rejects content that is too short", async () => {
      await expect(
        service.createPost(VALID_USER_ID, {
          content: "Too short",
          sentiment: "positive",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects invalid sentiment value", async () => {
      await expect(
        service.createPost(VALID_USER_ID, {
          content: "This is a comprehensive review of my department.",
          // @ts-expect-error invalid sentiment
          sentiment: "ecstatic",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects posting when author primary email is not verified", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: null,
        isVerified: false,
      });

      await expect(
        service.createPost(VALID_USER_ID, {
          content: "Great courses and helpful faculty members.",
          sentiment: "positive",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects non-existent tag IDs", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: new Date(),
        isVerified: false,
      });
      mocks.postsQueries.findActiveTagsByIds.mockResolvedValue([]);

      await expect(
        service.createPost(VALID_USER_ID, {
          content: "Great courses and helpful faculty members.",
          sentiment: "positive",
          tagIds: [VALID_TAG_ID],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("creates post successfully when valid", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: new Date(),
        isVerified: false,
      });
      mocks.postsQueries.findActiveTagsByIds.mockResolvedValue([VALID_TAG_ID]);
      mocks.postsQueries.createPost.mockResolvedValue(VALID_POST_ID);
      mocks.postsQueries.getPostById.mockResolvedValue({
        postId: VALID_POST_ID,
        content: "Great courses and helpful faculty members.",
        sentiment: "positive",
        status: "published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        university: {
          universityId: "uni-1",
          name: "BRAC University",
          shortName: "BRACU",
        },
        department: {
          departmentId: "dept-1",
          name: "Computer Science",
          abbreviation: "CSE",
        },
        authorVerified: false,
        tags: [{ tagId: VALID_TAG_ID, name: "Academics" }],
        score: 0,
        upvotes: 0,
        downvotes: 0,
        userVote: null,
        isAuthor: true,
      });

      const result = await service.createPost(VALID_USER_ID, {
        content: "Great courses and helpful faculty members.",
        sentiment: "positive",
        tagIds: [VALID_TAG_ID],
      });

      expect(result.postId).toBe(VALID_POST_ID);
      expect(result.score).toBe(0);
      expect(result.isAuthor).toBe(true);
    });
  });

  describe("listPosts", () => {
    it("rejects invalid sentiment or sort parameters", async () => {
      await expect(
        // @ts-expect-error invalid sentiment
        service.listPosts({ sentiment: "wonderful" }),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        // @ts-expect-error invalid sort
        service.listPosts({ sort: "random" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("returns paginated posts with normalized bounds", async () => {
      mocks.postsQueries.listPosts.mockResolvedValue({
        posts: [],
        total: 0,
      });

      const result = await service.listPosts({ page: 1, limit: 10 });
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
    });
  });

  describe("deletePost", () => {
    it("rejects deletion when user is not the author", async () => {
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: OTHER_USER_ID,
        status: "published",
      });

      await expect(
        service.deletePost(VALID_POST_ID, VALID_USER_ID),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("allows author to delete their review", async () => {
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: VALID_USER_ID,
        status: "published",
      });
      mocks.postsQueries.deletePost.mockResolvedValue(undefined);

      const result = await service.deletePost(VALID_POST_ID, VALID_USER_ID);
      expect(result.message).toContain("deleted");
      expect(mocks.postsQueries.deletePost).toHaveBeenCalledWith(VALID_POST_ID);
    });
  });

  describe("reportPost", () => {
    it("rejects reporting own post", async () => {
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: VALID_USER_ID,
        status: "published",
      });

      await expect(
        service.reportPost(VALID_POST_ID, VALID_USER_ID, {
          reason: "Spam content",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects duplicate pending report from same user", async () => {
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: OTHER_USER_ID,
        status: "published",
      });
      mocks.postsQueries.findPendingReport.mockResolvedValue({
        reportId: "rep-1",
      });

      await expect(
        service.reportPost(VALID_POST_ID, VALID_USER_ID, {
          reason: "Inappropriate content",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("creates report successfully", async () => {
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: OTHER_USER_ID,
        status: "published",
      });
      mocks.postsQueries.findPendingReport.mockResolvedValue(null);
      mocks.postsQueries.createReport.mockResolvedValue("report-1");

      const result = await service.reportPost(VALID_POST_ID, VALID_USER_ID, {
        reason: "Misleading claims about grading policies",
      });

      expect(result.message.toLowerCase()).toContain("report");
    });
  });
});
