import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { SessionData } from "express-session";

export const universities = pgTable("university", {
  universityId: uuid("university_id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  shortName: varchar("short_name").notNull(),
});

export const departments = pgTable("department", {
  departmentId: uuid("department_id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  abbreviation: varchar("abbreviation").notNull(),
  departmentType: varchar("department_type").notNull(),
});

export const universityDepartments = pgTable("university_department", {
  universityDepartmentId: uuid("university_department_id")
    .primaryKey()
    .defaultRandom(),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universities.universityId),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.departmentId),
  isActive: boolean("is_active").notNull(),
});

export const users = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    universityDepartmentId: uuid("university_department_id")
      .notNull()
      .references(() => universityDepartments.universityDepartmentId),
    username: varchar("username").notNull(),
    emailAddress: varchar("email_address").notNull(),
    eduMailAddress: varchar("edu_mail_address"),
    hashedPassword: varchar("hashed_password").notNull(),
    emailVerifiedAt: timestamp("email_verified_at"),
    isVerified: boolean("is_verified").notNull().default(false),
    role: varchar("role").notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("users_username_unique").on(table.username),
    unique("users_email_address_unique").on(table.emailAddress),
    unique("users_edu_mail_address_unique").on(table.eduMailAddress),
    index("users_role_idx").on(table.role),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    emailVerificationTokenId: uuid("email_verification_token_id")
      .primaryKey()
      .defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("email_verification_tokens_token_hash_unique").on(table.tokenHash),
    index("email_verification_tokens_user_id_idx").on(table.userId),
  ],
);

export const webSessions = pgTable(
  "web_sessions",
  {
    sessionId: varchar("session_id").primaryKey(),
    sessionData: jsonb("session_data").$type<SessionData>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("web_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const authRateLimitCounters = pgTable(
  "auth_rate_limit_counters",
  {
    bucket: varchar("bucket").notNull(),
    clientKeyHash: varchar("client_key_hash").notNull(),
    hitCount: integer("hit_count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucket, table.clientKeyHash] }),
    index("auth_rate_limit_counters_expires_at_idx").on(table.expiresAt),
  ],
);

export const tags = pgTable("tags", {
  tagId: uuid("tag_id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull(),
  displayOrder: integer("display_order").notNull(),
});

export const universityReviews = pgTable(
  "university_reviews",
  {
    reviewId: uuid("review_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("university_reviews_user_id_unique").on(table.userId)],
);

export const universityReviewRatings = pgTable(
  "university_review_ratings",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => universityReviews.reviewId),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.tagId),
    rating: smallint("rating").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.tagId] }),
    check(
      "university_review_ratings_rating_check",
      sql`${table.rating} between 1 and 5`,
    ),
  ],
);

export const posts = pgTable(
  "posts",
  {
    postId: uuid("post_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    content: text("content").notNull(),
    sentiment: varchar("sentiment").notNull(),
    status: varchar("status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("posts_user_id_idx").on(table.userId),
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_status_idx").on(table.status),
  ],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.postId),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.tagId),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

export const postVotes = pgTable(
  "post_votes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.postId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    voteType: smallint("vote_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const reports = pgTable(
  "reports",
  {
    reportId: uuid("report_id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.postId),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.userId),
    reason: varchar("reason").notNull(),
    description: text("description").notNull(),
    status: varchar("status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reports_post_id_idx").on(table.postId),
    index("reports_reporter_user_id_idx").on(table.reporterUserId),
    index("reports_status_idx").on(table.status),
  ],
);

export type NewUniversity = typeof universities.$inferInsert;
export type NewDepartment = typeof departments.$inferInsert;
export type NewUniversityDepartment = typeof universityDepartments.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewTag = typeof tags.$inferInsert;
export type NewUniversityReview = typeof universityReviews.$inferInsert;
export type NewUniversityReviewRating =
  typeof universityReviewRatings.$inferInsert;
export type NewPost = typeof posts.$inferInsert;
export type NewPostTag = typeof postTags.$inferInsert;
export type NewPostVote = typeof postVotes.$inferInsert;
export type NewReport = typeof reports.$inferInsert;
