import { Router } from "express";

import { requireAuth } from "../../auth/auth.session.js";
import {
  createUniversityReviewHandler,
  getReviewStatusHandler,
  listReviewTagsHandler,
} from "./user-reviews.handler.js";

export const userReviewsRouter = Router();

userReviewsRouter.get("/tags", listReviewTagsHandler);
userReviewsRouter.get("/me", requireAuth, getReviewStatusHandler);
userReviewsRouter.post("/", requireAuth, createUniversityReviewHandler);
