import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { requireAdminPage } from "@/lib/admin/guard";
import { emptyPlaceForm } from "@/lib/admin/places";
import { getCatalog } from "@/lib/places/catalog";
import { PageHeader } from "@/components/admin/ui";
import { PlaceForm } from "@/components/admin/place-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.places.newTitle };
}

export default async function NewPlace() {
  if (!(await requireAdminPage("/places/new"))) return null;
  const { t, locale } = await getDictionary();
  const catalog = await getCatalog();
  const hoods = catalog.hoods
    .map((h) => ({ slug: h.slug, name: locale === "ar" ? h.nameAr || h.nameEn : h.nameEn }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <div>
      <PageHeader
        title={t.admin.places.newTitle}
        lede={t.admin.places.newLede}
        back={{ href: `/${locale}/admin/places`, label: t.admin.places.title }}
      />
      <PlaceForm initial={emptyPlaceForm()} hoods={hoods} />
    </div>
  );
}
