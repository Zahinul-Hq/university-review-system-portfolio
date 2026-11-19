import type { VoteInput, VoteSummary, VoteType } from "../votes/votes.types.js";

export type { VoteInput, VoteSummary, VoteType };

export type Sentiment = "positive" | "neutral" | "negative";

export type PostStatus = "published" | "flagged" | "archived";

export type PostTagItem = {
  tagId: string;
  name: string;
  description: string;
  displayOrder: number;
};

export type UniversitySummary = {
  universityId: string;
  name: string;
  shortName: string;
};

export type DepartmentSummary = {
  departmentId: string;
  name: string;
  abbreviation: string;
};

export type PostDetail = {
  postId: string;
  content: string;
  sentiment: Sentiment;
  status: string;
  createdAt: string;
  updatedAt: string;
  university: UniversitySummary;
  department: DepartmentSummary;
  authorVerified: boolean;
  tags: { tagId: string; name: string }[];
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: 1 | -1 | null;
  isAuthor: boolean;
};

export type CreatePostInput = {
  content: string;
  sentiment: Sentiment;
  tagIds?: string[];
};

export type ReportInput = {
  reason: string;
  description?: string;
};

export type ListPostsQuery = {
  page?: number;
  limit?: number;
  universityId?: string;
  departmentId?: string;
  tagId?: string;
  sentiment?: Sentiment;
  sort?: "newest" | "top";
};

export type PaginatedPostsResult = {
  posts: PostDetail[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
