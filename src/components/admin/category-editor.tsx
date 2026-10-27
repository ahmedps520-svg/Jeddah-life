"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { plural } from "@/lib/i18n/format";
import type { FieldErrors } from "@/lib/admin/types";
import { Field, TextField, adminRequest, useErrorText, useFailToast } from "./form";
import { inputClass } from "./ui";

export type CategoryRow = {
  slug: string;
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  color: string;
  sortOrder: string;
  showOnHome: boolean;
};

/** One editable category card. Slugs are shown but never editable. */
export function CategoryEditor({ initial, placeCount }: { initial: CategoryRow; placeCount?: number }) {
  const { t, locale } = useI18n();
  const c = t.admin.categories;
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const err = useErrorText();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof CategoryRow>(k: K, value: CategoryRow[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const n = (k: string) => `${initial.slug}-${k}`;
  const validColor = /^#[0-9a-fA-F]{6}$/.test(v.color);

  const save = async () => {
    setBusy(true);
    const { slug, ...payload } = v;
    const r = await adminRequest(`/api/admin/categories/${slug}`, "PATCH", payload);
    setBusy(false);
    if (!r.ok) {
      const scoped: FieldErrors = {};
      for (const [k, code] of Object.entries(r.fields)) scoped[n(k)] = code;
      setErrors(scoped);
      return fail(r);
    }
    setErrors({});
    setSaved(v);
    toast(c.saved);
    router.refresh();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="rounded-3xl bg-white p-5 shadow-card md:p-6"
      aria-labelledby={`${n("title")}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="size-12 shrink-0 rounded-2xl ring-1 ring-black/5"
          style={{ background: validColor ? `linear-gradient(135deg, ${v.color}, color-mix(in srgb, ${v.color} 65%, black))` : undefined }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 id={n("title")} className="font-display text-xl font-semibold">
            {locale === "ar" ? v.nameAr || v.nameEn : v.nameEn}
          </h2>
          <p className="text-xs text-ink-500">
            {c.slug}: <code dir="ltr">{initial.slug}</code>
            {placeCount != null && <> · {plural(locale, placeCount, c.placesCount)}</>}
          </p>
        </div>
        {dirty && <span className="text-xs text-ink-500">{t.admin.places.unsaved}</span>}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField name={n("nameEn")} label={c.nameEn} required dir="ltr" value={v.nameEn} onChange={(x) => set("nameEn", x)} error={err(errors[n("nameEn")])} maxLength={60} />
        <TextField name={n("nameAr")} label={c.nameAr} required dir="rtl" value={v.nameAr} onChange={(x) => set("nameAr", x)} error={err(errors[n("nameAr")])} maxLength={60} />
        <TextField name={n("taglineEn")} label={c.taglineEn} dir="ltr" value={v.taglineEn} onChange={(x) => set("taglineEn", x)} error={err(errors[n("taglineEn")])} maxLength={160} />
        <TextField name={n("taglineAr")} label={c.taglineAr} dir="rtl" value={v.taglineAr} onChange={(x) => set("taglineAr", x)} error={err(errors[n("taglineAr")])} maxLength={160} />
      </div>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <Field name={n("color")} label={c.color} error={err(errors[n("color")])}>
          {(ctl) => (
            <div className="flex gap-2">
              <input
                type="color"
                value={validColor ? v.color : "#127C83"}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-sand-300 bg-white p-1"
                aria-label={c.color}
              />
              <input {...ctl} value={v.color} onChange={(e) => set("color", e.target.value)} dir="ltr" maxLength={7} className={inputClass} />
            </div>
          )}
        </Field>
        <TextField name={n("sortOrder")} label={c.sortOrder} dir="ltr" inputMode="numeric" value={v.sortOrder} onChange={(x) => set("sortOrder", x)} error={err(errors[n("sortOrder")])} />
        <div className="pb-2">
          <Toggle checked={v.showOnHome} onChange={(x) => set("showOnHome", x)} label={c.showOnHome} />
        </div>
      </div>
      <div className="mt-5 flex justify-end border-t border-sand-100 pt-4">
        <Button type="submit" size="sm" disabled={busy || !dirty}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {busy ? t.admin.common.saving : t.admin.common.save}
        </Button>
      </div>
    </form>
  );
}
