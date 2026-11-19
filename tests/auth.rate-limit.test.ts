import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  incrementAuthRateLimit: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  config: { session: { secret: "test-session-secret" } },
}));
vi.mock("../src/db/queries/auth.queries.js", () => ({
  authQueries: { incrementAuthRateLimit: mocks.incrementAuthRateLimit },
}));

import { createAuthRateLimit } from "../src/modules/auth/auth.rate-limit.js";

describe("createAuthRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows concurrent requests only up to the configured limit", async () => {
    let hitCount = 0;
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.incrementAuthRateLimit.mockImplementation(async () => ({
      hitCount: ++hitCount,
      expiresAt,
    }));

    const requests = Array.from({ length: 6 }, () => {
      const { request, response, next } = createRequestContext();
      return {
        response,
        next,
        result: createAuthRateLimit({
          bucket: "login",
          limit: 5,
          windowMs: 60_000,
        })(request, response, next),
      };
    });

    await Promise.all(requests.map(({ result }) => result));

    expect(requests.filter(({ next }) => next.mock.calls.length === 1)).toHaveLength(5);
    expect(
      requests.filter(({ response }) => response.status.mock.calls.length === 1),
    ).toHaveLength(1);
    expect(mocks.incrementAuthRateLimit).toHaveBeenCalledTimes(6);
  });

  it("hashes the client address and reports the retry window on rejection", async () => {
    const expiresAt = new Date(Date.now() + 1_500);
    mocks.incrementAuthRateLimit.mockResolvedValue({ hitCount: 6, expiresAt });
    const { request, response, next } = createRequestContext();

    await createAuthRateLimit({
      bucket: "login",
      limit: 5,
      windowMs: 60_000,
    })(request, response, next);

    expect(mocks.incrementAuthRateLimit).toHaveBeenCalledWith(
      "login",
      expect.not.stringContaining("203.0.113.10"),
      60_000,
    );
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "2");
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: "Too many attempts. Try again later.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards database errors to Express", async () => {
    const error = new Error("database unavailable");
    mocks.incrementAuthRateLimit.mockRejectedValue(error);
    const { request, response, next } = createRequestContext();

    await createAuthRateLimit({
      bucket: "login",
      limit: 5,
      windowMs: 60_000,
    })(request, response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

function createRequestContext() {
  const request = {
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.10" },
  } as unknown as Request;
  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;

  return { request, response, next };
}
