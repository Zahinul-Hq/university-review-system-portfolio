import type { MigrationConfig } from "drizzle-orm/migrator";

try {
  process.loadEnvFile('./.env');
} catch {
  // .env is optional in production/cloud environments
}
try {
  process.loadEnvFile('./.env.local');
} catch {
  // .env.local is optional
}

export function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

type APIConfig = {
  fileserverHits: number;
  port: number;
  platform: string;
};

type SessionConfig = {
  secret: string;
  name: string;
  maxAge: number;
};

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

type DBConfig = {
  dbURL: string;
  migrationURL: string;
  migrationConfig: MigrationConfig;
};

type EmailConfig = {
  resendApiKey: string | undefined;
  resendFromAddress: string | undefined;
  appBaseUrl: string | undefined;
};

type AdminConfig = {
  emails: string[];
};

export class Config {
  api: APIConfig;
  dbConfig: DBConfig;
  session: SessionConfig;
  email: EmailConfig;
  admin: AdminConfig;

  constructor() {
    this.api = {
      fileserverHits: 0,
      port: parseInt(process.env.PORT || "8080", 10),
      platform: process.env.PLATFORM || "dev",
    };

    const dbURL =
      process.env.DATABASE_URL ||
      process.env.DB_URL ||
      (process.env.NODE_ENV === "test"
        ? "postgres://postgres:postgres@localhost:5432/chirpy"
        : envOrThrow("DATABASE_URL"));

    const migrationURL =
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      process.env.DB_URL ||
      dbURL;

    this.dbConfig = {
      dbURL,
      migrationURL,
      migrationConfig,
    };

    this.session = {
      secret: process.env.SESSION_SECRET || "chirpy-session-secret-change-in-production",
      name: process.env.SESSION_NAME || "chirpy.sid",
      maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400000", 10),
    };

    this.email = {
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromAddress: process.env.RESEND_FROM_ADDRESS,
      appBaseUrl:
        process.env.APP_BASE_URL ??
        (this.api.platform === "prod"
          ? undefined
          : `http://localhost:${this.api.port}`),
    };

    this.admin = {
      emails: (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    };
  }
}

export const config = new Config();