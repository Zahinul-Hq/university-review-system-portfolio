import type { NextFunction, Request, Response } from "express";

import { universityReviewService } from "./university-reviews.service.js";

export async function listUniversityReviewsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universities = await universityReviewService.listUniversities();
    res.status(200).json({ universities });
  } catch (error) {
    next(error);
  }
}

export async function getUniversityReviewDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universityId = Array.isArray(req.params.universityId)
      ? req.params.universityId[0]
      : req.params.universityId;
    const tags =
      await universityReviewService.getUniversityTagAverages(universityId);
    res.status(200).json({ universityId, tags });
  } catch (error) {
    next(error);
  }
}
