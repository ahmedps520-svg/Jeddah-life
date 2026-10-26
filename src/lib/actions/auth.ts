"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, newId, sha256, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { isLocale } from "@/lib/i18n/config";

export type AuthState = { error?: "invalid" | "taken" | "rate" | "validation"; fields?: Record<string, string> } | undefined;

async function clientKey() {
  const h = await headers();
  return sha256((h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local").slice(0, 16);
}

/** Only allow redirects to paths inside the app. */
function safeNext(next: unknown, locale: string, fallback: string) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith(`/${locale}/`) && !v.startsWith("//") ? v : `/${locale}${fallback}`;
}

const SignUp = z.object({
  displayName: z.string().trim().min(2).max(40),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  locale: z.string(),
});

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  const fields = { displayName: String(form.get("displayName") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: "validation", fields };
  const { displayName, email, password, locale } = parsed.data;
  if (!(await rateLimit(`signup:${await clientKey()}`, 5, 3600))) return { error: "rate", fields };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "taken", fields };
  const id = newId();
  await db.insert(users).values({
    id,
    email,
    displayName,
    passwordHash: await hashPassword(password),
    locale: isLocale(locale) ? locale : "en",
  });
  await createSession(id);
  redirect(safeNext(form.get("next"), isLocale(locale) ? locale : "en", "/profile?welcome=1"));
}

const SignIn = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  locale: z.string(),
});

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = SignIn.safeParse(Object.fromEntries(form));
  const fields = { email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: "invalid", fields };
  const { email, password, locale } = parsed.data;
  const key = await clientKey();
  if (!(await rateLimit(`signin:${key}`, 10, 900)) || !(await rateLimit(`signin:${sha256(email).slice(0, 16)}`, 8, 900))) {
    return { error: "rate", fields };
  }
  const [u] = await db.select().from(users).where(eq(users.email, email));
  // Verify against a dummy hash when the user doesn't exist to keep timing similar.
  const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!u || !ok) return { error: "invalid", fields };
  await createSession(u.id);
  redirect(safeNext(form.get("next"), isLocale(locale) ? locale : "en", "/"));
}

export async function signOutAction(form: FormData) {
  await destroySession();
  const locale = String(form.get("locale") ?? "en");
  redirect(`/${isLocale(locale) ? locale : "en"}`);
}
