import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  authMailer: {
    assertConfigured: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
  authQueries: {
    listUniversityDepartments: vi.fn(),
    findExistingUser: vi.fn(),
    findActiveUniversityDepartment: vi.fn(),
    createUser: vi.fn(),
    findUserForEmailVerification: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    consumeEmailVerificationToken: vi.fn(),
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: mocks.hash,
  },
}));
vi.mock("../src/modules/auth/auth.mailer.js", () => ({
  authMailer: mocks.authMailer,
}));
vi.mock("../src/db/queries/auth.queries.js", () => ({
  authQueries: mocks.authQueries,
}));

import { SignupService } from "../src/modules/auth/signup/signup.service.js";

describe("SignupService", () => {
  const service = new SignupService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authMailer.assertConfigured.mockReturnValue(undefined);
  });

  it("lists active university departments", async () => {
    const mockDepartments = [
      {
        universityDepartmentId: "ud-1",
        universityName: "University A",
        departmentName: "Computer Science",
      },
    ];
    mocks.authQueries.listUniversityDepartments.mockResolvedValue(mockDepartments);

    const result = await service.listUniversityDepartments();
    expect(result).toBe(mockDepartments);
    expect(mocks.authQueries.listUniversityDepartments).toHaveBeenCalledTimes(1);
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

  it("validates registration field formats (username length, characters, email, password strength)", async () => {
    await expect(
      service.register({
        username: "ab",
        emailAddress: "student@example.com",
        password: "ValidPass1!",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.register({
        username: "student@bad",
        emailAddress: "student@example.com",
        password: "ValidPass1!",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.register({
        username: "student1",
        emailAddress: "invalid-email",
        password: "ValidPass1!",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.register({
        username: "student1",
        emailAddress: "student@example.com",
        password: "weak",
        universityDepartmentId: "department-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("successfully registers a user and triggers verification email", async () => {
    mocks.authQueries.findExistingUser.mockResolvedValue([]);
    mocks.authQueries.findActiveUniversityDepartment.mockResolvedValue([
      { universityDepartmentId: "department-1" },
    ]);
    mocks.hash.mockResolvedValue("password-hash");
    mocks.authQueries.createUser.mockResolvedValue([{ userId: "user-new-1" }]);
    mocks.authQueries.createEmailVerificationToken.mockResolvedValue(undefined);
    mocks.authMailer.sendVerificationEmail.mockResolvedValue(undefined);

    const result = await service.register({
      username: "new.student",
      emailAddress: "new.student@example.com",
      password: "StrongPassword1!",
      universityDepartmentId: "department-1",
    });

    expect(result).toEqual({
      message: "Account created. Check your email for a verification link.",
    });
    expect(mocks.authQueries.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.authMailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
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

  it("throws 400 if verification link is invalid or expired", async () => {
    mocks.authQueries.consumeEmailVerificationToken.mockResolvedValue(false);

    await expect(service.verifyEmail("expired-token")).rejects.toMatchObject({
      statusCode: 400,
    });
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

  it("resends verification email when unverified account exists", async () => {
    mocks.authQueries.findUserForEmailVerification.mockResolvedValue([
      {
        userId: "user-1",
        emailAddress: "student@example.com",
        emailVerifiedAt: null,
      },
    ]);
    mocks.authQueries.createEmailVerificationToken.mockResolvedValue(undefined);
    mocks.authMailer.sendVerificationEmail.mockResolvedValue(undefined);

    const result = await service.resendEmailVerification("student@example.com");

    expect(result).toEqual({
      message:
        "If that address has an unverified account, a verification email has been sent.",
    });
    expect(mocks.authMailer.sendVerificationEmail).toHaveBeenCalledWith(
      "student@example.com",
      expect.any(String),
    );
  });
});
