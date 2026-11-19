import { Router } from "express";

import { requireAuth } from "../auth/auth.session.js";
import { votesRouter } from "../votes/votes.routes.js";
import {
  createPostHandler,
  deletePostHandler,
  getPostHandler,
  listPostsHandler,
  listTagsHandler,
  reportPostHandler,
} from "./posts.handler.js";
import { createPostRateLimit } from "./posts.rate-limit.js";

export const postsRouter = Router();

const limitCreatePost = createPostRateLimit({
  bucket: "create-post",
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

const limitReport = createPostRateLimit({
  bucket: "report-post",
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

postsRouter.get("/tags", listTagsHandler);
postsRouter.get("/", listPostsHandler);
postsRouter.get("/:postId", getPostHandler);
postsRouter.post("/", requireAuth, limitCreatePost, createPostHandler);
postsRouter.delete("/:postId", requireAuth, deletePostHandler);
postsRouter.use("/:postId/vote", votesRouter);
postsRouter.post("/:postId/report", requireAuth, limitReport, reportPostHandler);
