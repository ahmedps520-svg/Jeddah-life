"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { HERO_THEMES, type FieldErrors, type HeroSlideValues } from "@/lib/admin/types";
import { ConfirmDialog, ErrorSummary, SelectField, TextField, adminRequest, useErrorText, useFailToast } from "./form";
import { ImageManager } from "./image-manager";

export function emptySlide(sortOrder: number): HeroSlideValues {
  return { theme: "", titleEn: "", titleAr: "", subtitleEn: "", subtitleAr: "", href: "", sortOrder: String(sortOrder), active: true, image: null };
}

/** Create or edit one home page hero slide. */
export function HeroEditor({ id, initial, onCreated }: { id?: string; initial: HeroSlideValues; onCreated?: () => void }) {
  const { t, locale } = useI18n();
  const f = t.admin.featured;
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const err = useErrorText();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof HeroSlideValues>(k: K, value: HeroSlideValues[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const prefix = id ?? "new";
  const n = (k: string) => `${prefix}-${k}`;
  const scoped = (k: string) => err(errors[k]);

  const save = async () => {
    setBusy(true);
    const r = id ? await adminRequest(`/api/admin/hero/${id}`, "PATCH", v) : await adminRequest("/api/admin/hero", "POST", v);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields);
      return fail(r);
    }
    setErrors({});
    if (id) {
      setSaved(v);
      toast(f.slideSaved);
    } else {
      toast(f.slideCreated);
      onCreated?.();
    }
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const r = await adminRequest(`/api/admin/hero/${id}`, "DELETE");
    setBusy(false);
    if (!r.ok) return fail(r);
    setConfirmDelete(false);
    toast(f.slideDeleted);
    router.refresh();
  };

  const labels: Record<string, string> = {
    theme: f.theme,
    titleEn: f.titleEn,
    titleAr: f.titleAr,
    subtitleEn: f.subtitleEn,
    subtitleAr: f.subtitleAr,
    href: f.href,
    sortOrder: f.sortOrder,
    image: f.image,
  };
  // Field ids must be unique per slide on the page; map server keys to scoped ids for the summary links.
  const summaryErrors = Object.fromEntries(Object.entries(errors).map(([k, code]) => [n(k), code]));
  const summaryLabels = Object.fromEntries(Object.entries(labels).map(([k, l]) => [n(k), l]));
  summaryLabels[n("image.author")] = t.admin.places.imageAuthor;
  summaryLabels[n("image.license")] = t.admin.places.imageLicense;

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <ErrorSummary errors={summaryErrors} labels={summaryLabels} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-800">
              {f.image}{" "}
              <span className="text-coral-500" aria-hidden>
                *
              </span>
            </p>
            <ImageManager
              images={v.image ? [v.image] : []}
              onChange={(x) => set("image", x[0] ?? null)}
              folder="places"
              max={1}
              errors={errors}
              prefix="image"
              scope={prefix}
            />
          </div>
          <div className="grid h-fit gap-3 sm:grid-cols-2">
            <SelectField
              name={n("theme")}
              label={f.theme}
              required
              value={v.theme}
              onChange={(x) => set("theme", x)}
              placeholder="—"
              options={HERO_THEMES.map((th) => ({ value: th, label: f.themes[th] }))}
              error={scoped("theme")}
            />
            <TextField
              name={n("sortOrder")}
              label={f.sortOrder}
              dir="ltr"
              inputMode="numeric"
              value={v.sortOrder}
              onChange={(x) => set("sortOrder", x)}
              error={scoped("sortOrder")}
            />
            <TextField
              name={n("titleEn")}
              label={f.titleEn}
              required
              dir="ltr"
              maxLength={120}
              value={v.titleEn}
              onChange={(x) => set("titleEn", x)}
              error={scoped("titleEn")}
            />
            <TextField
              name={n("titleAr")}
              label={f.titleAr}
              required
              dir="rtl"
              maxLength={120}
              value={v.titleAr}
              onChange={(x) => set("titleAr", x)}
              error={scoped("titleAr")}
            />
            <TextField
              name={n("subtitleEn")}
              label={f.subtitleEn}
              dir="ltr"
              maxLength={240}
              value={v.subtitleEn}
              onChange={(x) => set("subtitleEn", x)}
              error={scoped("subtitleEn")}
            />
            <TextField
              name={n("subtitleAr")}
              label={f.subtitleAr}
              dir="rtl"
              maxLength={240}
              value={v.subtitleAr}
              onChange={(x) => set("subtitleAr", x)}
              error={scoped("subtitleAr")}
            />
            <TextField
              name={n("href")}
              label={f.href}
              hint={f.hrefHint}
              required
              dir="ltr"
              placeholder="/explore?cat=beaches"
              className="sm:col-span-2"
              value={v.href}
              onChange={(x) => set("href", x)}
              error={scoped("href")}
            />
            <div className="sm:col-span-2">
              <Toggle checked={v.active} onChange={(x) => set("active", x)} label={f.active} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sand-100 pt-4">
          {id && (
            <Button type="button" variant="ghost" size="sm" className="me-auto text-coral-500 hover:bg-coral-400/10" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden /> {f.deleteSlide}
            </Button>
          )}
          {dirty && id && <span className="text-xs text-ink-500">{t.admin.places.unsaved}</span>}
          <Button type="submit" size="sm" disabled={busy || (!!id && !dirty)}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : id ? (
              <Save className="size-4" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {id ? f.saveSlide : f.createSlide}
          </Button>
        </div>
      </form>
      {/* Outside the form: the dialog has its own form, and forms can't nest. */}
      {id && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={f.deleteSlide}
          confirmLabel={f.deleteSlide}
          tone="danger"
          busy={busy}
          onConfirm={remove}
        >
          {f.deleteSlideConfirm}
          <span className="mt-2 block font-medium">{locale === "ar" ? saved.titleAr : saved.titleEn}</span>
        </ConfirmDialog>
      )}
    </>
  );
}

/** Collapsible "new slide" form. */
export function NewHeroSlide({ nextOrder }: { nextOrder: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  if (!open)
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {t.admin.featured.newSlide}
      </Button>
    );
  return (
    <div className="rounded-3xl bg-white p-5 shadow-card ring-2 ring-sea-200 md:p-6">
      <h3 className="mb-4 font-display text-lg font-semibold">{t.admin.featured.newSlide}</h3>
      <HeroEditor
        key={round}
        initial={emptySlide(nextOrder)}
        onCreated={() => {
          setRound((r) => r + 1);
          setOpen(false);
        }}
      />
    </div>
  );
}
