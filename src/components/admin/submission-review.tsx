"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, Plus, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { PLACE_CATEGORIES, SUBCATEGORIES } from "@/lib/taxonomy";
import { placeName } from "@/lib/i18n/format";
import type { FieldErrors, PlaceHit } from "@/lib/admin/types";
import { parseCoord } from "@/lib/admin/validate";
import { ErrorSummary, SelectField, TextAreaField, TextField, adminRequest, useErrorText } from "./form";
import { NoteAction } from "./moderation-actions";
import { PlaceSearch } from "./place-search";
import { CoordinatePicker } from "./coordinate-picker";
import type { HoodOption } from "./place-form";

export type SubmissionInfo = {
  id: string;
  name: string;
  description: string;
  tips: string | null;
  lat: number | null;
  lng: number | null;
  neighbourhood: string | null;
  photoCount: number;
  suggested: PlaceHit | null;
};

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Approve (link or create) / reject controls for a pending submission. */
export function SubmissionReview({ sub, hoods }: { sub: SubmissionInfo; hoods: HoodOption[] }) {
  const { t, locale } = useI18n();
  const s = t.admin.submissions;
  const a = t.admin.places;
  const router = useRouter();
  const toast = useToast();
  const err = useErrorText();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const text = [sub.description, sub.tips].filter(Boolean).join("\n\n");
  const ar = hasArabic(sub.name + sub.description);
  const initial = {
    mode: (sub.suggested ? "link" : "create") as "link" | "create",
    place: sub.suggested,
    nameEn: ar ? "" : sub.name,
    nameAr: ar ? sub.name : "",
    category: "",
    subcategory: "",
    lat: sub.lat != null ? String(sub.lat) : "",
    lng: sub.lng != null ? String(sub.lng) : "",
    neighbourhood: sub.neighbourhood && hoods.some((h) => h.slug === sub.neighbourhood) ? sub.neighbourhood : "",
    descriptionEn: ar ? "" : sub.description,
    descriptionAr: ar ? sub.description : "",
    gemNoteEn: ar ? "" : text.slice(0, 600),
    gemNoteAr: ar ? text.slice(0, 600) : "",
    usePhotos: false,
    note: "",
  };
  const [v, setV] = useState(initial);
  const set = <K extends keyof typeof initial>(k: K, value: (typeof initial)[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const e = (k: string) => err(errors[k]);

  const approve = async () => {
    setBusy(true);
    setFormError(undefined);
    const payload =
      v.mode === "link"
        ? { action: "approve_link", placeId: v.place?.id ?? "", gemNoteEn: v.gemNoteEn, gemNoteAr: v.gemNoteAr, note: v.note }
        : {
            action: "approve_create",
            nameEn: v.nameEn,
            nameAr: v.nameAr,
            category: v.category,
            subcategory: v.subcategory,
            lat: v.lat,
            lng: v.lng,
            neighbourhood: v.neighbourhood,
            descriptionEn: v.descriptionEn,
            descriptionAr: v.descriptionAr,
            usePhotos: v.usePhotos,
            gemNoteEn: v.gemNoteEn,
            gemNoteAr: v.gemNoteAr,
            note: v.note,
          };
    const r = await adminRequest(`/api/admin/submissions/${sub.id}`, "PATCH", payload);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields);
      if (!Object.keys(r.fields).length) setFormError(err(r.code));
      return;
    }
    setOpen(false);
    toast(s.approved);
    router.refresh();
  };

  const la = parseCoord(v.lat);
  const ln = parseCoord(v.lng);
  const titleId = `approve-${sub.id}`;
  const labels: Record<string, string> = {
    placeId: s.linkedPlace,
    nameEn: a.nameEn,
    nameAr: a.nameAr,
    category: a.category,
    subcategory: a.subcategory,
    lat: a.lat,
    lng: a.lng,
    neighbourhood: a.neighbourhood,
    gemNoteEn: a.gemNoteEn,
    gemNoteAr: a.gemNoteAr,
    note: t.admin.common.noteForUser,
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <NoteAction
        url={`/api/admin/submissions/${sub.id}`}
        payload={{ action: "reject" }}
        label={s.reject}
        title={s.rejectTitle}
        body={s.rejectLede}
        noteLabel={t.admin.common.noteForUser}
        done={s.rejected}
        variant="ghost"
        icon={<X className="size-4" aria-hidden />}
      />
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setV(initial);
          setErrors({});
          setFormError(undefined);
          setOpen(true);
        }}
      >
        <Check className="size-4" aria-hidden /> {s.approve}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={s.approveTitle} labelledBy={titleId} size="lg">
        {open && (
          <form
            noValidate
            className="space-y-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              void approve();
            }}
          >
            <p className="text-sm text-ink-600">
              <span className="font-semibold text-ink-900">{sub.name}</span>
            </p>
            <ErrorSummary errors={errors} labels={labels} />

            <div role="radiogroup" aria-label={s.approveTitle} className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["link", s.modeLink, Link2],
                  ["create", s.modeCreate, Plus],
                ] as const
              ).map(([mode, label, Icon]) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-sm font-medium ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sea-400 ${
                    v.mode === mode ? "bg-sea-50 ring-sea-300" : "bg-white ring-sand-300 hover:ring-ink-300"
                  }`}
                >
                  <input type="radio" name={`mode-${sub.id}`} className="sr-only" checked={v.mode === mode} onChange={() => set("mode", mode)} />
                  <Icon className="size-4 text-sea-600" aria-hidden />
                  {label}
                </label>
              ))}
            </div>

            {v.mode === "link" ? (
              <div className="space-y-3">
                {v.place && (
                  <p className="flex items-center gap-2 rounded-xl bg-sea-50 px-3 py-2 text-sm ring-1 ring-sea-100">
                    <Link2 className="size-4 text-sea-600" aria-hidden />
                    {t.admin.events.linkedTo.replace("{name}", placeName(locale, v.place) || v.place.slug)}
                  </p>
                )}
                <PlaceSearch onSelect={(p) => set("place", p)} selectedId={v.place?.id} />
                {errors.placeId && <p className="text-[13px] font-medium text-coral-500">{e("placeId")}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink-500">{s.createLede}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="nameEn" label={a.nameEn} dir="ltr" value={v.nameEn} onChange={(x) => set("nameEn", x)} error={e("nameEn")} />
                  <TextField name="nameAr" label={a.nameAr} dir="rtl" value={v.nameAr} onChange={(x) => set("nameAr", x)} error={e("nameAr")} />
                  <SelectField
                    name="category"
                    label={a.category}
                    required
                    value={v.category}
                    onChange={(x) => set("category", x)}
                    placeholder="—"
                    options={PLACE_CATEGORIES.map((c) => ({ value: c.slug, label: c.name[locale] }))}
                    error={e("category")}
                  />
                  <SelectField
                    name="subcategory"
                    label={a.subcategory}
                    value={v.subcategory}
                    onChange={(x) => set("subcategory", x)}
                    placeholder={a.subcategoryNone}
                    options={Object.entries(SUBCATEGORIES)
                      .map(([value, l]) => ({ value, label: l[locale] }))
                      .sort((x, y) => x.label.localeCompare(y.label, locale))}
                    error={e("subcategory")}
                  />
                </div>
                <CoordinatePicker
                  className="h-56"
                  lat={la != null && !Number.isNaN(la) ? la : null}
                  lng={ln != null && !Number.isNaN(ln) ? ln : null}
                  onPick={(lat, lng) => setV((cur) => ({ ...cur, lat: String(lat), lng: String(lng) }))}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField name="lat" label={a.lat} required dir="ltr" inputMode="decimal" value={v.lat} onChange={(x) => set("lat", x)} error={e("lat")} />
                  <TextField name="lng" label={a.lng} required dir="ltr" inputMode="decimal" value={v.lng} onChange={(x) => set("lng", x)} error={e("lng")} />
                  <SelectField
                    name="neighbourhood"
                    label={a.neighbourhood}
                    value={v.neighbourhood}
                    onChange={(x) => set("neighbourhood", x)}
                    placeholder={a.neighbourhoodAuto}
                    options={hoods.map((h) => ({ value: h.slug, label: h.name }))}
                    error={e("neighbourhood")}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextAreaField name="descriptionEn" label={a.descriptionEn} dir="ltr" rows={3} value={v.descriptionEn} onChange={(x) => set("descriptionEn", x)} error={e("descriptionEn")} />
                  <TextAreaField name="descriptionAr" label={a.descriptionAr} dir="rtl" rows={3} value={v.descriptionAr} onChange={(x) => set("descriptionAr", x)} error={e("descriptionAr")} />
                </div>
                {sub.photoCount > 0 && <Toggle checked={v.usePhotos} onChange={(x) => set("usePhotos", x)} label={s.usePhotos} hint={s.usePhotosHint} />}
              </div>
            )}

            <div className="space-y-3 rounded-2xl bg-sea-50/60 p-4 ring-1 ring-sea-100">
              <p className="text-sm text-ink-600">{s.gemNoteLede}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextAreaField name="gemNoteEn" label={a.gemNoteEn} dir="ltr" rows={3} maxLength={600} value={v.gemNoteEn} onChange={(x) => set("gemNoteEn", x)} error={e("gemNoteEn")} />
                <TextAreaField name="gemNoteAr" label={a.gemNoteAr} dir="rtl" rows={3} maxLength={600} value={v.gemNoteAr} onChange={(x) => set("gemNoteAr", x)} error={e("gemNoteAr")} />
              </div>
            </div>
            <TextAreaField name="note" label={t.admin.common.noteForUser} hint={t.admin.common.noteHint} rows={2} maxLength={500} value={v.note} onChange={(x) => set("note", x)} error={e("note")} />
            {formError && (
              <p role="alert" className="text-[13px] font-medium text-coral-500">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-sand-200 pt-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                {t.admin.common.cancel}
              </Button>
              <Button type="submit" disabled={busy || (v.mode === "link" && !v.place)}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                {s.approve}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
