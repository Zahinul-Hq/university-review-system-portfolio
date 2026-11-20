import { Router } from "express";

import { loginRouter } from "./login/login.routes.js";
import { signupRouter } from "./signup/signup.routes.js";

export const authRouter = Router();

authRouter.use("/", signupRouter);
authRouter.use("/", loginRouter);
