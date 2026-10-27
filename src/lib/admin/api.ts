import "server-only";
import type { ZodError } from "zod";
import { handler, HttpError, json, mutationUser } from "@/lib/api";
import { AuthError, type SessionUser } from "@/lib/auth/session";
import type { FieldErrors } from "./types";

/** Admin mutations: same-origin, signed in, and role "admin". */
export async function adminMutation(): Promise<SessionUser> {
  const user = await mutationUser();
  if (user.role !== "admin") throw new AuthError("forbidden");
  return user;
}

/** Thrown by validators; returned to the client as per-field error codes. */
export class FieldError extends Error {
  constructor(public fields: FieldErrors) {
    super("validation");
  }
}

/** Like handler(), plus structured field errors (HTTP 422). */
export function adminHandler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return handler(async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof FieldError) return json({ error: "validation", fields: e.fields }, { status: 422 });
      throw e;
    }
  });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

const KNOWN_CODES = /^[a-z_]+$/;

/** Maps zod issues to { "path.to.field": "error_code" } (first issue per field wins). */
export function zodFields(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (out[key]) continue;
    out[key] = KNOWN_CODES.test(issue.message) ? issue.message : issue.code === "too_big" ? "too_long" : "invalid";
  }
  return out;
}
