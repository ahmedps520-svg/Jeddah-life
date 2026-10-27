import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { itineraries } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { loadItinerary } from "@/lib/planner/load";
import { ItineraryView } from "@/components/planner/itinerary-view";

export const metadata: Metadata = { robots: { index: false } };

/** Read-only view of an outing its owner shared by link. */
export default async function SharedOutingPage({ params }: PageProps<"/[lang]/o/[token]">) {
  const { t } = await getDictionary();
  const { token } = await params;
  const [it] = await db.select().from(itineraries).where(eq(itineraries.shareToken, token));
  if (!it) return <p className="mx-auto max-w-xl px-4 py-16 text-center text-ink-600">{t.errors.notFoundLede}</p>;
  const { settings, plan, places } = loadItinerary(await getCatalog(), it);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <ItineraryView settings={settings} plan={plan} places={places} initialTitle={it.title} readOnly />
    </div>
  );
}
