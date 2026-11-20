import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

import { BadRequestError, ConflictError } from "../../../api/errors.js";
import { authMailer } from "../auth.mailer.js";
import { authQueries } from "../../../db/queries/auth.queries.js";
import type { RegisterInput } from "./signup.types.js";

export class SignupService {
  async listUniversityDepartments() {
    return authQueries.listUniversityDepartments();
  }

  async register(input: RegisterInput) {
    const username = input.username.trim();
    const emailAddress = input.emailAddress.trim().toLowerCase();
    const universityDepartmentId = input.universityDepartmentId.trim();

    if (!username || !emailAddress || !universityDepartmentId) {
      throw new BadRequestError(
        "Username, email address, and university department are required",
      );
    }

    if (username.length < 6) {
      throw new BadRequestError("Username must be at least 6 characters long");
    }

    if (!/^[A-Za-z0-9._]+$/.test(username)) {
      throw new BadRequestError(
        "Username may contain only letters, numbers, dots, and underscores",
      );
    }

    if (!/[A-Za-z]/.test(username)) {
      throw new BadRequestError("Username must include at least one letter");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      throw new BadRequestError("A valid email address is required");
    }

    if (input.password.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(input.password)) {
      throw new BadRequestError("Password must include an uppercase letter");
    }

    if (!/\d/.test(input.password)) {
      throw new BadRequestError("Password must include a number");
    }

    if (!/[^A-Za-z0-9]/.test(input.password)) {
      throw new BadRequestError("Password must include a special character");
    }

    const [existingUser] = await authQueries.findExistingUser(
      username,
      emailAddress,
    );

    if (existingUser) {
      throw new ConflictError("Username or email address is already in use");
    }

    const [universityDepartment] =
      await authQueries.findActiveUniversityDepartment(universityDepartmentId);

    if (!universityDepartment) {
      throw new BadRequestError(
        "Selected university department does not exist or is inactive",
      );
    }

    authMailer.assertConfigured();

    const hashedPassword = await argon2.hash(input.password);
    const createdUsers = await authQueries
      .createUser({
        username,
        emailAddress,
        hashedPassword,
        universityDepartmentId,
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintViolation(error)) {
          throw new ConflictError(
            "Username or email address is already in use",
          );
        }

        throw error;
      });
    const [createdUser] = createdUsers;

    if (!createdUser) {
      throw new Error("User registration failed");
    }

    await this.sendEmailVerification(createdUser.userId, emailAddress);

    return {
      message: "Account created. Check your email for a verification link.",
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestError("Verification token is required");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const verified = await authQueries.consumeEmailVerificationToken(tokenHash);

    if (!verified) {
      throw new BadRequestError("Verification link is invalid or expired");
    }

    return { message: "Email address verified" };
  }

  async resendEmailVerification(emailAddress: string) {
    const normalizedEmail = emailAddress.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestError("A valid email address is required");
    }

    authMailer.assertConfigured();
    const [user] =
      await authQueries.findUserForEmailVerification(normalizedEmail);

    if (user && !user.emailVerifiedAt) {
      await this.sendEmailVerification(user.userId, user.emailAddress);
    }

    return {
      message:
        "If that address has an unverified account, a verification email has been sent.",
    };
  }

  private async sendEmailVerification(userId: string, emailAddress: string) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await authQueries.createEmailVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );
    await authMailer.sendVerificationEmail(emailAddress, token);
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const signupService = new SignupService();
