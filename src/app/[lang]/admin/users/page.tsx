import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, or, sql, type SQL } from "drizzle-orm";
import { Search, ShieldCheck, ShieldMinus, ShieldPlus } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { likePattern } from "@/lib/admin/places";
import { formatDateTime, formatNumber, plural } from "@/lib/i18n/format";
import { buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Pagination, flatParams, hrefWith, inputClass } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.users.title };
}

const PAGE_SIZE = 30;

export default async function AdminUsers({ searchParams }: PageProps<"/[lang]/admin/users">) {
  const raw = await searchParams;
  const me = await requireAdminPage("/users", raw);
  if (!me) return null;
  const { t, locale } = await getDictionary();
  const u = t.admin.users;
  const sp = flatParams(raw);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = sp.role === "admin" || sp.role === "user" ? sp.role : undefined;
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));

  const conds: SQL[] = [];
  if (q) {
    const pat = likePattern(q);
    conds.push(or(sql`${users.displayName} like ${pat} escape '\\'`, sql`${users.email} like ${pat} escape '\\'`)!);
  }
  if (role) conds.push(eq(users.role, role));
  const where = conds.length ? sql.join(conds, sql` and `) : undefined;

  const [[{ n: total }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(users).where(where),
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        reviews: sql<number>`(select count(*) from reviews r where r.user_id = ${users.id})`,
        submissions: sql<number>`(select count(*) from submissions s where s.user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(sql`case when ${users.role} = 'admin' then 0 else 1 end`, desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);
  const count = Number(total);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const base = `/${locale}/admin/users`;
  const current = { q: q || undefined, role };

  return (
    <div>
      <PageHeader title={u.title} lede={u.lede} />

      <form method="get" action={base} role="search" aria-label={u.searchPlaceholder} className="mb-5 flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-card md:p-5">
        <label className="block min-w-60 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-600">{t.admin.common.search}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input name="q" type="search" defaultValue={q} placeholder={u.searchPlaceholder} className={`${inputClass} h-10 ps-9 text-sm`} />
          </span>
        </label>
        <label className="block w-48">
          <span className="mb-1 block text-xs font-medium text-ink-600">{u.colRole}</span>
          <select name="role" defaultValue={role ?? ""} className={`${inputClass} h-10 text-sm`}>
            <option value="">{t.admin.common.any}</option>
            <option value="admin">{u.roleAdmin}</option>
            <option value="user">{u.roleUser}</option>
          </select>
        </label>
        <span className="flex gap-2">
          {(q || role) && (
            <Link href={base} className={buttonClass("ghost", "sm", "h-10")}>
              {t.admin.common.resetFilters}
            </Link>
          )}
          <button type="submit" className={buttonClass("dark", "sm", "h-10")}>
            {t.admin.common.applyFilters}
          </button>
        </span>
      </form>

      <p className="mb-3 text-sm text-ink-500" aria-live="polite">
        {plural(locale, count, t.admin.common.results)}
      </p>

      {rows.length ? (
        <div className="relative overflow-x-auto rounded-3xl bg-white shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-xs text-ink-500">
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  {u.colUser}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {u.colRole}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {u.colJoined}
                </th>
                <th scope="col" className="px-3 py-3 text-end font-medium">
                  {u.colReviews}
                </th>
                <th scope="col" className="px-3 py-3 text-end font-medium">
                  {u.colSubmissions}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  <span className="sr-only">{t.admin.common.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const self = r.id === me.id;
                return (
                  <tr key={r.id} className="border-b border-sand-100 last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold">
                        {r.displayName}
                        {self && <Badge tone="ink">{u.you}</Badge>}
                      </span>
                      <span className="block text-xs text-ink-500" dir="ltr">
                        {r.email}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {r.role === "admin" ? (
                        <Badge tone="sea">
                          <ShieldCheck className="size-3" aria-hidden /> {u.roleAdmin}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">{u.roleUser}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-600">{formatDateTime(locale, r.createdAt)}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatNumber(locale, Number(r.reviews))}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatNumber(locale, Number(r.submissions))}</td>
                    <td className="px-4 py-3 text-end">
                      {r.role === "admin" ? (
                        !self && (
                          <ActionButton
                            url={`/api/admin/users/${r.id}`}
                            method="PATCH"
                            payload={{ role: "user" }}
                            label={u.demote}
                            done={u.demoted.replace("{name}", r.displayName)}
                            variant="ghost"
                            icon={<ShieldMinus className="size-4" aria-hidden />}
                            confirm={{ title: u.demote, body: u.demoteConfirm.replace("{name}", r.displayName), tone: "danger" }}
                          />
                        )
                      ) : (
                        <ActionButton
                          url={`/api/admin/users/${r.id}`}
                          method="PATCH"
                          payload={{ role: "admin" }}
                          label={u.promote}
                          done={u.promoted.replace("{name}", r.displayName)}
                          icon={<ShieldPlus className="size-4" aria-hidden />}
                          confirm={{ title: u.promote, body: u.promoteConfirm.replace("{name}", r.displayName) }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{q || role ? t.admin.common.emptyFilters : t.admin.common.noDataYet}</EmptyState>
      )}

      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => hrefWith(base, current, { page: n })}
        labels={{
          previous: t.admin.common.previous,
          next: t.admin.common.next,
          pageOf: t.admin.common.pageOf.replace("{n}", formatNumber(locale, page)).replace("{total}", formatNumber(locale, pages)),
        }}
      />
    </div>
  );
}
