import type { NextFunction, Request, Response } from "express";

import { adminService } from "./admin.service.js";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? "";
  return param ?? "";
}

export async function getMetricsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const metrics = await adminService.getMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
}

export async function listReportsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

    const result = await adminService.listReports({ status, page, limit });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateReportStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const reportId = getParam(req.params.reportId);
    const result = await adminService.updateReportStatus(reportId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listPostsAdminHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const sentiment = typeof req.query.sentiment === "string" ? req.query.sentiment : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const universityId = typeof req.query.universityId === "string" ? req.query.universityId : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

    const result = await adminService.listPosts({
      status,
      sentiment,
      search,
      universityId,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updatePostStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const postId = getParam(req.params.postId);
    const result = await adminService.updatePostStatus(postId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deletePostAdminHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const postId = getParam(req.params.postId);
    const result = await adminService.deletePost(postId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listUsersAdminHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const isVerified =
      typeof req.query.isVerified === "string"
        ? req.query.isVerified === "true"
        : undefined;
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

    const result = await adminService.listUsers({
      search,
      isVerified,
      role,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUserVerificationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getParam(req.params.userId);
    const result = await adminService.updateUserVerification(userId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRoleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getParam(req.params.userId);
    const currentAdminUserId = req.session.user!.userId;
    const result = await adminService.updateUserRole(
      userId,
      req.body,
      currentAdminUserId,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listUniversitiesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universities = await adminService.listUniversities();
    res.status(200).json({ universities });
  } catch (error) {
    next(error);
  }
}

export async function createUniversityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.createUniversity(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUniversityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const universityId = getParam(req.params.universityId);
    const result = await adminService.updateUniversity(universityId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listDepartmentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const departments = await adminService.listDepartments();
    res.status(200).json({ departments });
  } catch (error) {
    next(error);
  }
}

export async function createDepartmentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.createDepartment(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateDepartmentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const departmentId = getParam(req.params.departmentId);
    const result = await adminService.updateDepartment(departmentId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listTagsAdminHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tags = await adminService.listTags();
    res.status(200).json({ tags });
  } catch (error) {
    next(error);
  }
}

export async function createTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await adminService.createTag(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tagId = getParam(req.params.tagId);
    const result = await adminService.updateTag(tagId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
