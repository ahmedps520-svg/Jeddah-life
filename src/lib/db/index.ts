import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type DB = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __jlClient?: Client; __jlDb?: DB };

export function databaseUrl() {
  return process.env.DATABASE_URL || "file:./data/jeddah-life.db";
}

function create(): { client: Client; db: DB } {
  const client = createClient({
    url: databaseUrl(),
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const db = drizzle({ client, schema });
  return { client, db };
}

export function getDb(): DB {
  if (!globalForDb.__jlDb) {
    const { client, db } = create();
    globalForDb.__jlClient = client;
    globalForDb.__jlDb = db;
    if (databaseUrl().startsWith("file:")) {
      // Better concurrency for the local SQLite file.
      client.execute("PRAGMA journal_mode = WAL").catch(() => {});
      client.execute("PRAGMA foreign_keys = ON").catch(() => {});
      client.execute("PRAGMA busy_timeout = 5000").catch(() => {});
    }
  }
  return globalForDb.__jlDb;
}

export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };

const readyState = globalThis as unknown as { __jlDbReady?: boolean };

/**
 * True once the database answers and has been migrated and seeded. Pages
 * show a setup notice instead of failing when it isn't ready yet.
 */
export async function databaseReady(): Promise<boolean> {
  if (readyState.__jlDbReady) return true;
  try {
    getDb();
    const r = await globalForDb.__jlClient!.execute("select count(*) as n from places");
    readyState.__jlDbReady = Number(r.rows[0]?.n ?? 0) > 0;
  } catch {
    readyState.__jlDbReady = false;
  }
  return readyState.__jlDbReady;
}
