import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { requireAdminPage } from "@/lib/admin/guard";
import { emptyEventForm } from "@/lib/admin/events";
import { PageHeader } from "@/components/admin/ui";
import { EventForm } from "@/components/admin/event-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.admin.events.newTitle };
}

export default async function NewEvent() {
  if (!(await requireAdminPage("/events/new"))) return null;
  const { t, locale } = await getDictionary();
  return (
    <div>
      <PageHeader title={t.admin.events.newTitle} lede={t.admin.events.lede} back={{ href: `/${locale}/admin/events`, label: t.admin.events.title }} />
      <EventForm initial={emptyEventForm()} linkedPlace={null} />
    </div>
  );
}
