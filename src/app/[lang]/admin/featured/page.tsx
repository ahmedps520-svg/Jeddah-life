import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { heroSlides, places } from "@/lib/db/schema";
import { requireAdminPage } from "@/lib/admin/guard";
import { imageToInput } from "@/lib/admin/places";
import { formatNumber } from "@/lib/i18n/format";
import { Badge, EmptyState, PageHeader, cardClass } from "@/components/admin/ui";
import { HeroEditor, NewHeroSlide } from "@/components/admin/hero-editor";
import { PicksManager } from "@/components/admin/picks-manager";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.featured.title };
}

export default async function AdminFeatured() {
  if (!(await requireAdminPage("/featured"))) return null;
  const { t, locale } = await getDictionary();
  const f = t.admin.featured;
  const [slides, picks] = await Promise.all([
    db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder), asc(heroSlides.titleEn)),
    db
      .select({ id: places.id, slug: places.slug, nameEn: places.nameEn, nameAr: places.nameAr, category: places.category })
      .from(places)
      .where(and(eq(places.editorsPick, true), eq(places.status, "published")))
      .orderBy(asc(places.category), asc(places.nameEn)),
  ]);
  const nextOrder = slides.length ? Math.max(...slides.map((s) => s.sortOrder)) + 1 : 0;

  return (
    <div className="space-y-10">
      <PageHeader title={f.title} lede={f.lede} />

      <section aria-labelledby="hero-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="hero-title" className="font-display text-2xl font-semibold">
              {f.hero}
            </h2>
            <p className="mt-1 text-sm text-ink-500">{f.heroLede}</p>
          </div>
          <NewHeroSlide nextOrder={nextOrder} />
        </div>
        {slides.length ? (
          <ul className="space-y-5">
            {slides.map((s) => (
              <li key={s.id} className={cardClass}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">{locale === "ar" ? s.titleAr : s.titleEn}</span>
                  <Badge tone={s.active ? "sea" : "muted"}>{s.active ? f.active : f.inactive}</Badge>
                  <span className="text-xs text-ink-500">
                    {f.sortOrder}: {formatNumber(locale, s.sortOrder)}
                  </span>
                </div>
                <HeroEditor
                  id={s.id}
                  initial={{
                    theme: s.theme,
                    titleEn: s.titleEn,
                    titleAr: s.titleAr,
                    subtitleEn: s.subtitleEn ?? "",
                    subtitleAr: s.subtitleAr ?? "",
                    href: s.href,
                    sortOrder: String(s.sortOrder),
                    active: s.active,
                    image: s.image ? imageToInput(s.image) : null,
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{f.heroEmpty}</EmptyState>
        )}
      </section>

      <section aria-labelledby="picks-title" className={cardClass}>
        <h2 id="picks-title" className="font-display text-2xl font-semibold">
          {f.picks}
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-500">{f.picksLede}</p>
        <PicksManager picks={picks} />
      </section>
    </div>
  );
}
