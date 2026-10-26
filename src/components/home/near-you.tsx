"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation } from "@/components/providers/app-state";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import type { PlaceLite } from "@/lib/places/types";
import { Rail } from "./rail";

type Hit = PlaceLite & { distanceKm: number };

/**
 * "Popular near you" only renders once the user has chosen an area or
 * shared their location. Location never leaves the device except as the
 * query coordinates for this request.
 */
export function NearYou({ hoods }: { hoods: HoodNames }) {
  const { t, locale } = useI18n();
  const { location, origin } = useCityLocation();
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    if (!origin) {
      setHits(null);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/places/near?lat=${origin.lat.toFixed(4)}&lng=${origin.lng.toFixed(4)}&limit=12`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { hits: Hit[] }) => setHits(d.hits))
      .catch(() => {});
    return () => ctrl.abort();
  }, [origin]);

  if (!origin) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <h2 className="font-display text-[24px] font-semibold md:text-[28px]">{t.home.nearYou}</h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-500">
          <MapPin className="size-4 text-coral-500" />
          {t.home.nearYouEmpty}
        </p>
      </section>
    );
  }

  const area =
    location.kind === "area" ? (locale === "ar" ? location.label.ar || location.label.en : location.label.en) : t.header.myLocation;

  return (
    <Rail id="near-you" title={t.home.nearYou} note={t.home.nearYouNote.replace("{area}", area)}>
      {hits === null
        ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-[4/5] w-[62vw] max-w-[260px] rounded-[var(--radius-card)] sm:w-[240px]" />)
        : hits.map((p) => <PlaceCard key={p.id} p={p} locale={locale} t={t} hoods={hoods} distanceKm={p.distanceKm} />)}
    </Rail>
  );
}
