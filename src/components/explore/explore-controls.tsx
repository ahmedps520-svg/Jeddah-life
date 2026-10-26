"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownUp, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNeighbourhoods } from "@/components/layout/location-picker";
import { PLACE_CATEGORIES } from "@/lib/taxonomy";
import { activeFilterCount, toSearchParams, type ExploreState } from "@/lib/search/params";
import type { Attr } from "@/lib/search/parse";
import type { Chip } from "@/lib/search/understood";
import { formatNumber, plural } from "@/lib/i18n/format";

const ATTR_KEYS: Attr[] = ["family", "indoor", "outdoor", "groups", "photo", "wheelchair", "late"];

export function ExploreControls({
  state,
  chips,
  fixedCategory,
  basePath,
}: {
  state: ExploreState;
  chips: Chip[];
  fixedCategory?: string;
  basePath: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { origin } = useCityLocation();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExploreState>(state);
  const hoods = useNeighbourhoods();

  useEffect(() => setDraft(state), [state]);

  const push = (next: Partial<ExploreState>, opts: { resetPage?: boolean } = { resetPage: true }) => {
    const merged: ExploreState = { ...state, ...next, ...(opts.resetPage ? { page: 1 } : {}) };
    if (fixedCategory) merged.cat = null;
    const qs = toSearchParams(merged).toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  // Keep the "near" parameter in sync with the device/area location so
  // distances and distance sorting work. The location itself stays local.
  useEffect(() => {
    const key = origin ? `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}` : null;
    const current = state.near ? `${state.near.lat.toFixed(4)},${state.near.lng.toFixed(4)}` : null;
    if (key !== current) push({ near: origin }, { resetPage: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng]);

  const attrLabel: Record<string, string> = {
    family: t.attrs.familyFriendly,
    indoor: t.attrs.indoor,
    outdoor: t.attrs.outdoor,
    groups: t.attrs.groups,
    photo: t.attrs.photoSpot,
    wheelchair: t.attrs.wheelchair,
    late: t.attrs.lateNight,
  };
  const count = activeFilterCount(state);
  const cats = useMemo(() => PLACE_CATEGORIES.filter((c) => c.slug !== "outdoors" || true), []);
  const mapHref = `/${locale}/map${(() => {
    const qs = toSearchParams({ ...state, cat: fixedCategory ?? state.cat, page: 1 }).toString();
    return qs ? `?${qs}` : "";
  })()}`;

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-500">{t.explore.understood}:</span>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => push({ ignore: [...state.ignore, c.key] })}
              className="group flex items-center gap-1.5 rounded-full bg-sea-50 px-3 py-1 text-sm text-sea-700 ring-1 ring-sea-100 hover:bg-sea-100"
              aria-label={t.explore.chips.removeChip.replace("{label}", c.label)}
            >
              {c.label}
              <X className="size-3.5 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {!fixedCategory && (
        <div className="rail -mx-4 gap-2 px-4 md:mx-0 md:flex md:flex-wrap md:px-0" role="group" aria-label={t.explore.category}>
          <CatChip active={!state.cat} onClick={() => push({ cat: null })} label={t.explore.allCategories} />
          {cats.map((c) => (
            <CatChip key={c.slug} active={state.cat === c.slug} onClick={() => push({ cat: state.cat === c.slug ? null : c.slug })} label={c.name[locale]} color={c.color} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium shadow-card ring-1 ring-sand-200 hover:ring-ink-300"
        >
          <SlidersHorizontal className="size-4" />
          {count ? plural(locale, count, t.explore.filtersCount) : t.explore.filters}
        </button>
        <label className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm shadow-card ring-1 ring-sand-200">
          <ArrowDownUp className="size-4 text-ink-400" />
          <span className="sr-only">{t.explore.sort}</span>
          <select
            value={state.sort}
            onChange={(e) => push({ sort: e.target.value as ExploreState["sort"] })}
            className="bg-transparent font-medium outline-none"
          >
            <option value="relevance">{t.explore.sortRelevance}</option>
            <option value="distance" disabled={!origin}>
              {t.explore.sortDistance}
            </option>
            <option value="price">{t.explore.sortPrice}</option>
            <option value="rating">{t.explore.sortRating}</option>
            <option value="popularity">{t.explore.sortPopularity}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => push({ open: !state.open })}
          aria-pressed={state.open}
          className={`h-10 rounded-full px-4 text-sm font-medium ring-1 transition ${state.open ? "bg-ink-900 text-white ring-ink-900" : "bg-white ring-sand-200 shadow-card hover:ring-ink-300"}`}
        >
          {t.explore.openNow}
        </button>
        <button
          type="button"
          onClick={() => push({ free: !state.free })}
          aria-pressed={state.free}
          className={`h-10 rounded-full px-4 text-sm font-medium ring-1 transition ${state.free ? "bg-ink-900 text-white ring-ink-900" : "bg-white ring-sand-200 shadow-card hover:ring-ink-300"}`}
        >
          {t.common.free}
        </button>
        <Link href={mapHref} className="ms-auto flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-sea-600 hover:bg-sea-50">
          <MapIcon className="size-4" /> {t.explore.showMap}
        </Link>
      </div>
      {!origin && state.sort === "distance" && <p className="text-sm text-coral-500">{t.explore.sortNeedsLocation}</p>}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t.explore.filters}
        labelledBy="filters-title"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() =>
                setDraft({ ...draft, area: null, max: null, free: false, open: false, rating: null, dist: null, attrs: [], hideChains: false, verified: false })
              }
            >
              {t.common.reset}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setOpen(false);
                push(draft);
              }}
            >
              {t.common.apply}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.price}</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { label: t.explore.priceAny, max: null, free: false },
                { label: t.explore.priceFree, max: null, free: true },
                ...[50, 100, 200].map((n) => ({ label: t.explore.priceUnder.replace("{n}", formatNumber(locale, n)), max: n, free: false })),
              ].map((o) => {
                const active = draft.free === o.free && draft.max === o.max;
                return (
                  <Pill key={o.label} active={active} onClick={() => setDraft({ ...draft, max: o.max, free: o.free })}>
                    {o.label}
                  </Pill>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t.explore.priceFilterNote}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.attributes}</legend>
            <div className="flex flex-wrap gap-2">
              {ATTR_KEYS.map((a) => {
                const active = draft.attrs.includes(a);
                return (
                  <Pill
                    key={a}
                    active={active}
                    onClick={() => setDraft({ ...draft, attrs: active ? draft.attrs.filter((x) => x !== a) : [...draft.attrs, a] })}
                  >
                    {attrLabel[a]}
                  </Pill>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t.categories.familyNote}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.distance}</legend>
            {!origin && <p className="mb-2 text-xs text-ink-500">{t.explore.sortNeedsLocation}</p>}
            <div className="flex flex-wrap gap-2">
              {[null, 1, 3, 5, 10].map((d) => (
                <Pill key={String(d)} active={draft.dist === d} disabled={!origin && d !== null} onClick={() => setDraft({ ...draft, dist: d })}>
                  {d ? t.explore.distanceWithin.replace("{n}", formatNumber(locale, d)) : t.explore.distanceAny}
                </Pill>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.rating}</legend>
            <div className="flex flex-wrap gap-2">
              {[null, 3, 4].map((r) => (
                <Pill key={String(r)} active={draft.rating === r} onClick={() => setDraft({ ...draft, rating: r })}>
                  {r ? t.explore.ratingAtLeast.replace("{n}", formatNumber(locale, r)) : t.explore.ratingAny}
                </Pill>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t.explore.sortRatingNote}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-semibold">{t.explore.neighbourhood}</legend>
            <select
              value={draft.area ?? ""}
              onChange={(e) => setDraft({ ...draft, area: e.target.value || null })}
              className="h-11 w-full rounded-xl border border-sand-300 bg-white px-3"
            >
              <option value="">{t.explore.anyArea}</option>
              {(hoods ?? []).map((h) => (
                <option key={h.slug} value={h.slug}>
                  {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="space-y-3">
            <Toggle checked={draft.open} onChange={(v) => setDraft({ ...draft, open: v })} label={t.explore.openNow} hint={t.explore.openNowNote} />
            <Toggle checked={draft.hideChains} onChange={(v) => setDraft({ ...draft, hideChains: v })} label={t.explore.hideChains} />
            <Toggle checked={draft.verified} onChange={(v) => setDraft({ ...draft, verified: v })} label={t.explore.verifiedOnly} />
          </fieldset>
        </div>
      </Sheet>
    </div>
  );
}

function CatChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${
        active ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-sand-200 hover:ring-ink-300"
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
    </button>
  );
}

export function Pill({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm transition disabled:opacity-40 ${
        active ? "bg-sea-500 text-white" : "bg-sand-100 text-ink-800 ring-1 ring-sand-300 hover:bg-sand-200"
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-sand-300 transition peer-checked:bg-sea-500 peer-focus-visible:ring-2 peer-focus-visible:ring-sea-300" />
        <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}
