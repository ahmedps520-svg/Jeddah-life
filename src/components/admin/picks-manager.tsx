"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { categoryDef } from "@/lib/taxonomy";
import { placeName } from "@/lib/i18n/format";
import { adminRequest, useFailToast } from "./form";
import { PlaceSearch } from "./place-search";

export type PickRow = { id: string; slug: string; nameEn: string | null; nameAr: string | null; category: string };

/** Quick toggles for Editors' picks among published places. */
export function PicksManager({ picks }: { picks: PickRow[] }) {
  const { t, locale } = useI18n();
  const f = t.admin.featured;
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, on: boolean) => {
    setBusy(id);
    const r = await adminRequest(`/api/admin/places/${id}/action`, "POST", { action: on ? "pick" : "unpick" });
    setBusy(null);
    if (!r.ok) return fail(r);
    toast(on ? f.pickAdded : f.pickRemoved);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {picks.length ? (
        <ul className="divide-y divide-sand-100 rounded-2xl ring-1 ring-sand-200">
          {picks.map((p) => {
            const def = categoryDef(p.category);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Sparkles className="size-4 shrink-0 text-gold-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <Link href={`/${locale}/admin/places/${p.id}`} className="block truncate font-medium hover:text-sea-600 hover:underline">
                    {placeName(locale, p) || p.slug}
                  </Link>
                  <span className="text-xs text-ink-500">{def.name[locale]}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" disabled={busy === p.id} onClick={() => toggle(p.id, false)}>
                  {busy === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
                  {f.removePick}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-sand-400 p-5 text-center text-sm text-ink-500">{f.picksEmpty}</p>
      )}
      {adding ? (
        <div className="rounded-2xl bg-sand-50 p-4 ring-1 ring-sand-200">
          <PlaceSearch
            publishedOnly
            autoFocus
            label={f.addPick}
            selectedId={null}
            onSelect={(p) => {
              if (picks.some((x) => x.id === p.id)) return;
              void toggle(p.id, true);
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(false)}>
              {t.admin.common.done}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> {f.addPick}
        </Button>
      )}
    </div>
  );
}
