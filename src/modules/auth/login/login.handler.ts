import type { NextFunction, Request, Response } from "express";

import { loginService } from "./login.service.js";
import type { LoginInput } from "./login.types.js";

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

    const user = await loginService.login({ identifier, password });

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
    const user = await loginService.me(req.session.user!.userId);
    req.session.user = user;
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
