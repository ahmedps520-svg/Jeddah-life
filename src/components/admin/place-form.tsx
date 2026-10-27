"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Save } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { FACILITIES, OCCASIONS, PLACE_CATEGORIES, SUBCATEGORIES } from "@/lib/taxonomy";
import { ATTR_KEYS, type AttrKey, type FieldErrors, type PlaceFormValues } from "@/lib/admin/types";
import { parseCoord } from "@/lib/admin/validate";
import { ChipGroup, ErrorSummary, SelectField, TextAreaField, TextField, adminRequest, useErrorText, useFailToast } from "./form";
import { CoordinatePicker } from "./coordinate-picker";
import { ImageManager } from "./image-manager";
import { TagInput } from "./tag-input";
import { cardClass } from "./ui";

export type HoodOption = { slug: string; name: string };

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section className={cardClass} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {lede && <p className="mt-1 text-sm text-ink-500">{lede}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function PlaceForm({ placeId, initial, hoods }: { placeId?: string; initial: PlaceFormValues; hoods: HoodOption[] }) {
  const { t, locale } = useI18n();
  const a = t.admin.places;
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const err = useErrorText();
  const [v, setV] = useState<PlaceFormValues>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== baseline;

  // Quick actions in the sidebar (publish, archive, verify, pick…) change these
  // fields on the server; adopt the new values without discarding other edits,
  // so saving the form never reverts them.
  const quick = { status: initial.status, flaggedOutdated: initial.flaggedOutdated, editorsPick: initial.editorsPick };
  const [synced, setSynced] = useState(quick);
  if (synced.status !== quick.status || synced.flaggedOutdated !== quick.flaggedOutdated || synced.editorsPick !== quick.editorsPick) {
    setSynced(quick);
    setV((cur) => ({ ...cur, ...quick }));
    setBaseline((b) => JSON.stringify({ ...(JSON.parse(b) as PlaceFormValues), ...quick }));
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof PlaceFormValues>(k: K, value: PlaceFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const setAttr = (k: AttrKey, patch: Partial<NonNullable<PlaceFormValues["attributes"][AttrKey]>>) =>
    setV((cur) => {
      const prev = cur.attributes[k] ?? { value: null, verified: false };
      return { ...cur, attributes: { ...cur.attributes, [k]: { ...prev, ...patch } } };
    });

  const subOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts = Object.entries(SUBCATEGORIES)
      // A few source types share a label (e.g. two kinds of diving centre); list each label once.
      .filter(([key, label]) => {
        if (seen.has(label.en) && key !== initial.subcategory) return false;
        seen.add(label.en);
        return true;
      })
      .map(([value, label]) => ({ value, label: `${label[locale]}` }))
      .sort((x, y) => x.label.localeCompare(y.label, locale));
    if (initial.subcategory && !SUBCATEGORIES[initial.subcategory]) {
      opts.unshift({ value: initial.subcategory, label: a.subcategoryLegacy.replace("{value}", initial.subcategory) });
    }
    return opts;
  }, [locale, initial.subcategory, a.subcategoryLegacy]);

  const labels: Record<string, string> = {
    nameEn: a.nameEn,
    nameAr: a.nameAr,
    category: a.category,
    secondaryCategories: a.secondary,
    subcategory: a.subcategory,
    lat: a.lat,
    lng: a.lng,
    neighbourhood: a.neighbourhood,
    address: a.address,
    phone: a.phone,
    website: a.website,
    instagram: a.instagram,
    openingHours: a.hours,
    hoursSource: a.hoursSource,
    priceMin: a.priceMin,
    priceMax: a.priceMax,
    priceSource: a.priceSource,
    priceLevel: a.priceLevel,
    descriptionEn: a.descriptionEn,
    descriptionAr: a.descriptionAr,
    accessibilityNote: a.accessibility,
    tags: a.tags,
    occasions: a.occasions,
    facilities: a.facilities,
    images: a.images,
    hiddenGemNoteEn: a.gemNoteEn,
    hiddenGemNoteAr: a.gemNoteAr,
    sourceDetail: a.sourceDetail,
    status: a.status,
  };

  const save = async () => {
    setBusy(true);
    const r = placeId ? await adminRequest(`/api/admin/places/${placeId}`, "PATCH", v) : await adminRequest<{ id: string }>("/api/admin/places", "POST", v);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields);
      fail(r);
      if (Object.keys(r.fields).length) document.getElementById("place-form-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    if (placeId) {
      const next = { ...v, markVerified: false, flaggedOutdated: v.markVerified ? false : v.flaggedOutdated };
      setV(next);
      setBaseline(JSON.stringify(next));
      toast(v.markVerified ? a.markedVerified : t.admin.common.saved);
      router.refresh();
    } else {
      setBaseline(JSON.stringify(v));
      toast(a.created);
      router.push(`/${locale}/admin/places/${(r.data as { id: string }).id}`);
    }
  };

  const la = parseCoord(v.lat);
  const ln = parseCoord(v.lng);
  const e = (k: string) => err(errors[k]);
  const attrLabel = t.attrs as Record<string, string>;

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <div id="place-form-errors" tabIndex={-1}>
        <ErrorSummary errors={errors} labels={labels} />
      </div>

      <Section id="basics" title={a.sections.basics}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="nameEn" label={a.nameEn} dir="ltr" value={v.nameEn} onChange={(x) => set("nameEn", x)} error={e("nameEn")} maxLength={160} />
          <TextField name="nameAr" label={a.nameAr} dir="rtl" value={v.nameAr} onChange={(x) => set("nameAr", x)} error={e("nameAr")} maxLength={160} />
        </div>
        <p className="-mt-2 text-xs text-ink-500">{a.nameHint}</p>
        <div className="grid gap-4 md:grid-cols-3">
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
            options={subOptions}
            error={e("subcategory")}
          />
          <SelectField
            name="status"
            label={a.status}
            value={v.status}
            onChange={(x) => set("status", x as PlaceFormValues["status"])}
            options={(["draft", "published", "archived"] as const).map((s) => ({ value: s, label: t.admin.status[s] }))}
            error={e("status")}
          />
        </div>
        <p className="-mt-2 text-xs text-ink-500">{a.statusHint}</p>
        <ChipGroup
          legend={a.secondary}
          options={PLACE_CATEGORIES.filter((c) => c.slug !== v.category).map((c) => ({ value: c.slug, label: c.name[locale], color: c.color }))}
          value={v.secondaryCategories.filter((c) => c !== v.category)}
          onChange={(x) => set("secondaryCategories", x)}
          error={e("secondaryCategories")}
        />
      </Section>

      <Section id="location" title={a.sections.location}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <CoordinatePicker
            lat={la != null && !Number.isNaN(la) ? la : null}
            lng={ln != null && !Number.isNaN(ln) ? ln : null}
            onPick={(lat, lng) => setV((cur) => ({ ...cur, lat: String(lat), lng: String(lng) }))}
          />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField name="lat" label={a.lat} required dir="ltr" inputMode="decimal" placeholder="21.5433" value={v.lat} onChange={(x) => set("lat", x)} error={e("lat")} />
              <TextField name="lng" label={a.lng} required dir="ltr" inputMode="decimal" placeholder="39.1728" value={v.lng} onChange={(x) => set("lng", x)} error={e("lng")} />
            </div>
            <SelectField
              name="neighbourhood"
              label={a.neighbourhood}
              value={v.neighbourhood}
              onChange={(x) => set("neighbourhood", x)}
              placeholder={a.neighbourhoodAuto}
              options={hoods.map((h) => ({ value: h.slug, label: h.name }))}
              error={e("neighbourhood")}
            />
            <TextAreaField name="address" label={a.address} rows={2} value={v.address} onChange={(x) => set("address", x)} error={e("address")} maxLength={300} />
          </div>
        </div>
      </Section>

      <Section id="contact" title={a.sections.contact}>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField name="phone" label={a.phone} hint={a.phoneHint} type="tel" dir="ltr" inputMode="tel" placeholder="+966 12 …" value={v.phone} onChange={(x) => set("phone", x)} error={e("phone")} />
          <TextField name="website" label={a.website} type="url" dir="ltr" placeholder="https://" value={v.website} onChange={(x) => set("website", x)} error={e("website")} />
          <TextField name="instagram" label={a.instagram} dir="ltr" placeholder="@" value={v.instagram} onChange={(x) => set("instagram", x)} error={e("instagram")} />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <TextField
            name="openingHours"
            label={a.hours}
            hint={a.hoursHint}
            dir="ltr"
            placeholder="Sa-Th 08:00-23:00; Fr 13:00-23:00"
            value={v.openingHours}
            onChange={(x) => set("openingHours", x)}
            error={e("openingHours")}
          />
          <TextField
            name="hoursSource"
            label={a.hoursSource}
            hint={a.hoursSourceHint}
            required={!!v.openingHours.trim()}
            value={v.hoursSource}
            onChange={(x) => set("hoursSource", x)}
            error={e("hoursSource")}
          />
        </div>
      </Section>

      <Section id="price" title={a.sections.price}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField name="priceMin" label={`${a.priceMin} (${t.admin.common.sar})`} dir="ltr" inputMode="numeric" value={v.priceMin} onChange={(x) => set("priceMin", x)} error={e("priceMin")} />
          <TextField name="priceMax" label={`${a.priceMax} (${t.admin.common.sar})`} dir="ltr" inputMode="numeric" value={v.priceMax} onChange={(x) => set("priceMax", x)} error={e("priceMax")} />
          <SelectField
            name="priceLevel"
            label={a.priceLevel}
            value={v.priceLevel}
            onChange={(x) => set("priceLevel", x)}
            placeholder={a.priceLevelNone}
            options={["1", "2", "3", "4"].map((n) => ({ value: n, label: "$".repeat(Number(n)) }))}
            error={e("priceLevel")}
          />
        </div>
        <TextField
          name="priceSource"
          label={a.priceSource}
          hint={a.priceSourceHint}
          required={!!(v.priceMin.trim() || v.priceMax.trim())}
          value={v.priceSource}
          onChange={(x) => set("priceSource", x)}
          error={e("priceSource")}
        />
      </Section>

      <Section id="description" title={a.sections.description}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextAreaField name="descriptionEn" label={a.descriptionEn} dir="ltr" rows={6} value={v.descriptionEn} onChange={(x) => set("descriptionEn", x)} error={e("descriptionEn")} maxLength={5000} />
          <TextAreaField name="descriptionAr" label={a.descriptionAr} dir="rtl" rows={6} value={v.descriptionAr} onChange={(x) => set("descriptionAr", x)} error={e("descriptionAr")} maxLength={5000} />
        </div>
        <TextField name="accessibilityNote" label={a.accessibility} value={v.accessibilityNote} onChange={(x) => set("accessibilityNote", x)} error={e("accessibilityNote")} maxLength={500} />
      </Section>

      <Section id="details" title={a.sections.details}>
        <TagInput name="tags" label={a.tags} hint={a.tagsHint} value={v.tags} onChange={(x) => set("tags", x)} error={e("tags")} />
        <ChipGroup
          legend={a.occasions}
          options={OCCASIONS.map((o) => ({ value: o.slug, label: o.name[locale] }))}
          value={v.occasions}
          onChange={(x) => set("occasions", x)}
          error={e("occasions")}
        />
        <ChipGroup
          legend={a.facilities}
          options={Object.entries(FACILITIES).map(([value, label]) => ({ value, label: label[locale] }))}
          value={v.facilities}
          onChange={(x) => set("facilities", x)}
          error={e("facilities")}
        />
      </Section>

      <Section id="attributes" title={a.sections.attributes} lede={a.attributesLede}>
        <ul className="divide-y divide-sand-100">
          {ATTR_KEYS.map((k) => {
            const cur = v.attributes[k] ?? { value: null, verified: false };
            const source = cur.source && !cur.verified && cur.value !== null ? (a.attrSource as Record<string, string>)[cur.source] : null;
            return (
              <li key={k} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <fieldset className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                  <legend className="float-start min-w-40 text-[15px] font-medium">{attrLabel[k]}</legend>
                  <div className="flex rounded-full bg-sand-100 p-0.5 ring-1 ring-sand-300">
                    {(
                      [
                        [null, a.attrUnknown],
                        [true, a.attrYes],
                        [false, a.attrNo],
                      ] as const
                    ).map(([val, label]) => (
                      <label
                        key={String(val)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sea-400 ${
                          cur.value === val ? (val === null ? "bg-white shadow-card" : val ? "bg-sea-500 text-white" : "bg-ink-800 text-white") : "text-ink-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`attr-${k}`}
                          className="sr-only"
                          checked={cur.value === val}
                          onChange={() => setAttr(k, { value: val, verified: val !== null })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={`flex items-center gap-2 text-sm ${cur.value === null ? "opacity-40" : ""}`}>
                  <input
                    type="checkbox"
                    className="size-4 accent-sea-500"
                    checked={cur.value !== null && cur.verified}
                    disabled={cur.value === null}
                    onChange={(ev) => setAttr(k, { verified: ev.target.checked })}
                  />
                  <BadgeCheck className="size-4 text-sea-500" aria-hidden />
                  {a.attrVerified}
                </label>
                {source && <span className="w-full text-xs text-ink-500 md:ms-44 md:w-auto">{source}</span>}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="images" title={a.sections.images} lede={a.imagesLede}>
        <ImageManager images={v.images} onChange={(x) => set("images", x)} folder="places" errors={errors} prefix="images" />
      </Section>

      <Section id="editorial" title={a.sections.editorial}>
        <div className="grid gap-5 md:grid-cols-2">
          <Toggle checked={v.editorsPick} onChange={(x) => set("editorsPick", x)} label={a.editorsPick} hint={a.editorsPickHint} />
          <Toggle checked={v.flaggedOutdated} onChange={(x) => set("flaggedOutdated", x)} label={a.flagged} hint={a.flaggedHint} />
          <Toggle checked={v.hiddenGem} onChange={(x) => set("hiddenGem", x)} label={a.hiddenGem} hint={a.hiddenGemHint} />
        </div>
        {v.hiddenGem && (
          <div className="grid gap-4 rounded-2xl bg-sea-50/60 p-4 ring-1 ring-sea-100 md:grid-cols-2">
            <TextAreaField name="hiddenGemNoteEn" label={a.gemNoteEn} dir="ltr" rows={3} value={v.hiddenGemNoteEn} onChange={(x) => set("hiddenGemNoteEn", x)} error={e("hiddenGemNoteEn")} maxLength={600} />
            <TextAreaField name="hiddenGemNoteAr" label={a.gemNoteAr} dir="rtl" rows={3} value={v.hiddenGemNoteAr} onChange={(x) => set("hiddenGemNoteAr", x)} error={e("hiddenGemNoteAr")} maxLength={600} />
          </div>
        )}
        <TextAreaField name="sourceDetail" label={a.sourceDetail} hint={a.sourceDetailHint} rows={2} value={v.sourceDetail} onChange={(x) => set("sourceDetail", x)} error={e("sourceDetail")} maxLength={500} />
      </Section>

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+12px)] z-10 md:bottom-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-ink-900 p-3 text-sand-50 shadow-lift md:px-4">
          <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-sea-400" checked={v.markVerified} onChange={(ev) => set("markVerified", ev.target.checked)} />
            {a.markVerifiedOnSave}
          </label>
          {dirty && <span className="text-xs text-sand-300">{a.unsaved}</span>}
          <Button type="submit" disabled={busy} className="min-w-36">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {busy ? t.admin.common.saving : placeId ? t.admin.common.save : t.admin.common.create}
          </Button>
        </div>
      </div>
    </form>
  );
}
