import type { NextFunction, Request, Response } from "express";

import { authService, type LoginInput, type RegisterInput } from "./auth.service.js";

export async function universityDepartmentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universityDepartments = await authService.listUniversityDepartments();
    res.status(200).json({ universityDepartments });
  } catch (error) {
    next(error);
  }
}

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Registration details are required" });
      return;
    }

    const { username, emailAddress, password, universityDepartmentId } =
      req.body as Partial<RegisterInput>;

    if (
      typeof username !== "string" ||
      typeof emailAddress !== "string" ||
      typeof password !== "string" ||
      typeof universityDepartmentId !== "string"
    ) {
      res.status(400).json({
        error:
          "Username, email address, password, and university department are required",
      });
      return;
    }

    const result = await authService.register({
      username,
      emailAddress,
      password,
      universityDepartmentId,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Verification token is required" });
      return;
    }

    const { token } = req.body as { token?: unknown };
    if (typeof token !== "string") {
      res.status(400).json({ error: "Verification token is required" });
      return;
    }

    const result = await authService.verifyEmail(token);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function resendEmailVerificationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Email address is required" });
      return;
    }

    const { emailAddress } = req.body as { emailAddress?: unknown };
    if (typeof emailAddress !== "string") {
      res.status(400).json({ error: "Email address is required" });
      return;
    }

    const result = await authService.resendEmailVerification(emailAddress);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "Login details are required" });
      return;
    }

    const { identifier, password } = req.body as Partial<LoginInput>;

    if (typeof identifier !== "string" || typeof password !== "string") {
      res.status(400).json({
        error: "Username or email and password are required",
      });
      return;
    }

    const user = await authService.login({ identifier, password });

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    req.session.user = user;

    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(req: Request, res: Response) {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ error: "Unable to log out" });
      return;
    }

    res.status(200).json({ message: "Logged out" });
  });
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await authService.me(req.session.user!.userId);
    req.session.user = user;
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
