import { Router } from "express";

import { universityReviewsRouter } from "./university-reviews/university-reviews.routes.js";
import { userReviewsRouter } from "./user-reviews/user-reviews.routes.js";

export const reviewsRouter = Router();

reviewsRouter.use("/", userReviewsRouter);
reviewsRouter.use("/universities", universityReviewsRouter);