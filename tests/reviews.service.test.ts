import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reviewQueries: {
    hasUserReviewed: vi.fn(),
    listActiveTags: vi.fn(),
    findUserReviewEligibility: vi.fn(),
    createUniversityReview: vi.fn(),
    findUniversity: vi.fn(),
    listUniversityTagAverages: vi.fn(),
    listUniversitySummaries: vi.fn(),
  },
}));

vi.mock("../src/db/queries/reviews.queries.js", () => ({
  reviewQueries: mocks.reviewQueries,
}));

import { UniversityReviewService } from "../src/modules/reviews/university-reviews/university-reviews.service.js";
import { UserReviewService } from "../src/modules/reviews/user-reviews/user-reviews.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UNIVERSITY_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_TAG_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_TAG_ID = "44444444-4444-4444-8444-444444444444";

describe("UserReviewService", () => {
  const service = new UserReviewService();
  const allRatings = [
    { tagId: FIRST_TAG_ID, rating: 4 },
    { tagId: SECOND_TAG_ID, rating: 5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviewQueries.findUserReviewEligibility.mockResolvedValue({
      isVerified: true,
      universityId: UNIVERSITY_ID,
    });
    mocks.reviewQueries.hasUserReviewed.mockResolvedValue(false);
    mocks.reviewQueries.listActiveTags.mockResolvedValue([
      { tagId: FIRST_TAG_ID, name: "Academics", description: "" },
      { tagId: SECOND_TAG_ID, name: "Faculty", description: "" },
    ]);
    mocks.reviewQueries.createUniversityReview.mockResolvedValue(true);
  });

  it("only permits verified users to submit reviews", async () => {
    mocks.reviewQueries.findUserReviewEligibility.mockResolvedValue({
      isVerified: false,
      universityId: UNIVERSITY_ID,
    });

    await expect(
      service.postUniversityReview(USER_ID, allRatings),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.reviewQueries.createUniversityReview).not.toHaveBeenCalled();
  });

  it("requires a rating from 1 to 5 for every active tag", async () => {
    await expect(
      service.postUniversityReview(USER_ID, [
        { tagId: FIRST_TAG_ID, rating: 4 },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.postUniversityReview(USER_ID, [
        { tagId: FIRST_TAG_ID, rating: 6 },
        { tagId: SECOND_TAG_ID, rating: 5 },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.reviewQueries.createUniversityReview).not.toHaveBeenCalled();
  });

  it("rejects a second review by the same user", async () => {
    mocks.reviewQueries.hasUserReviewed.mockResolvedValue(true);

    await expect(
      service.postUniversityReview(USER_ID, allRatings),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.reviewQueries.createUniversityReview).not.toHaveBeenCalled();
  });

  it("reports a conflict if another request creates the review first", async () => {
    mocks.reviewQueries.createUniversityReview.mockResolvedValue(false);

    await expect(
      service.postUniversityReview(USER_ID, allRatings),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("stores the complete set of tag ratings for the verified user's university", async () => {
    await service.postUniversityReview(USER_ID, allRatings);

    expect(mocks.reviewQueries.createUniversityReview).toHaveBeenCalledWith(
      USER_ID,
      allRatings,
    );
  });
});

describe("UniversityReviewService", () => {
  const service = new UniversityReviewService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists university-wide average ratings and distinct rater counts", async () => {
    const universitySummaries = [
      {
        universityId: UNIVERSITY_ID,
        name: "North University",
        shortName: "NU",
        averageRating: 4.2,
        reviewCount: 12,
      },
    ];
    mocks.reviewQueries.listUniversitySummaries.mockResolvedValue(
      universitySummaries,
    );

    await expect(service.listUniversities()).resolves.toEqual(
      universitySummaries,
    );
  });

  it("returns per-category averages for an existing university", async () => {
    const tagAverages = [
      {
        tagId: FIRST_TAG_ID,
        name: "Academics",
        description: "",
        averageRating: 4,
        reviewCount: 2,
      },
    ];
    mocks.reviewQueries.findUniversity.mockResolvedValue({
      universityId: UNIVERSITY_ID,
    });
    mocks.reviewQueries.listUniversityTagAverages.mockResolvedValue(tagAverages);

    await expect(
      service.getUniversityTagAverages(UNIVERSITY_ID),
    ).resolves.toEqual(tagAverages);
  });

  it("rejects malformed or unknown university IDs", async () => {
    await expect(
      service.getUniversityTagAverages("invalid"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.reviewQueries.findUniversity).not.toHaveBeenCalled();

    mocks.reviewQueries.findUniversity.mockResolvedValue(null);
    await expect(
      service.getUniversityTagAverages(UNIVERSITY_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.reviewQueries.listUniversityTagAverages).not.toHaveBeenCalled();
  });
});
