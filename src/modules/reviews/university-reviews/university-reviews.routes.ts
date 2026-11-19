import { Router } from "express";

import {
  getUniversityReviewDetailsHandler,
  listUniversityReviewsHandler,
} from "./university-reviews.handler.js";

export const universityReviewsRouter = Router();

universityReviewsRouter.get("/", listUniversityReviewsHandler);
universityReviewsRouter.get("/:universityId", getUniversityReviewDetailsHandler);
