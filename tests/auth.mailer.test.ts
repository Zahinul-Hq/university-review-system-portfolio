import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  api: { platform: "prod" },
  email: {
    resendApiKey: "test-key",
    resendFromAddress: "Chirpy <noreply@example.com>",
    appBaseUrl: "http://localhost:8080",
  },
}));

vi.mock("../src/config.js", () => ({ config }));

import { AuthMailer } from "../src/modules/auth/auth.mailer.js";

describe("AuthMailer", () => {
  beforeEach(() => {
    config.api.platform = "prod";
    config.email.appBaseUrl = "http://localhost:8080";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires HTTPS verification links in production", () => {
    const mailer = new AuthMailer();

    expect(() => mailer.assertConfigured()).toThrow(
      "Email verification requires an HTTPS app base URL in production.",
    );
  });

  it("sends a verification link over HTTPS in production", async () => {
    config.email.appBaseUrl = "https://chirpy.example";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const mailer = new AuthMailer();

    await mailer.sendVerificationEmail("student@example.com", "token");

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.html).toContain(
      "https://chirpy.example/verify-email.html?token=token",
    );
  });
});
