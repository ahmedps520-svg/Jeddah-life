"use client";

import { useEffect, useId, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { categoryDef } from "@/lib/taxonomy";
import { placeName } from "@/lib/i18n/format";
import type { PlaceHit } from "@/lib/admin/types";
import { Badge, STATUS_TONE, inputClass } from "./ui";

/**
 * Finds places by name (English or Arabic) or slug for linking. Results are
 * plain buttons, so the list works with Tab and Enter.
 */
export function PlaceSearch({
  onSelect,
  selectedId,
  publishedOnly = false,
  label,
  autoFocus,
}: {
  onSelect: (p: PlaceHit) => void;
  selectedId?: string | null;
  publishedOnly?: boolean;
  label?: string;
  autoFocus?: boolean;
}) {
  const { t, locale } = useI18n();
  const s = t.admin.placeSearch;
  const id = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/places/search?q=${encodeURIComponent(term)}${publishedOnly ? "&published=1" : ""}`, { signal: ctrl.signal });
        const data = (await res.json()) as { places?: PlaceHit[] };
        setHits(data.places ?? []);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, publishedOnly]);

  const shown = q.trim().length >= 2 ? hits : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-800">
        {label ?? s.label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Often inside a larger form: Enter must not submit it.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder={s.placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`${inputClass} ps-9`}
        />
        {loading && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-400" aria-hidden />}
      </div>
      <div aria-live="polite">
        {shown && shown.length === 0 && !loading && <p className="mt-2 text-sm text-ink-500">{s.empty}</p>}
        {shown && shown.length > 0 && (
          <ul className="mt-2 max-h-72 divide-y divide-sand-100 overflow-y-auto rounded-xl bg-white ring-1 ring-sand-200">
            {shown.map((p) => {
              const selected = p.id === selectedId;
              const def = categoryDef(p.category);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm transition hover:bg-sand-50 ${selected ? "bg-sea-50" : ""}`}
                  >
                    <MapPin className="size-4 shrink-0" style={{ color: def.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{placeName(locale, p) || p.slug}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {def.name[locale]} · <span dir="ltr">{p.slug}</span>
                      </span>
                    </span>
                    {p.status !== "published" && <Badge tone={STATUS_TONE[p.status]}>{t.admin.status[p.status]}</Badge>}
                    {selected ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-sea-600">
                        <Check className="size-4" aria-hidden /> {s.selected}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-sea-600">{s.select}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
