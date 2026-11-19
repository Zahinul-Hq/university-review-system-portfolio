import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  verify: vi.fn(),
  authMailer: {
    assertConfigured: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
  authQueries: {
    findExistingUser: vi.fn(),
    findActiveUniversityDepartment: vi.fn(),
    createUser: vi.fn(),
    findUserForLogin: vi.fn(),
    findUserById: vi.fn(),
    findUserForEmailVerification: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    consumeEmailVerificationToken: vi.fn(),
    setUserRole: vi.fn(),
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: mocks.hash,
    verify: mocks.verify,
  },
}));
vi.mock("../src/modules/auth/auth.mailer.js", () => ({
  authMailer: mocks.authMailer,
}));
vi.mock("../src/db/queries/auth.queries.js", () => ({
  authQueries: mocks.authQueries,
}));

import { AuthService } from "../src/modules/auth/auth.service.js";
import { config } from "../src/config.js";

describe("AuthService", () => {
  const service = new AuthService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authMailer.assertConfigured.mockReturnValue(undefined);
  });

  it("rejects duplicate users found during registration pre-checks", async () => {
    mocks.authQueries.findExistingUser.mockResolvedValue([{ userId: "user-1" }]);

    await expect(
      service.register({
        username: "student.1",
        emailAddress: "student@example.com",
        password: "ValidPass1!",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("maps a concurrent unique-constraint conflict to 409", async () => {
    mocks.authQueries.findExistingUser.mockResolvedValue([]);
    mocks.authQueries.findActiveUniversityDepartment.mockResolvedValue([
      { universityDepartmentId: "department-1" },
    ]);
    mocks.hash.mockResolvedValue("password-hash");
    mocks.authQueries.createUser.mockRejectedValue({ code: "23505" });

    await expect(
      service.register({
        username: "student.1",
        emailAddress: "student@example.com",
        password: "ValidPass1!",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not allow a correctly authenticated but unverified account to log in", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      { hashedPassword: "password-hash", emailVerifiedAt: null },
    ]);
    mocks.verify.mockResolvedValue(true);

    await expect(
      service.login({ identifier: "student.1", password: "ValidPass1!" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps university verification separate from primary-email login verification", async () => {
    mocks.authQueries.findUserForLogin.mockResolvedValue([
      {
        userId: "user-1",
        username: "student.1",
        universityDepartmentId: "department-1",
        hashedPassword: "password-hash",
        emailVerifiedAt: new Date(),
        isVerified: false,
      },
    ]);
    mocks.verify.mockResolvedValue(true);

    await expect(
      service.login({ identifier: "student.1", password: "ValidPass1!" }),
    ).resolves.toEqual({
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
  });

  it("hashes the email verification token before consuming it", async () => {
    const token = "verification-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    mocks.authQueries.consumeEmailVerificationToken.mockResolvedValue(true);

    await expect(service.verifyEmail(token)).resolves.toEqual({
      message: "Email address verified",
    });
    expect(mocks.authQueries.consumeEmailVerificationToken).toHaveBeenCalledWith(
      tokenHash,
    );
  });

  it("returns the same resend response when no matching account exists", async () => {
    mocks.authQueries.findUserForEmailVerification.mockResolvedValue([]);

    await expect(
      service.resendEmailVerification("student@example.com"),
    ).resolves.toEqual({
      message:
        "If that address has an unverified account, a verification email has been sent.",
    });
    expect(mocks.authMailer.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
