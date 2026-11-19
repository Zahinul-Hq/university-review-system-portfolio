export type ReviewTagRating = {
  tagId: string;
  rating: number;
};

export type ReviewTag = {
  tagId: string;
  name: string;
  description: string;
};

export type UniversityTagAverage = ReviewTag & {
  averageRating: number | null;
  reviewCount: number;
};

export type UniversityReviewSummary = {
  universityId: string;
  name: string;
  shortName: string;
  averageRating: number | null;
  reviewCount: number;
};
