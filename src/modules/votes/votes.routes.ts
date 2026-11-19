import { Router } from "express";

import { requireAuth } from "../auth/auth.session.js";
import { votePostHandler } from "./votes.handler.js";
import { createVotesRateLimit } from "./votes.rate-limit.js";

export const votesRouter = Router({ mergeParams: true });

const limitVote = createVotesRateLimit({
  bucket: "vote-post",
  limit: 60,
  windowMs: 60 * 1000,
});

votesRouter.post("/", requireAuth, limitVote, votePostHandler);
votesRouter.post("/:postId", requireAuth, limitVote, votePostHandler);
votesRouter.post("/:postId/vote", requireAuth, limitVote, votePostHandler);
