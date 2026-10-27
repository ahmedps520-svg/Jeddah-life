import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";

export function signInHref(locale: string, next: string) {
  return `/${locale}/auth/sign-in?next=${encodeURIComponent(next)}`;
}

type Search = Record<string, string | string[] | undefined>;

function query(search?: Search) {
  if (!search) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * Page-level guard for every admin page. Layouts don't re-render on
 * client navigation and don't stop sibling segments from rendering, so each
 * page checks for itself:
 *  - signed out → redirected to sign-in, coming back to this exact page;
 *  - signed in but not an admin → null (the admin layout shows the
 *    "administrators only" message, and the page renders nothing).
 */
export async function requireAdminPage(path: string, search?: Search): Promise<SessionUser | null> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(signInHref(locale, `/${locale}/admin${path}${query(search)}`));
  return user.role === "admin" ? user : null;
}
