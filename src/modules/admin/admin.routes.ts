import express from "express";

import { requireAdmin } from "../auth/auth.session.js";
import {
  createDepartmentHandler,
  createTagHandler,
  createUniversityHandler,
  deletePostAdminHandler,
  getMetricsHandler,
  listDepartmentsHandler,
  listPostsAdminHandler,
  listReportsHandler,
  listTagsAdminHandler,
  listUniversitiesHandler,
  listUsersAdminHandler,
  updateDepartmentHandler,
  updatePostStatusHandler,
  updateReportStatusHandler,
  updateTagHandler,
  updateUniversityHandler,
  updateUserRoleHandler,
  updateUserVerificationHandler,
} from "./admin.handler.js";

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

adminRouter.get("/metrics", getMetricsHandler);

adminRouter.get("/reports", listReportsHandler);
adminRouter.patch("/reports/:reportId", updateReportStatusHandler);

adminRouter.get("/posts", listPostsAdminHandler);
adminRouter.patch("/posts/:postId/status", updatePostStatusHandler);
adminRouter.delete("/posts/:postId", deletePostAdminHandler);

adminRouter.get("/users", listUsersAdminHandler);
adminRouter.patch("/users/:userId/verification", updateUserVerificationHandler);
adminRouter.patch("/users/:userId/role", updateUserRoleHandler);

adminRouter.get("/universities", listUniversitiesHandler);
adminRouter.post("/universities", createUniversityHandler);
adminRouter.patch("/universities/:universityId", updateUniversityHandler);

adminRouter.get("/departments", listDepartmentsHandler);
adminRouter.post("/departments", createDepartmentHandler);
adminRouter.patch("/departments/:departmentId", updateDepartmentHandler);

adminRouter.get("/tags", listTagsAdminHandler);
adminRouter.post("/tags", createTagHandler);
adminRouter.patch("/tags/:tagId", updateTagHandler);
