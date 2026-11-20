import type { NextFunction, Request, Response } from "express";

import { signupService } from "./signup.service.js";
import type { RegisterInput } from "./signup.types.js";

export async function universityDepartmentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universityDepartments =
      await signupService.listUniversityDepartments();
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

    const result = await signupService.register({
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

    const result = await signupService.verifyEmail(token);
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

    const result = await signupService.resendEmailVerification(emailAddress);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
