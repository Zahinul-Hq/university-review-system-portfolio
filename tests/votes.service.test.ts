import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postsQueries: {
    findUserAffiliation: vi.fn(),
    findPostAuthor: vi.fn(),
  },
  votesQueries: {
    upsertVote: vi.fn(),
    getVoteSummary: vi.fn(),
  },
}));

vi.mock("../src/db/queries/posts.queries.js", () => ({
  postsQueries: mocks.postsQueries,
}));

vi.mock("../src/db/queries/votes.queries.js", () => ({
  votesQueries: mocks.votesQueries,
}));

import { VotesService } from "../src/modules/votes/votes.service.js";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const VALID_POST_ID = "33333333-3333-4333-8333-333333333333";

describe("VotesService", () => {
  const service = new VotesService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("votePost", () => {
    it("rejects invalid post ID format", async () => {
      await expect(
        service.votePost("invalid-id", VALID_USER_ID, { voteType: 1 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects invalid voteType", async () => {
      await expect(
        // @ts-expect-error invalid voteType
        service.votePost(VALID_POST_ID, VALID_USER_ID, { voteType: 2 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects voting when user account is not found", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue(null);

      await expect(
        service.votePost(VALID_POST_ID, VALID_USER_ID, { voteType: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects voting when user is unverified", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: null,
      });

      await expect(
        service.votePost(VALID_POST_ID, VALID_USER_ID, { voteType: 1 }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects voting when post is not found or not published", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: new Date(),
      });
      mocks.postsQueries.findPostAuthor.mockResolvedValue(null);

      await expect(
        service.votePost(VALID_POST_ID, VALID_USER_ID, { voteType: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects voting on one's own post", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: new Date(),
      });
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: VALID_USER_ID,
        status: "published",
      });

      await expect(
        service.votePost(VALID_POST_ID, VALID_USER_ID, { voteType: 1 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("records valid vote and returns updated summary", async () => {
      mocks.postsQueries.findUserAffiliation.mockResolvedValue({
        userId: VALID_USER_ID,
        emailVerifiedAt: new Date(),
      });
      mocks.postsQueries.findPostAuthor.mockResolvedValue({
        postId: VALID_POST_ID,
        userId: OTHER_USER_ID,
        status: "published",
      });
      mocks.votesQueries.upsertVote.mockResolvedValue(undefined);
      mocks.votesQueries.getVoteSummary.mockResolvedValue({
        score: 1,
        upvotes: 1,
        downvotes: 0,
        userVote: 1,
      });

      const summary = await service.votePost(VALID_POST_ID, VALID_USER_ID, {
        voteType: 1,
      });

      expect(summary.score).toBe(1);
      expect(summary.userVote).toBe(1);
      expect(mocks.votesQueries.upsertVote).toHaveBeenCalledWith(
        VALID_POST_ID,
        VALID_USER_ID,
        1,
      );
      expect(mocks.votesQueries.getVoteSummary).toHaveBeenCalledWith(
        VALID_POST_ID,
        VALID_USER_ID,
      );
    });
  });

  describe("getVoteSummary", () => {
    it("rejects invalid post ID format", async () => {
      await expect(
        service.getVoteSummary("invalid-id"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("returns summary for valid post ID", async () => {
      mocks.votesQueries.getVoteSummary.mockResolvedValue({
        score: 5,
        upvotes: 6,
        downvotes: 1,
        userVote: null,
      });

      const summary = await service.getVoteSummary(VALID_POST_ID);
      expect(summary.score).toBe(5);
      expect(mocks.votesQueries.getVoteSummary).toHaveBeenCalledWith(
        VALID_POST_ID,
        undefined,
      );
    });
  });
});
