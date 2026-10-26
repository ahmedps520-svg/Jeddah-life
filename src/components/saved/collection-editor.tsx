"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Pencil, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { PlaceCover, PriceText, type HoodNames } from "@/components/place/place-card";
import { MiniMap } from "@/components/map/mini-map";
import type { PlaceLite } from "@/lib/places/types";
import { categoryDef, subcategoryLabel } from "@/lib/taxonomy";
import { placeName, plural } from "@/lib/i18n/format";

type Col = { id: string; name: string; description: string | null; isPublic: boolean; shareToken: string | null };

export function CollectionEditor({ col, places: initial, hoods }: { col: Col; places: PlaceLite[]; hoods: HoodNames }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [places, setPlaces] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.name);
  const [description, setDescription] = useState(col.description ?? "");
  const [isPublic, setPublic] = useState(col.isPublic);

  const api = (path: string, method: string, body?: unknown) =>
    fetch(`/api/me/collections/${col.id}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= places.length) return;
    const next = [...places];
    [next[i], next[j]] = [next[j], next[i]];
    setPlaces(next);
    const res = await api("/items", "PUT", { placeIds: next.map((p) => p.id) });
    if (!res.ok) toast(t.common.somethingWrong, { tone: "error" });
  }

  async function remove(p: PlaceLite) {
    setPlaces((list) => list.filter((x) => x.id !== p.id));
    const res = await api("/items", "DELETE", { placeId: p.id });
    if (res.ok) toast(t.saved.removedFrom.replace("{name}", name));
  }

  const shareUrl = col.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/c/${col.shareToken}` : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        {editing ? (
          <form
            className="space-y-3 rounded-3xl bg-white p-5 shadow-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await api("", "PATCH", { name, description: description || null, isPublic });
              if (res.ok) {
                setEditing(false);
                router.refresh();
              } else toast(t.common.somethingWrong, { tone: "error" });
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t.saved.collectionName}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="h-11 w-full rounded-xl border border-sand-300 px-3" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t.saved.collectionDescription}</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={2} className="w-full rounded-xl border border-sand-300 px-3 py-2" />
            </label>
            <Toggle checked={isPublic} onChange={setPublic} label={t.saved.makePublic} hint={isPublic ? t.saved.publicNote : t.saved.privateNote} />
            <div className="flex gap-2">
              <Button type="submit">{t.common.done}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[34px] font-semibold leading-tight">{name}</h1>
                {description && <p className="mt-2 max-w-prose text-ink-600">{description}</p>}
                <p className="mt-2 text-sm text-ink-500">
                  {plural(locale, places.length, t.saved.placesCount)} · {col.isPublic ? t.saved.publicNote : t.saved.privateNote}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setEditing(true)} className="rounded-full p-2.5 hover:bg-sand-200" aria-label={t.common.edit}>
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t.saved.deleteCollectionConfirm.replace("{name}", name))) return;
                    const res = await api("", "DELETE");
                    if (res.ok) router.push(`/${locale}/saved?tab=collections`);
                  }}
                  className="rounded-full p-2.5 text-coral-500 hover:bg-coral-400/10"
                  aria-label={t.saved.deleteCollection}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            {col.isPublic && shareUrl && (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl).catch(() => {});
                  toast(t.share.copied);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-sea-50 px-4 py-2 text-sm font-medium text-sea-700 hover:bg-sea-100"
              >
                <Copy className="size-4" /> {t.saved.copyShareLink}
              </button>
            )}
          </>
        )}
      </header>

      {places.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-card">
          <p className="text-ink-500">{t.saved.emptyPlaces}</p>
          <Link href={`/${locale}/explore`} className="mt-3 inline-block font-medium text-sea-600 hover:underline">
            {t.saved.addPlaces}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <p className="mb-2 text-xs text-ink-500">{t.saved.reorderHint}</p>
            <ol className="space-y-2">
              {places.map((p, i) => {
                const def = categoryDef(p.category);
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-2 shadow-card">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: def.color }}>
                      {i + 1}
                    </span>
                    <Link href={`/${locale}/place/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <PlaceCover p={p} sizes="64px" className="size-14 shrink-0 rounded-xl" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{placeName(locale, p)}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {subcategoryLabel(p.sub, locale) ?? def.name[locale]}
                          {p.hood && hoods[p.hood] && ` · ${locale === "ar" ? hoods[p.hood].ar || hoods[p.hood].en : hoods[p.hood].en}`}
                        </span>
                        <span className="block text-xs text-ink-700">
                          <PriceText p={p} locale={locale} t={t} />
                        </span>
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-2 hover:bg-sand-200 disabled:opacity-30" aria-label={t.common.moveUp}>
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === places.length - 1}
                        className="rounded-full p-2 hover:bg-sand-200 disabled:opacity-30"
                        aria-label={t.common.moveDown}
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button type="button" onClick={() => remove(p)} className="rounded-full p-2 text-ink-400 hover:bg-sand-200 hover:text-coral-500" aria-label={t.common.remove}>
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <h2 className="mb-2 font-semibold">{t.saved.mapOfCollection}</h2>
            <MiniMap
              markers={places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1, color: categoryDef(p.category).color, href: `/${locale}/place/${p.slug}` }))}
              className="h-96"
              ariaLabel={t.saved.mapOfCollection}
            />
          </div>
        </div>
      )}
    </div>
  );
}
