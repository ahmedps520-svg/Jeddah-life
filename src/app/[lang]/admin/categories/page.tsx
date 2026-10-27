import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { categories, places } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { CategoryEditor } from "@/components/admin/category-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.categories.title };
}

export default async function AdminCategories() {
  if (!(await requireAdminPage("/categories"))) return null;
  const { t } = await getDictionary();
  const [rows, counts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.slug)),
    db.select({ category: places.category, n: sql<number>`count(*)` }).from(places).where(sql`${places.status} = 'published'`).groupBy(places.category),
  ]);
  const countBy = new Map(counts.map((c) => [c.category, Number(c.n)]));

  return (
    <div>
      <PageHeader title={t.admin.categories.title} lede={t.admin.categories.lede} />
      {rows.length ? (
        <ul className="space-y-5">
          {rows.map((c) => (
            <li key={c.slug}>
              <CategoryEditor
                placeCount={c.slug === "events" || c.slug === "hidden-gems" ? undefined : (countBy.get(c.slug) ?? 0)}
                initial={{
                  slug: c.slug,
                  nameEn: c.nameEn,
                  nameAr: c.nameAr,
                  taglineEn: c.taglineEn ?? "",
                  taglineAr: c.taglineAr ?? "",
                  color: c.color,
                  sortOrder: String(c.sortOrder),
                  showOnHome: c.showOnHome,
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{t.admin.common.noDataYet}</EmptyState>
      )}
    </div>
  );
}
