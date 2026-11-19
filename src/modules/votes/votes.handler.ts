import type { NextFunction, Request, Response } from "express";

import { votesService } from "./votes.service.js";

export async function votePostHandler(
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
      res.status(400).json({ error: "Vote data is required" });
      return;
    }

    const { voteType } = req.body as { voteType?: unknown };
    if (typeof voteType !== "number" || ![1, -1, 0].includes(voteType)) {
      res.status(400).json({ error: "Vote type must be 1, -1, or 0" });
      return;
    }

    const postId = Array.isArray(req.params.postId)
      ? req.params.postId[0]
      : req.params.postId;
    const summary = await votesService.votePost(postId, currentUserId, {
      voteType: voteType as 1 | -1 | 0,
    });

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
