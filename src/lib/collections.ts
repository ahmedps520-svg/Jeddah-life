import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { HttpError } from "@/lib/api";

export async function ownCollection(userId: string, id: string) {
  const [c] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, userId)));
  if (!c) throw new HttpError(404, "not_found");
  return c;
}
