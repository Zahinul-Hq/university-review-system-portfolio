import { Router } from "express";

import { createAuthRateLimit } from "../auth.rate-limit.js";
import {
  registerHandler,
  resendEmailVerificationHandler,
  universityDepartmentsHandler,
  verifyEmailHandler,
} from "./signup.handler.js";

export const signupRouter = Router();

const limitRegistration = createAuthRateLimit({
  bucket: "register",
  limit: 5,
  windowMs: 60 * 60 * 1000,
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

signupRouter.get("/university-departments", universityDepartmentsHandler);
signupRouter.post("/register", limitRegistration, registerHandler);
signupRouter.post("/verify-email", limitEmailVerification, verifyEmailHandler);
signupRouter.post(
  "/resend-email-verification",
  limitVerificationResend,
  resendEmailVerificationHandler,
);
