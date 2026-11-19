import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  votesService: {
    votePost: vi.fn(),
  },
}));

vi.mock("../src/modules/votes/votes.service.js", () => ({
  votesService: mocks.votesService,
}));

import { votePostHandler } from "../src/modules/votes/votes.handler.js";

function createRequestContext(overrides: Partial<Request> = {}) {
  const request = {
    params: { postId: "33333333-3333-4333-8333-333333333333" },
    body: { voteType: 1 },
    session: { user: { userId: "11111111-1111-4111-8111-111111111111" } },
    ...overrides,
  } as unknown as Request;

  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { request, response, next };
}

describe("votePostHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { request, response, next } = createRequestContext({
      session: {} as unknown as Request["session"],
    });

    await votePostHandler(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("returns 400 when body is missing or invalid", async () => {
    const { request, response, next } = createRequestContext({
      body: undefined,
    });

    await votePostHandler(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Vote data is required" });
  });

  it("returns 400 when voteType is not 1, -1, or 0", async () => {
    const { request, response, next } = createRequestContext({
      body: { voteType: 99 },
    });

    await votePostHandler(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Vote type must be 1, -1, or 0" });
  });

  it("calls votesService.votePost and returns 200 with summary", async () => {
    const summary = {
      score: 1,
      upvotes: 1,
      downvotes: 0,
      userVote: 1 as const,
    };
    mocks.votesService.votePost.mockResolvedValue(summary);

    const { request, response, next } = createRequestContext();

    await votePostHandler(request, response, next);

    expect(mocks.votesService.votePost).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
      { voteType: 1 },
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(summary);
  });

  it("forwards service errors to next", async () => {
    const error = new Error("Service failed");
    mocks.votesService.votePost.mockRejectedValue(error);

    const { request, response, next } = createRequestContext();

    await votePostHandler(request, response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
