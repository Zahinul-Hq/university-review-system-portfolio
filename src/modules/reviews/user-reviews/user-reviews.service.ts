import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../api/errors.js";
import type { ReviewTag, ReviewTagRating } from "../reviews.types.js";
import { reviewQueries } from "../../../db/queries/reviews.queries.js";
import { UUID_REGEX } from "../reviews.validation.js";

export class UserReviewService {
  async isUserAlreadyReviewedUniversity(userId: string): Promise<boolean> {
    return reviewQueries.hasUserReviewed(userId);
  }

  async getAllTagDetails(): Promise<ReviewTag[]> {
    return reviewQueries.listActiveTags();
  }

  async postUniversityReview(
    userId: string,
    tagRatings: ReviewTagRating[],
  ): Promise<void> {
    const eligibility = await reviewQueries.findUserReviewEligibility(userId);
    if (!eligibility) {
      throw new NotFoundError("User account or university affiliation not found");
    }
    if (!eligibility.isVerified) {
      throw new ForbiddenError(
        "Your account must be verified before reviewing a university",
      );
    }
    if (await reviewQueries.hasUserReviewed(userId)) {
      throw new ConflictError("You have already reviewed your university");
    }

    const activeTags = await reviewQueries.listActiveTags();
    if (activeTags.length === 0) {
      throw new BadRequestError("No active review tags are available");
    }

    if (!Array.isArray(tagRatings) || tagRatings.length !== activeTags.length) {
      throw new BadRequestError(
        "Provide a rating from 1 to 5 for every active review tag",
      );
    }

    const submittedTagIds = new Set<string>();
    for (const tagRating of tagRatings) {
      if (
        !tagRating ||
        typeof tagRating.tagId !== "string" ||
        !UUID_REGEX.test(tagRating.tagId)
      ) {
        throw new BadRequestError("Invalid review tag ID format");
      }
      if (
        !Number.isInteger(tagRating.rating) ||
        tagRating.rating < 1 ||
        tagRating.rating > 5
      ) {
        throw new BadRequestError("Ratings must be whole numbers from 1 to 5");
      }
      const normalizedTagId = tagRating.tagId.toLowerCase();
      if (submittedTagIds.has(normalizedTagId)) {
        throw new BadRequestError("Each review tag can only be rated once");
      }
      submittedTagIds.add(normalizedTagId);
    }

    const activeTagIds = new Set(
      activeTags.map((tag) => tag.tagId.toLowerCase()),
    );
    if (
      submittedTagIds.size !== activeTagIds.size ||
      [...submittedTagIds].some((tagId) => !activeTagIds.has(tagId))
    ) {
      throw new BadRequestError(
        "Provide a rating for every active review tag",
      );
    }

    const created = await reviewQueries.createUniversityReview(
      userId,
      tagRatings,
    );
    if (!created) {
      throw new ConflictError("You have already reviewed your university");
    }
  }
}

export const userReviewService = new UserReviewService();
