export type AdminDashboardMetrics = {
  totalUsers: number;
  verifiedStudents: number;
  totalReviews: number;
  publishedReviews: number;
  hiddenReviews: number;
  pendingReports: number;
  totalUniversities: number;
  totalDepartments: number;
  totalTags: number;
};

export type AdminReportItem = {
  reportId: string;
  postId: string;
  postContent: string;
  postStatus: string;
  postSentiment: string;
  reporterUserId: string;
  reporterUsername: string;
  authorUniversityName: string;
  authorDepartmentName: string;
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
};

export type AdminPostItem = {
  postId: string;
  content: string;
  sentiment: string;
  status: string;
  authorUserId: string;
  authorUsername: string;
  authorUniversityName: string;
  authorDepartmentName: string;
  authorVerified: boolean;
  score: number;
  upvotes: number;
  downvotes: number;
  reportsCount: number;
  createdAt: Date;
};

export type AdminUserItem = {
  userId: string;
  username: string;
  emailAddress: string;
  eduMailAddress: string | null;
  isVerified: boolean;
  emailVerifiedAt: Date | null;
  role: string;
  universityName: string;
  departmentName: string;
  postCount: number;
  createdAt: Date;
};

export type AdminUniversityItem = {
  universityId: string;
  name: string;
  shortName: string;
  departmentsCount?: number;
};

export type AdminDepartmentItem = {
  departmentId: string;
  name: string;
  abbreviation: string;
  departmentType: string;
};

export type AdminTagItem = {
  tagId: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
};

export type ListReportsQuery = {
  status?: string;
  page?: number | string;
  limit?: number | string;
};

export type ListPostsAdminQuery = {
  status?: string;
  sentiment?: string;
  search?: string;
  universityId?: string;
  page?: number | string;
  limit?: number | string;
};

export type ListUsersAdminQuery = {
  search?: string;
  isVerified?: boolean | string;
  role?: string;
  page?: number | string;
  limit?: number | string;
};

export type UpdateReportStatusInput = {
  status: "pending" | "reviewed" | "dismissed" | "actioned";
};

export type UpdatePostStatusInput = {
  status: "published" | "hidden";
};

export type UpdateUserVerificationInput = {
  isVerified: boolean;
};

export type UpdateUserRoleInput = {
  role: "user" | "admin";
};

export type CreateUniversityInput = {
  name: string;
  shortName: string;
};

export type UpdateUniversityInput = {
  name?: string;
  shortName?: string;
};

export type CreateDepartmentInput = {
  name: string;
  abbreviation: string;
  departmentType: string;
};

export type UpdateDepartmentInput = {
  name?: string;
  abbreviation?: string;
  departmentType?: string;
};

export type CreateTagInput = {
  name: string;
  description: string;
  displayOrder: number;
  isActive?: boolean;
};

export type UpdateTagInput = {
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
};
