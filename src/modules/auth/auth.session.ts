import type { NextFunction, Request, Response } from "express";

import type { SessionUser } from "./auth.types.js";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin privileges required" });
    return;
  }

  next();
}
