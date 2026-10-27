"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Camera, Check, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation, useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { getMaplibre } from "@/lib/map/maplibre";
import { JEDDAH_BOUNDS, JEDDAH_CENTER, loadMapStyle } from "@/lib/map/style";
import { GEM_TYPES } from "@/lib/taxonomy";
import { placeName } from "@/lib/i18n/format";

type Pin = { lat: number; lng: number };
type Hit = { id: string; slug: string; nameEn: string | null; nameAr: string | null; lat: number; lng: number; hood: string | null };

function PinPicker({ pin, onChange }: { pin: Pin | null; onChange: (p: Pin) => void }) {
  const { locale, t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await getMaplibre();
        const style = await loadMapStyle(locale);
        if (cancelled || !el.current) return;
        const m = new maplibregl.Map({
          container: el.current,
          style,
          center: JEDDAH_CENTER,
          zoom: 10.5,
          maxBounds: [
            [JEDDAH_BOUNDS[0][0] - 0.2, JEDDAH_BOUNDS[0][1] - 0.2],
            [JEDDAH_BOUNDS[1][0] + 0.2, JEDDAH_BOUNDS[1][1] + 0.2],
          ],
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), locale === "ar" ? "top-left" : "top-right");
        const node = document.createElement("div");
        node.className = "size-6 rounded-full border-[3px] border-white bg-coral-500 shadow-[0_2px_8px_rgb(0_0_0/0.4)]";
        marker.current = new maplibregl.Marker({ element: node, draggable: true });
        marker.current.on("dragend", () => {
          const p = marker.current!.getLngLat();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        });
        m.on("click", (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [locale]);

  useEffect(() => {
    const m = map.current;
    if (!m || !marker.current) return;
    if (pin) {
      marker.current.setLngLat([pin.lng, pin.lat]).addTo(m);
      if (!m.getBounds().contains([pin.lng, pin.lat]) || m.getZoom() < 13) m.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(m.getZoom(), 15) });
    } else {
      marker.current.remove();
    }
  }, [pin]);

  if (failed) return <div className="grid h-64 place-items-center rounded-2xl bg-sand-200 text-sm text-ink-500">{t.map.loadError}</div>;
  return <div ref={el} className="relative h-72 overflow-hidden rounded-2xl ring-1 ring-sand-200" aria-label={t.gems.pickOnMap} />;
}

export function GemSubmitForm() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { origin, location } = useCityLocation();
  const [name, setName] = useState("");
  const [gemType, setGemType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [tips, setTips] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [linked, setLinked] = useState<Hit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [photos, setPhotos] = useState<{ url: string; width: number; height: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      if (query.length < 2) return setHits([]);
      fetch(`/api/places/search?limit=6&q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: Hit[] }) => setHits(d.hits))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("folder", "submissions");
    fd.set("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) return toast(res.status === 413 ? t.gems.photoTooLarge : t.common.somethingWrong, { tone: "error" });
    const d = (await res.json()) as { url: string; width: number; height: number };
    setPhotos((p) => [...p, d].slice(0, 3));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError(t.gems.name);
    if (!gemType) return setError(t.gems.type);
    if (description.trim().length < 40) return setError(t.gems.descriptionHint);
    if (!pin && !linked) return setError(t.gems.locationRequired);
    setBusy(true);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        gemType,
        description: description.trim(),
        tips: tips.trim() || undefined,
        placeId: linked?.id ?? null,
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        photos,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const d = (await res.json()) as { id: string };
      toast(t.gems.submitted);
      router.push(`/${locale}/hidden-gems/${d.id}`);
      return;
    }
    const code = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    setError(
      code === "rate_limited"
        ? t.gems.rateLimited
        : code === "duplicate"
          ? t.gems.duplicate
          : code === "outside_jeddah"
            ? t.gems.outsideJeddah
            : code === "location_required"
              ? t.gems.locationRequired
              : t.common.somethingWrong,
    );
  }

  const field = "w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-500/20";

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <label className="block">
        <span className="mb-1.5 block font-medium">{t.gems.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} dir="auto" />
      </label>

      <fieldset>
        <legend className="mb-2 font-medium">{t.gems.type}</legend>
        <div className="flex flex-wrap gap-2">
          {GEM_TYPES.map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => setGemType(g.slug)}
              aria-pressed={gemType === g.slug}
              className={`rounded-full px-4 py-2 text-sm transition ${gemType === g.slug ? "bg-ink-900 text-white" : "bg-white ring-1 ring-sand-300 hover:ring-ink-300"}`}
            >
              {g.name[locale]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block font-medium">{t.gems.description}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={1200} className={field} dir="auto" />
        <span className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{t.gems.descriptionHint}</span>
          <span className="tabular-nums">{description.trim().length}/1200</span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block font-medium">
          {t.gems.tips} <span className="font-normal text-ink-400">({t.common.optional})</span>
        </span>
        <textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={3} maxLength={600} className={field} dir="auto" />
      </label>

      <fieldset className="space-y-3">
        <legend className="mb-1 font-medium">{t.gems.location}</legend>
        <div className="relative">
          <span className="mb-1.5 block text-sm text-ink-600">{t.gems.linkPlace}</span>
          {linked ? (
            <p className="flex items-center justify-between gap-2 rounded-xl bg-sea-50 px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-sea-600" /> {placeName(locale, linked)}
              </span>
              <button type="button" onClick={() => setLinked(null)} className="rounded-full p-1 hover:bg-white" aria-label={t.common.remove}>
                <X className="size-4" />
              </button>
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} className={`${field} ps-9`} placeholder={t.gems.searchPlace} />
              </div>
              {hits.length > 0 && (
                <ul className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-sand-200">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-start text-sm hover:bg-sand-100"
                        onClick={() => {
                          setLinked(h);
                          setPin({ lat: h.lat, lng: h.lng });
                          if (!name.trim()) setName(placeName(locale, h));
                          setQ("");
                          setHits([]);
                        }}
                      >
                        {placeName(locale, h)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-ink-600">
            <MapPin className="size-4" /> {pin ? t.gems.pinSet : t.gems.pickOnMap}
          </span>
          {origin && location.kind === "device" && (
            <button type="button" onClick={() => setPin({ lat: origin.lat, lng: origin.lng })} className="flex items-center gap-1.5 text-sm text-sea-600 hover:underline">
              <LocateFixed className="size-4" /> {t.gems.useMyLocation}
            </button>
          )}
        </div>
        <PinPicker pin={pin} onChange={setPin} />
      </fieldset>

      <div>
        <span className="mb-1.5 block font-medium">
          {t.gems.photo}
        </span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.url} className="relative size-24 overflow-hidden rounded-xl bg-sand-200">
              <Image src={p.url} alt="" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((x) => x.filter((y) => y.url !== p.url))}
                className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label={t.common.remove}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-sand-300 text-ink-400 hover:border-ink-300">
              <Camera className={`size-6 ${uploading ? "animate-pulse" : ""}`} />
              <span className="sr-only">{t.gems.photo}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-500">{t.gems.photoHint}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-coral-400/15 px-4 py-3 text-sm text-coral-700">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-500">{t.gems.moderationNote}</p>
      <Button type="submit" disabled={busy || uploading} size="lg">
        {t.gems.send}
      </Button>
    </form>
  );
}
