import { createHmac } from "node:crypto";
import type { RequestHandler } from "express";

import { config } from "../../config.js";
import { authQueries } from "../../db/queries/auth.queries.js";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
};

export function createPostRateLimit({
  bucket,
  limit,
  windowMs,
}: RateLimitOptions): RequestHandler {
  return async function postRateLimit(req, res, next) {
    try {
      const clientAddress = req.ip || req.socket.remoteAddress || "unknown";
      const clientKeyHash = createHmac("sha256", config.session.secret)
        .update(clientAddress)
        .digest("hex");
      const counter = await authQueries.incrementAuthRateLimit(
        bucket,
        clientKeyHash,
        windowMs,
      );

      if (counter.hitCount <= limit) {
        next();
        return;
      }

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((counter.expiresAt.getTime() - Date.now()) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: "Too many attempts. Try again later." });
    } catch (error) {
      next(error);
    }
  };
}
