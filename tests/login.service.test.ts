import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  verify: vi.fn(),
  authQueries: {
    findUserForLogin: vi.fn(),
    findUserById: vi.fn(),
    setUserRole: vi.fn(),
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: mocks.hash,
    verify: mocks.verify,
  },
}));
vi.mock("../src/db/queries/auth.queries.js", () => ({
  authQueries: mocks.authQueries,
}));

import { LoginService } from "../src/modules/auth/login/login.service.js";
import { config } from "../src/config.js";

describe("LoginService", () => {
  const service = new LoginService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects login with empty identifier or password", async () => {
    await expect(
      service.login({ identifier: "", password: "password123" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.login({ identifier: "user1", password: "" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects login if user does not exist", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([]);

    await expect(
      service.login({ identifier: "nonexistent", password: "password123" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects login with incorrect password", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      { hashedPassword: "hashed-pass", emailVerifiedAt: new Date() },
    ]);
    mocks.verify.mockResolvedValue(false);

    await expect(
      service.login({ identifier: "user1", password: "wrong-password" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("does not allow an authenticated but unverified account to log in", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      { hashedPassword: "password-hash", emailVerifiedAt: null },
    ]);
    mocks.verify.mockResolvedValue(true);

    await expect(
      service.login({ identifier: "student.1", password: "ValidPass1!" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("successfully logs in verified user", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      {
        userId: "user-1",
        username: "student.1",
        universityDepartmentId: "department-1",
        hashedPassword: "password-hash",
        emailVerifiedAt: new Date(),
        isVerified: false,
        role: "user",
      },
    ]);
    mocks.verify.mockResolvedValue(true);

    const result = await service.login({
      identifier: "student.1",
      password: "ValidPass1!",
    });

    expect(result).toEqual({
      userId: "user-1",
      username: "student.1",
      universityDepartmentId: "department-1",
      isVerified: false,
      role: "user",
    });
  });

  it("promotes an eligible user to admin if their email is in ADMIN_EMAILS", async () => {
    config.admin.emails = ["admin@example.com"];
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      {
        userId: "admin-1",
        username: "admin.user",
        emailAddress: "admin@example.com",
        universityDepartmentId: "department-1",
        hashedPassword: "password-hash",
        emailVerifiedAt: new Date(),
        isVerified: true,
        role: "user",
      },
    ]);
    mocks.verify.mockResolvedValue(true);
    mocks.authQueries.setUserRole.mockResolvedValue(undefined);

    const result = await service.login({
      identifier: "admin.user",
      password: "ValidPass1!",
    });

    expect(result.role).toBe("admin");
    expect(mocks.authQueries.setUserRole).toHaveBeenCalledWith("admin-1", "admin");
  });

  it("me() returns current user details", async () => {
    mocks.authQueries.findUserById.mockResolvedValue([
      {
        userId: "user-1",
        username: "student.1",
        universityDepartmentId: "department-1",
        isVerified: true,
        role: "user",
      },
    ]);

    const result = await service.me("user-1");

    expect(result).toEqual({
      userId: "user-1",
      username: "student.1",
      universityDepartmentId: "department-1",
      isVerified: true,
      role: "user",
    });
  });

  it("me() throws 404 when user is not found", async () => {
    mocks.authQueries.findUserById.mockResolvedValue([]);

    await expect(service.me("unknown-user")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
