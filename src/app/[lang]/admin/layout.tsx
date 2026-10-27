import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reports, submissions } from "@/lib/db/schema";
import { ButtonLink } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/admin-nav";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: { default: t.admin.title, template: `%s · ${t.admin.title}` },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

/**
 * Admin shell. The shell (navigation, counts) is only rendered for
 * administrators; signed-in non-admins get an explanation instead.
 * Signed-out visitors are redirected to sign-in by requireAdminPage(), which
 * every admin page calls first and which knows the exact URL to return to.
 * Every admin page and API route checks the role on its own, because layouts
 * are not re-rendered on client navigation and can't stop a page segment
 * from rendering.
 */
export default async function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  // Signed out: every admin page starts with requireAdminPage(), which
  // redirects to sign-in with that page's exact URL as ?next= (a layout can't
  // see the requested path). Rendering the page here lets that redirect
  // happen during server rendering, as a real HTTP redirect.
  if (!user) return <>{children}</>;

  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center md:py-24">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-coral-400/15 text-coral-500">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[30px] font-semibold">{t.admin.forbiddenTitle}</h1>
        <p className="mt-3 text-ink-600">{t.admin.forbiddenLede}</p>
        <ButtonLink href={`/${locale}`} variant="secondary" className="mt-8">
          {t.admin.backToSite}
        </ButtonLink>
      </div>
    );
  }

  const [[openReports], [pendingSubs]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(reports).where(eq(reports.status, "open")),
    db.select({ n: sql<number>`count(*)` }).from(submissions).where(eq(submissions.status, "pending")),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 md:px-6 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
      <aside className="mb-5 lg:mb-0">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          <div className="mb-4 hidden items-center gap-2.5 px-3 lg:flex">
            <span className="grid size-9 place-items-center rounded-xl bg-sea-500 text-white">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight">{t.admin.title}</p>
              <p className="text-xs text-ink-500 [overflow-wrap:anywhere]">
                {t.admin.signedInAs.split("{name}")[0]}
                <bdi>{user.displayName}</bdi>
                {t.admin.signedInAs.split("{name}")[1]}
              </p>
            </div>
          </div>
          <AdminNav counts={{ reports: Number(openReports?.n ?? 0), submissions: Number(pendingSubs?.n ?? 0) }} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
