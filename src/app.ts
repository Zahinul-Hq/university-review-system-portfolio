import express from "express";
import session from "express-session";

import { middlewareErrorHandler, middlewareLogResponse } from "./api/middleware.js";
import { PostgresSessionStore } from "./api/postgres-session-store.js";
import { config } from "./config.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { reviewsRouter } from "./modules/reviews/reviews.routes.js";
import { scoreSystemRouter } from "./modules/scoreSystem/scoreSystem.routes.js";
import { votesRouter } from "./modules/votes/votes.routes.js";
import path from "node:path";
export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(middlewareLogResponse);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      store: new PostgresSessionStore(),
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.api.platform === "prod",
        maxAge: config.session.maxAge,
      },
    }),
  );

  app.get("/api", (_req, res) => {
    res.json({ status: "ok", service: "Chirpy API" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/votes", votesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/scores", scoreSystemRouter);
  const publicDirectory = path.resolve(process.cwd(), "public");
  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });
  app.use("/app", express.static(publicDirectory));
  app.use(express.static(publicDirectory));
  app.use(middlewareErrorHandler);

  return app;
}

const app = createApp();

export default app;
