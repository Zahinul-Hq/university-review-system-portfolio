import { Router } from "express";

import { createAuthRateLimit } from "../auth.rate-limit.js";
import { requireAuth } from "../auth.session.js";
import {
  loginHandler,
  logoutHandler,
  meHandler,
} from "./login.handler.js";

export const loginRouter = Router();

const limitLogin = createAuthRateLimit({
  bucket: "login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

loginRouter.post("/login", limitLogin, loginHandler);
loginRouter.post("/logout", logoutHandler);
loginRouter.get("/me", requireAuth, meHandler);
