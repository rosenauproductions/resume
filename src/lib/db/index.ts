import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
