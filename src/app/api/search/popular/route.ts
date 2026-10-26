import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { searchLog } from "@/lib/db/schema";
import { handler, json } from "@/lib/api";

/** Popular searches = real queries from the last 30 days that returned results. */
export const GET = handler(async (req: Request) => {
  const locale = new URL(req.url).searchParams.get("locale") === "ar" ? "ar" : "en";
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({ q: sql<string>`min(${searchLog.query})`, n: sql<number>`count(*)` })
    .from(searchLog)
    .where(and(eq(searchLog.locale, locale), gte(searchLog.createdAt, since), sql`${searchLog.results} > 0`))
    .groupBy(searchLog.normalized)
    .having(sql`count(*) >= 3`)
    .orderBy(desc(sql`count(*)`))
    .limit(8);
  return json({ queries: rows.map((r) => r.q) }, { headers: { "Cache-Control": "public, max-age=120" } });
});
