import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type OpenVitalsDatabase = NodePgDatabase<typeof schema>;

export function createPgPool(databaseUrl = process.env.DATABASE_URL): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX ?? 10)
  });
}

export function createDb(pool = createPgPool()): OpenVitalsDatabase {
  return drizzle({ client: pool, schema });
}
