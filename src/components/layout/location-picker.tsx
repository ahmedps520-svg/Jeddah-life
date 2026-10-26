"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import type { NeighbourhoodLite } from "@/lib/places/types";
import { normalizeText } from "@/lib/search/normalize";

let hoodCache: NeighbourhoodLite[] | null = null;

export function useNeighbourhoods() {
  const [hoods, setHoods] = useState<NeighbourhoodLite[] | null>(hoodCache);
  useEffect(() => {
    if (hoodCache) return;
    fetch("/api/neighbourhoods")
      .then((r) => r.json())
      .then((d: { hoods: NeighbourhoodLite[] }) => {
        hoodCache = d.hoods;
        setHoods(d.hoods);
      })
      .catch(() => setHoods([]));
  }, []);
  return hoods;
}

export function LocationPicker({ variant }: { variant: "compact" | "inline" }) {
  const { t, locale } = useI18n();
  const { location, setArea, clear, requestDevice } = useCityLocation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"idle" | "locating" | "denied" | "unavailable">("idle");
  const hoods = useNeighbourhoods();

  const label =
    location.kind === "device"
      ? t.header.myLocation
      : location.kind === "area"
        ? (locale === "ar" ? location.label.ar : null) || location.label.en
        : t.header.allJeddah;

  const list = useMemo(() => {
    if (!hoods) return [];
    const f = normalizeText(filter);
    const items = f
      ? hoods.filter((h) => normalizeText(`${h.nameEn} ${h.nameAr ?? ""}`).includes(f))
      : [...hoods.filter((h) => h.featured), ...hoods.filter((h) => !h.featured)];
    return items;
  }, [hoods, filter]);

  async function useDevice() {
    setStatus("locating");
    const r = await requestDevice();
    if (r === "ok") {
      setStatus("idle");
      setOpen(false);
    } else setStatus(r);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "compact"
            ? "flex max-w-48 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-200 transition hover:bg-white/10 hover:text-white"
            : "flex items-center gap-1.5 text-sm text-ink-200"
        }
        aria-haspopup="dialog"
      >
        <MapPin className="size-4 shrink-0 text-coral-400" />
        <span className="sr-only">{t.header.location}: </span>
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t.header.chooseArea} labelledBy="location-title" size="sm">
        <p className="mb-4 text-sm text-ink-500">{t.header.locationPrivacy}</p>
        <button
          type="button"
          onClick={useDevice}
          className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-sea-50 px-4 py-3 text-start font-medium text-sea-700 transition hover:bg-sea-100"
        >
          <LocateFixed className="size-5" />
          {status === "locating" ? t.header.locating : t.header.useMyLocation}
        </button>
        {(status === "denied" || status === "unavailable") && (
          <p role="alert" className="mb-3 rounded-xl bg-coral-400/15 px-3 py-2 text-sm text-coral-500">
            {status === "denied" ? t.header.locationDenied : t.header.locationUnavailable}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            clear();
            setOpen(false);
          }}
          className={`mb-3 w-full rounded-2xl px-4 py-3 text-start transition hover:bg-sand-200 ${location.kind === "none" ? "bg-sand-200 font-medium" : ""}`}
        >
          {t.header.allJeddah}
        </button>
        <label className="sr-only" htmlFor="hood-filter">
          {t.header.searchAreas}
        </label>
        <input
          id="hood-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.header.searchAreas}
          className="mb-2 w-full rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-sea-400"
        />
        <ul className="divide-y divide-sand-200">
          {!hoods && <li className="py-3 text-sm text-ink-500">{t.common.loading}</li>}
          {list.map((h) => {
            const active = location.kind === "area" && location.slug === h.slug;
            return (
              <li key={h.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setArea({ slug: h.slug, lat: h.center[0], lng: h.center[1], label: { en: h.nameEn, ar: h.nameAr } });
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-1 py-3 text-start transition hover:text-sea-600 ${active ? "font-semibold text-sea-600" : ""}`}
                  aria-pressed={active}
                >
                  <span>{locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}</span>
                  <span className="text-xs text-ink-400" dir={locale === "ar" ? "ltr" : "rtl"}>
                    {locale === "ar" ? h.nameEn : h.nameAr}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
