"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import type { PlaceLite } from "@/lib/places/types";

/** A recommended place with its "why" and a way to hide it. */
export function RecommendationCard({ p, hoods, why }: { p: PlaceLite; hoods: HoodNames; why: string | null }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="relative">
      <PlaceCard p={p} locale={locale} t={t} hoods={hoods} why={why} />
      <button
        type="button"
        onClick={async () => {
          setHidden(true);
          const res = await fetch("/api/me/hidden-recommendations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ placeId: p.id }),
          }).catch(() => null);
          if (res?.ok) toast(t.recs.hidden);
          else {
            setHidden(false);
            toast(t.common.somethingWrong, { tone: "error" });
          }
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-ink-500 hover:bg-sand-200 hover:text-ink-800"
      >
        <EyeOff className="size-3.5" /> {t.recs.hide}
      </button>
    </div>
  );
}
