import type { NextFunction, Request, Response } from "express";

import type { Sentiment } from "./posts.types.js";
import { postsService } from "./posts.service.js";

export async function listTagsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tags = await postsService.listTags();
    res.status(200).json({ tags });
  } catch (error) {
    next(error);
  }
}

export async function listPostsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const universityId = typeof req.query.universityId === "string" ? req.query.universityId : undefined;
    const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
    const tagId = typeof req.query.tagId === "string" ? req.query.tagId : undefined;
    const sentiment = typeof req.query.sentiment === "string" ? (req.query.sentiment as Sentiment) : undefined;
    const sort = req.query.sort === "top" ? "top" : req.query.sort === "newest" ? "newest" : undefined;

    const currentUserId = req.session?.user?.userId;

    const result = await postsService.listPosts(
      {
        page,
        limit,
        universityId,
        departmentId,
        tagId,
        sentiment,
        sort,
      },
      currentUserId,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPostHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const postId = Array.isArray(req.params.postId)
      ? req.params.postId[0]
      : req.params.postId;
    const currentUserId = req.session?.user?.userId;
    const post = await postsService.getPostById(postId, currentUserId);
    res.status(200).json({ post });
  } catch (error) {
    next(error);
  }
}

export async function createPostHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentUserId = req.session?.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Post data is required" });
      return;
    }

    const { content, sentiment, tagIds } = req.body as {
      content?: unknown;
      sentiment?: unknown;
      tagIds?: unknown;
    };

    if (typeof content !== "string" || typeof sentiment !== "string") {
      res.status(400).json({ error: "Content and sentiment are required" });
      return;
    }

    const post = await postsService.createPost(currentUserId, {
      content,
      sentiment: sentiment as Sentiment,
      tagIds: Array.isArray(tagIds) ? (tagIds as string[]) : undefined,
    });

    res.status(201).json({ post, message: "Review published successfully" });
  } catch (error) {
    next(error);
  }
}

export async function deletePostHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentUserId = req.session?.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const postId = Array.isArray(req.params.postId)
      ? req.params.postId[0]
      : req.params.postId;
    const result = await postsService.deletePost(postId, currentUserId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export { votePostHandler } from "../votes/votes.handler.js";

export async function reportPostHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentUserId = req.session?.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Report details are required" });
      return;
    }

    const { reason, description } = req.body as {
      reason?: unknown;
      description?: unknown;
    };

    if (typeof reason !== "string") {
      res.status(400).json({ error: "Report reason is required" });
      return;
    }

    const postId = Array.isArray(req.params.postId)
      ? req.params.postId[0]
      : req.params.postId;
    const result = await postsService.reportPost(postId, currentUserId, {
      reason,
      description: typeof description === "string" ? description : undefined,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
