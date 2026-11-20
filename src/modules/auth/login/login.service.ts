import argon2 from "argon2";

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../../api/errors.js";
import { config } from "../../../config.js";
import { authQueries } from "../../../db/queries/auth.queries.js";
import type { SessionUser } from "../auth.types.js";
import type { LoginInput } from "./login.types.js";

export class LoginService {
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
}

export const loginService = new LoginService();
