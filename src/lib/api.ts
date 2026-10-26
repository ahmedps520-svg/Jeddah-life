import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError, assertSameOrigin, getCurrentUser, type SessionUser } from "@/lib/auth/session";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(status: number, code: string, message?: string) {
  return NextResponse.json({ error: code, message: message ?? code }, { status });
}

/** Wraps a route handler: maps auth and validation errors to proper HTTP responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) return error(e.code === "unauthenticated" ? 401 : 403, e.code);
      if (e instanceof ZodError) return error(400, "invalid", e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      if (e instanceof HttpError) return error(e.status, e.code, e.message);
      console.error(e);
      return error(500, "server_error");
    }
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** For mutations: same-origin + signed-in user. */
export async function mutationUser(): Promise<SessionUser> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated");
  return user;
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  return schema.parse(data);
}
