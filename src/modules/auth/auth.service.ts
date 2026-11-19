import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../api/errors.js";
import { config } from "../../config.js";
import { authMailer } from "./auth.mailer.js";
import { authQueries } from "../../db/queries/auth.queries.js";
import type { SessionUser } from "./auth.types.js";

export type RegisterInput = {
  username: string;
  emailAddress: string;
  password: string;
  universityDepartmentId: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export class AuthService {
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

  async login(input: LoginInput): Promise<SessionUser> {
    const identifier = input.identifier.trim();

    if (!identifier || !input.password) {
      throw new BadRequestError("Username or email and password are required");
    }

    const [user] = await authQueries.findUserForLogin(identifier);

    if (!user || !(await argon2.verify(user.hashedPassword, input.password))) {
      throw new UnauthorizedError("Invalid username/email or password");
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenError("Verify your signup email before signing in");
    }

    const userEmail = user.emailAddress?.toLowerCase();
    let userRole = user.role ?? "user";
    const isConfiguredAdmin =
      Boolean(userEmail && config.admin.emails.includes(userEmail)) ||
      user.username.toLowerCase() === "admin";
    if (isConfiguredAdmin && userRole !== "admin") {
      await authQueries.setUserRole(user.userId, "admin");
      userRole = "admin";
    }

    return {
      userId: user.userId,
      username: user.username,
      universityDepartmentId: user.universityDepartmentId,
      isVerified: user.isVerified,
      role: userRole,
    };
  }

  async me(userId: string): Promise<SessionUser> {
    const [user] = await authQueries.findUserById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const userEmail = (user as { emailAddress?: string }).emailAddress?.toLowerCase();
    let userRole = user.role ?? "user";
    const isConfiguredAdmin =
      Boolean(userEmail && config.admin.emails.includes(userEmail)) ||
      user.username.toLowerCase() === "admin";
    if (isConfiguredAdmin && userRole !== "admin") {
      await authQueries.setUserRole(user.userId, "admin");
      userRole = "admin";
    }

    return {
      userId: user.userId,
      username: user.username,
      universityDepartmentId: user.universityDepartmentId,
      isVerified: user.isVerified,
      role: userRole,
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

export const authService = new AuthService();
