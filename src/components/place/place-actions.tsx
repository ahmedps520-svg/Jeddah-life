"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ExternalLink, FolderPlus, Navigation, Share2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { SaveButton } from "./save-button";
import { CollectionPicker } from "./collection-picker";
import { directionsUrl } from "@/lib/map/style";
import { buttonClass } from "@/components/ui/button";

export async function shareOrCopy(url: string, title: string, toast: (m: string, o?: { tone?: "error" }) => void, msgs: { copied: string; failed: string }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(msgs.copied);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(url);
      toast(msgs.copied);
    } catch {
      toast(msgs.failed, { tone: "error" });
    }
  }
}

export function PlaceActions({
  placeId,
  name,
  lat,
  lng,
  website,
}: {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [picker, setPicker] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <SaveButton placeId={placeId} variant="pill" />
      <button type="button" onClick={() => setPicker(true)} className={buttonClass("secondary")}>
        <FolderPlus className="size-[18px]" /> {t.place.addToCollection}
      </button>
      <Link href={`/${locale}/plan?add=${encodeURIComponent(placeId)}`} className={buttonClass("secondary")}>
        <CalendarPlus className="size-[18px]" /> {t.place.addToItinerary}
      </Link>
      <a href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer" className={buttonClass("dark")}>
        <Navigation className="size-[18px]" /> {t.common.directions}
      </a>
      <button
        type="button"
        onClick={() => shareOrCopy(window.location.href, t.place.shareText.replace("{name}", name), toast, t.share)}
        className={buttonClass("secondary")}
      >
        <Share2 className="size-[18px]" /> {t.common.share}
      </button>
      {website && (
        <a href={website} target="_blank" rel="noreferrer noopener" className={buttonClass("ghost")}>
          <ExternalLink className="size-[18px]" /> {t.place.website}
        </a>
      )}
      <CollectionPicker placeId={placeId} open={picker} onClose={() => setPicker(false)} />
    </div>
  );
}
