import { Router } from "express";

import {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
  resendEmailVerificationHandler,
  universityDepartmentsHandler,
  verifyEmailHandler,
} from "./auth.handler.js";
import { createAuthRateLimit } from "./auth.rate-limit.js";
import { requireAuth } from "./auth.session.js";

export const authRouter = Router();

const limitRegistration = createAuthRateLimit({
  bucket: "register",
  limit: 5,
  windowMs: 60 * 60 * 1000,
});
const limitLogin = createAuthRateLimit({
  bucket: "login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});
const limitEmailVerification = createAuthRateLimit({
  bucket: "email-verification",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});
const limitVerificationResend = createAuthRateLimit({
  bucket: "verification-resend",
  limit: 3,
  windowMs: 60 * 60 * 1000,
});

authRouter.get("/university-departments", universityDepartmentsHandler);
authRouter.post("/register", limitRegistration, registerHandler);
authRouter.post("/verify-email", limitEmailVerification, verifyEmailHandler);
authRouter.post(
  "/resend-email-verification",
  limitVerificationResend,
  resendEmailVerificationHandler,
);
authRouter.post("/login", limitLogin, loginHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
