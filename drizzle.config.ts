import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile("./.env");
} catch {}
try {
  process.loadEnvFile("./.env.local");
} catch {}

export default defineConfig({
  schema: "src/db/schema.ts",
  out: "src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      process.env.DB_URL ||
      "postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable",
  },
});