import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog } from "@/lib/places/catalog";
import { placeName } from "@/lib/i18n/format";
import { PlannerWizard } from "@/components/planner/planner-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.planner.title, description: t.planner.lede };
}

export default async function PlanPage({ searchParams }: PageProps<"/[lang]/plan">) {
  const { t, locale } = await getDictionary();
  const sp = await searchParams;
  const addId = typeof sp.add === "string" ? sp.add : null;
  const catalog = await getCatalog();
  const place = addId ? catalog.byId.get(addId) : null;
  const area = typeof sp.area === "string" && catalog.hoodBySlug.has(sp.area) ? sp.area : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="mx-auto mb-8 max-w-2xl">
        <h1 className="font-display text-[38px] font-semibold leading-tight md:text-[48px]">{t.planner.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{t.planner.lede}</p>
      </header>
      <PlannerWizard initialStart={area} mustInclude={place?.id ?? null} mustIncludeName={place ? t.planner.including.replace("{name}", placeName(locale, place)) : null} />
    </div>
  );
}
