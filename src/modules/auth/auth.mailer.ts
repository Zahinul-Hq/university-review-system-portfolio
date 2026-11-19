import { ServiceUnavailableError } from "../../api/errors.js";
import { config } from "../../config.js";

type ResendConfig = {
  apiKey: string;
  fromAddress: string;
  appBaseUrl: URL;
};

export class AuthMailer {
  private getResendConfig(): ResendConfig {
    const { resendApiKey, resendFromAddress, appBaseUrl } = config.email;

    if (!resendApiKey || !resendFromAddress || !appBaseUrl) {
      throw new ServiceUnavailableError(
        "Email verification is not configured. Set the Resend API key, sender address, and app base URL.",
      );
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(appBaseUrl);
    } catch {
      throw new ServiceUnavailableError(
        "Email verification has an invalid app base URL configuration.",
      );
    }

    if (!["http:", "https:"].includes(baseUrl.protocol)) {
      throw new ServiceUnavailableError(
        "Email verification requires an HTTP or HTTPS app base URL.",
      );
    }

    if (config.api.platform === "prod" && baseUrl.protocol !== "https:") {
      throw new ServiceUnavailableError(
        "Email verification requires an HTTPS app base URL in production.",
      );
    }

    return {
      apiKey: resendApiKey,
      fromAddress: resendFromAddress,
      appBaseUrl: baseUrl,
    };
  }

  assertConfigured() {
    this.getResendConfig();
  }

  async sendVerificationEmail(emailAddress: string, token: string) {
    const { apiKey, fromAddress, appBaseUrl } = this.getResendConfig();
    const verificationUrl = new URL("/verify-email.html", appBaseUrl);
    verificationUrl.searchParams.set("token", token);
    const link = verificationUrl.toString();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [emailAddress],
        subject: "Verify your Chirpy email address",
        text: `Verify your email address by opening this link: ${link}\n\nThe link expires in 30 minutes. If you did not create this account, you can ignore this email.`,
        html: `<p>Verify your email address to finish creating your Chirpy account.</p><p><a href="${link}">Verify email address</a></p><p>This link expires in 30 minutes. If you did not create this account, you can ignore this email.</p>`,
      }),
    });

    if (!response.ok) {
      console.error(`Resend rejected an email request with status ${response.status}`);
      throw new ServiceUnavailableError(
        "The verification email could not be sent. Please try again.",
      );
    }
  }
}

export const authMailer = new AuthMailer();
