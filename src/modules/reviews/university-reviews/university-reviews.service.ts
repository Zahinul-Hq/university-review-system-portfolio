import { BadRequestError, NotFoundError } from "../../../api/errors.js";
import { reviewQueries } from "../../../db/queries/reviews.queries.js";
import type {
  UniversityReviewSummary,
  UniversityTagAverage,
} from "../reviews.types.js";
import { UUID_REGEX } from "../reviews.validation.js";

export class UniversityReviewService {
  async listUniversities(): Promise<UniversityReviewSummary[]> {
    return reviewQueries.listUniversitySummaries();
  }

  async getUniversityTagAverages(
    universityId: string,
  ): Promise<UniversityTagAverage[]> {
    if (!UUID_REGEX.test(universityId)) {
      throw new BadRequestError("Invalid university ID format");
    }

    const university = await reviewQueries.findUniversity(universityId);
    if (!university) {
      throw new NotFoundError("University not found");
    }

    return reviewQueries.listUniversityTagAverages(universityId);
  }
}

export const universityReviewService = new UniversityReviewService();
