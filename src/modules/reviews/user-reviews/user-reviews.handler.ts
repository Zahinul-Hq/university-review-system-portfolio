import type { NextFunction, Request, Response } from "express";

import type { ReviewTagRating } from "../reviews.types.js";
import { userReviewService } from "./user-reviews.service.js";

function isReviewTagRating(value: unknown): value is ReviewTagRating {
  return (
    typeof value === "object" &&
    value !== null &&
    "tagId" in value &&
    typeof value.tagId === "string" &&
    "rating" in value &&
    typeof value.rating === "number"
  );
}

export async function listReviewTagsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tags = await userReviewService.getAllTagDetails();
    res.status(200).json({ tags });
  } catch (error) {
    next(error);
  }
}

export async function getReviewStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const hasReviewed =
      await userReviewService.isUserAlreadyReviewedUniversity(userId);
    res.status(200).json({ hasReviewed });
  } catch (error) {
    next(error);
  }
}

export async function createUniversityReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (
      typeof req.body !== "object" ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      res.status(400).json({ error: "Review ratings are required" });
      return;
    }

    const ratings = (req.body as Record<string, unknown>).ratings;
    if (!Array.isArray(ratings) || !ratings.every(isReviewTagRating)) {
      res.status(400).json({
        error: "Ratings must include a tag and numeric rating for each tag",
      });
      return;
    }

    await userReviewService.postUniversityReview(userId, ratings);
    res.status(201).json({ message: "University review submitted" });
  } catch (error) {
    next(error);
  }
}