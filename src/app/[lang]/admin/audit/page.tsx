import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { EmptyState, PageHeader, Pagination, flatParams, hrefWith } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.audit.title };
}

const PAGE_SIZE = 50;

export default async function AdminAudit({ searchParams }: PageProps<"/[lang]/admin/audit">) {
  const raw = await searchParams;
  if (!(await requireAdminPage("/audit", raw))) return null;
  const { t, locale } = await getDictionary();
  const a = t.admin.audit;
  const sp = flatParams(raw);
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(auditLog),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        detail: auditLog.detail,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        who: users.displayName,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .orderBy(desc(auditLog.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const base = `/${locale}/admin/audit`;
  const admin = `/${locale}/admin`;

  const targetHref = (type: string | null, id: string | null) => {
    if (!type || !id) return null;
    if (type === "place") return `${admin}/places/${id}`;
    if (type === "event") return `${admin}/events/${id}`;
    if (type === "category") return `${admin}/categories`;
    if (type === "hero") return `${admin}/featured`;
    if (type === "review") return `${admin}/reviews?tab=recent`;
    if (type === "submission") return `${admin}/submissions`;
    if (type === "report") return `${admin}/reports`;
    if (type === "user") return `${admin}/users`;
    return null;
  };

  return (
    <div>
      <PageHeader title={a.title} lede={a.lede} />
      {rows.length ? (
        <div className="relative overflow-x-auto rounded-3xl bg-white shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs text-ink-500">
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {a.colWhen}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {a.colWho}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {a.colAction}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {a.colTarget}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {a.colDetail}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = targetHref(r.targetType, r.targetId);
                return (
                  <tr key={r.id} className="border-b border-sand-100 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{formatDateTime(locale, r.createdAt, { timeStyle: "short" })}</td>
                    <td className="px-3 py-2.5">{r.who ?? (r.userId ? t.admin.common.deletedUser : a.system)}</td>
                    <td className="px-3 py-2.5">
                      <code dir="ltr" className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">
                        {r.action}
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.targetType && (
                        <span dir="ltr" className="whitespace-nowrap">
                          {href ? (
                            <Link href={href} className="text-sea-600 hover:underline">
                              {r.targetType}:{r.targetId}
                            </Link>
                          ) : (
                            `${r.targetType}:${r.targetId ?? ""}`
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-2.5 text-xs text-ink-600 [overflow-wrap:anywhere]">{r.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{a.empty}</EmptyState>
      )}
      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, {}, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
