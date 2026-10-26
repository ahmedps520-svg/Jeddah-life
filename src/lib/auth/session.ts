import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { randomToken, sha256 } from "./password";

export const SESSION_COOKIE = "jl_session";
const SESSION_DAYS = 30;

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "displayName"
  | "avatarUrl"
  | "role"
  | "locale"
  | "interests"
  | "favoriteCategories"
  | "budgetPreference"
  | "homeNeighbourhood"
  | "privacy"
  | "notificationPrefs"
  | "createdAt"
>;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        locale: users.locale,
        interests: users.interests,
        favoriteCategories: users.favoriteCategories,
        budgetPreference: users.budgetPreference,
        homeNeighbourhood: users.homeNeighbourhood,
        privacy: users.privacy,
        notificationPrefs: users.notificationPrefs,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated");
  if (user.role !== "admin") throw new AuthError("forbidden");
  return user;
}

export class AuthError extends Error {
  constructor(public code: "unauthenticated" | "forbidden") {
    super(code);
  }
}

/**
 * Same-origin check for Route Handlers that change data.
 * (Server Actions already get this protection from Next.js.)
 */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return;
  try {
    if (new URL(origin).host !== host) throw new AuthError("forbidden");
  } catch {
    throw new AuthError("forbidden");
  }
}
