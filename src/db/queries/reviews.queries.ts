import { asc, eq, sql } from "drizzle-orm";

import { db } from "../index.js";
import {
  tags,
  universities,
  universityDepartments,
  universityReviewRatings,
  universityReviews,
  users,
} from "../schema.js";
import type {
  ReviewTag,
  ReviewTagRating,
  UniversityReviewSummary,
  UniversityTagAverage,
} from "../../modules/reviews/reviews.types.js";

export const reviewQueries = {
  async listActiveTags(): Promise<ReviewTag[]> {
    return db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        description: tags.description,
      })
      .from(tags)
      .where(eq(tags.isActive, true))
      .orderBy(asc(tags.displayOrder));
  },

  async findUserReviewEligibility(userId: string) {
    const [user] = await db
      .select({
        isVerified: users.isVerified,
        universityId: universityDepartments.universityId,
      })
      .from(users)
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .where(eq(users.userId, userId))
      .limit(1);

    return user ?? null;
  },

  async hasUserReviewed(userId: string): Promise<boolean> {
    const [review] = await db
      .select({ reviewId: universityReviews.reviewId })
      .from(universityReviews)
      .where(eq(universityReviews.userId, userId))
      .limit(1);

    return Boolean(review);
  },

  async findUniversity(universityId: string) {
    const [university] = await db
      .select({ universityId: universities.universityId })
      .from(universities)
      .where(eq(universities.universityId, universityId))
      .limit(1);

    return university ?? null;
  },

  async listUniversityTagAverages(
    universityId: string,
  ): Promise<UniversityTagAverage[]> {
    const ratingsByTag = db
      .select({
        tagId: universityReviewRatings.tagId,
        averageRating:
          sql<number>`avg(${universityReviewRatings.rating})::float8`.as(
            "average_rating",
          ),
        reviewCount: sql<number>`count(*)::int`.as("review_count"),
      })
      .from(universityReviewRatings)
      .innerJoin(
        universityReviews,
        eq(universityReviewRatings.reviewId, universityReviews.reviewId),
      )
      .innerJoin(users, eq(universityReviews.userId, users.userId))
      .innerJoin(
        universityDepartments,
        eq(users.universityDepartmentId, universityDepartments.universityDepartmentId),
      )
      .where(eq(universityDepartments.universityId, universityId))
      .groupBy(universityReviewRatings.tagId)
      .as("ratings_by_tag");

    return db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        description: tags.description,
        averageRating: ratingsByTag.averageRating,
        reviewCount: sql<number>`coalesce(${ratingsByTag.reviewCount}, 0)::int`,
      })
      .from(tags)
      .leftJoin(ratingsByTag, eq(tags.tagId, ratingsByTag.tagId))
      .where(eq(tags.isActive, true))
      .orderBy(asc(tags.displayOrder));
  },

  async listUniversitySummaries(): Promise<UniversityReviewSummary[]> {
    return db
      .select({
        universityId: universities.universityId,
        name: universities.name,
        shortName: universities.shortName,
        averageRating:
          sql<number | null>`avg(${universityReviewRatings.rating})::float8`,
        reviewCount:
          sql<number>`count(distinct ${universityReviews.userId})::int`,
      })
      .from(universities)
      .leftJoin(
        universityDepartments,
        eq(universities.universityId, universityDepartments.universityId),
      )
      .leftJoin(
        users,
        eq(universityDepartments.universityDepartmentId, users.universityDepartmentId),
      )
      .leftJoin(universityReviews, eq(users.userId, universityReviews.userId))
      .leftJoin(
        universityReviewRatings,
        eq(universityReviews.reviewId, universityReviewRatings.reviewId),
      )
      .groupBy(
        universities.universityId,
        universities.name,
        universities.shortName,
      )
      .orderBy(asc(universities.name));
  },

  async createUniversityReview(
    userId: string,
    tagRatings: ReviewTagRating[],
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [review] = await tx
        .insert(universityReviews)
        .values({ userId })
        .onConflictDoNothing({ target: universityReviews.userId })
        .returning({ reviewId: universityReviews.reviewId });

      if (!review) {
        return false;
      }

      await tx.insert(universityReviewRatings).values(
        tagRatings.map(({ tagId, rating }) => ({
          reviewId: review.reviewId,
          tagId,
          rating,
        })),
      );

      return true;
    });
  },
};
