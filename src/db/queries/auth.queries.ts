import { and, asc, eq, lte, or, sql } from "drizzle-orm";

import { db } from "../index.js";
import {
  departments,
  authRateLimitCounters,
  emailVerificationTokens,
  universityDepartments,
  universities,
  users,
} from "../schema.js";

export const authQueries = {
  listUniversityDepartments() {
    return db
      .select({
        universityDepartmentId: universityDepartments.universityDepartmentId,
        universityId: universities.universityId,
        departmentId: departments.departmentId,
        universityName: universities.name,
        universityShortName: universities.shortName,
        departmentName: departments.name,
        departmentAbbreviation: departments.abbreviation,
      })
      .from(universityDepartments)
      .innerJoin(
        universities,
        eq(universityDepartments.universityId, universities.universityId),
      )
      .innerJoin(
        departments,
        eq(universityDepartments.departmentId, departments.departmentId),
      )
      .where(eq(universityDepartments.isActive, true))
      .orderBy(asc(universities.name), asc(departments.name));
  },

  findExistingUser(username: string, emailAddress: string) {
    return db
      .select({ userId: users.userId })
      .from(users)
      .where(or(eq(users.username, username), eq(users.emailAddress, emailAddress)))
      .limit(1);
  },

  findActiveUniversityDepartment(universityDepartmentId: string) {
    return db
      .select({
        universityDepartmentId: universityDepartments.universityDepartmentId,
      })
      .from(universityDepartments)
      .where(
        and(
          eq(universityDepartments.universityDepartmentId, universityDepartmentId),
          eq(universityDepartments.isActive, true),
        ),
      )
      .limit(1);
  },

  createUser(input: {
    username: string;
    emailAddress: string;
    hashedPassword: string;
    universityDepartmentId: string;
  }) {
    return db
      .insert(users)
      .values({
        ...input,
        isVerified: false,
      })
      .returning({
        userId: users.userId,
        username: users.username,
        universityDepartmentId: users.universityDepartmentId,
        isVerified: users.isVerified,
        role: users.role,
      });
  },

  findUserForLogin(identifier: string) {
    return db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, identifier),
          eq(users.emailAddress, identifier.toLowerCase()),
        ),
      )
      .limit(1);
  },

  findUserForEmailVerification(emailAddress: string) {
    return db
      .select({
        userId: users.userId,
        emailAddress: users.emailAddress,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.emailAddress, emailAddress))
      .limit(1);
  },

  createEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return db.transaction(async (tx) => {
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, userId));

      return tx.insert(emailVerificationTokens).values({
        userId,
        tokenHash,
        expiresAt,
      });
    });
  },

  incrementAuthRateLimit(
    bucket: string,
    clientKeyHash: string,
    windowMs: number,
  ) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowMs);

    return db.transaction(async (tx) => {
      await tx
        .delete(authRateLimitCounters)
        .where(lte(authRateLimitCounters.expiresAt, now));

      const [counter] = await tx
        .insert(authRateLimitCounters)
        .values({
          bucket,
          clientKeyHash,
          hitCount: 1,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            authRateLimitCounters.bucket,
            authRateLimitCounters.clientKeyHash,
          ],
          set: {
            hitCount: sql`${authRateLimitCounters.hitCount} + 1`,
          },
        })
        .returning({
          hitCount: authRateLimitCounters.hitCount,
          expiresAt: authRateLimitCounters.expiresAt,
        });

      return counter;
    });
  },

  consumeEmailVerificationToken(tokenHash: string) {
    return db.transaction(async (tx) => {
      const [token] = await tx
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, tokenHash))
        .limit(1)
        .for("update");

      if (!token) {
        return false;
      }

      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.emailVerificationTokenId, token.emailVerificationTokenId));

      if (token.expiresAt <= new Date()) {
        return false;
      }

      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.userId, token.userId));

      return true;
    });
  },

  findUserById(userId: string) {
    return db
      .select({
        userId: users.userId,
        username: users.username,
        emailAddress: users.emailAddress,
        universityDepartmentId: users.universityDepartmentId,
        isVerified: users.isVerified,
        role: users.role,
      })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
  },

  setUserRole(userId: string, role: string) {
    return db
      .update(users)
      .set({ role })
      .where(eq(users.userId, userId));
  },
};
