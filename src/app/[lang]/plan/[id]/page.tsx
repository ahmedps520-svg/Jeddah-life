import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { itineraries } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { loadItinerary } from "@/lib/planner/load";
import { ItineraryView } from "@/components/planner/itinerary-view";

export const metadata: Metadata = { robots: { index: false } };

export default async function SavedOutingPage({ params }: PageProps<"/[lang]/plan/[id]">) {
  const { locale } = await getDictionary();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/sign-in?next=/${locale}/plan/${id}`);
  const [it] = await db.select().from(itineraries).where(and(eq(itineraries.id, id), eq(itineraries.userId, user.id)));
  if (!it) notFound();
  const { settings, plan, places } = loadItinerary(await getCatalog(), it);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <ItineraryView settings={settings} plan={plan} places={places} itineraryId={it.id} initialTitle={it.title} shareToken={it.shareToken} />
    </div>
  );
}
