import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import * as schema from "./schema.js";
import { config } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.dbConfig.dbURL,
});
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });

if (process.env.NODE_ENV !== "test" && process.env.VERCEL !== "1") {
  const migrationPool = new Pool({
    connectionString: config.dbConfig.migrationURL,
    max: 1,
  });

  try {
    await migrate(drizzle(migrationPool), config.dbConfig.migrationConfig);
  } catch (error) {
    console.warn("Database auto-migration skipped or encountered an error:", error);
  } finally {
    await migrationPool.end().catch(() => {});
  }
}
