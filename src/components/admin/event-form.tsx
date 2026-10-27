"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarCheck, Info, Link2, Loader2, Save, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { EVENT_CATEGORIES } from "@/lib/taxonomy";
import { cityToday, placeName, plural } from "@/lib/i18n/format";
import type { EventFormValues, FieldErrors, PlaceHit } from "@/lib/admin/types";
import { eventChanges, type EventFacts } from "@/lib/admin/event-changes";
import { parseCoord, parseWhole } from "@/lib/admin/validate";
import { ErrorSummary, SelectField, TextAreaField, TextField, adminRequest, useErrorText, useFailToast } from "./form";
import { CoordinatePicker } from "./coordinate-picker";
import { ImageManager } from "./image-manager";
import { PlaceSearch } from "./place-search";
import { cardClass } from "./ui";

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

function facts(v: EventFormValues): EventFacts {
  const num = (s: string) => {
    const n = parseWhole(s);
    return n == null || Number.isNaN(n) ? null : n;
  };
  const coord = (s: string) => {
    const n = parseCoord(s);
    return n == null || Number.isNaN(n) ? null : n;
  };
  return {
    startDate: v.startDate,
    endDate: v.endDate,
    venueName: v.venueName,
    venueNameAr: v.venueNameAr,
    placeId: v.placeId,
    lat: coord(v.lat),
    lng: coord(v.lng),
    openingTimes: v.openingTimes,
    openingTimesAr: v.openingTimesAr,
    isFree: v.isFree,
    priceMin: v.isFree ? null : num(v.priceMin),
    priceMax: v.isFree ? null : num(v.priceMax),
  };
}

export function EventForm({
  eventId,
  initial,
  linkedPlace,
  saves = 0,
}: {
  eventId?: string;
  initial: EventFormValues;
  linkedPlace: PlaceHit | null;
  saves?: number;
}) {
  const { t, locale } = useI18n();
  const a = t.admin.events;
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const err = useErrorText();
  const [v, setV] = useState<EventFormValues>(initial);
  const [baseline, setBaseline] = useState(initial);
  const [place, setPlace] = useState<PlaceHit | null>(linkedPlace);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(baseline);

  // Archive / draft from the sidebar change the status on the server; adopt it without losing other edits.
  const [syncedStatus, setSyncedStatus] = useState(initial.status);
  if (syncedStatus !== initial.status) {
    setSyncedStatus(initial.status);
    setV((cur) => ({ ...cur, status: initial.status }));
    setBaseline((b) => ({ ...b, status: initial.status }));
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((cur) => ({ ...cur, [k]: value }));

  // Same rule as the server: a published event whose dates, venue, times or prices change.
  const changes = useMemo(
    () => (eventId && baseline.status === "published" && v.status === "published" ? eventChanges(facts(baseline), facts(v)) : []),
    [eventId, baseline, v],
  );

  const choosePlace = (p: PlaceHit) => {
    setPlace(p);
    setV((cur) => ({
      ...cur,
      placeId: p.id,
      venueName: cur.venueName || p.nameEn || p.nameAr || "",
      venueNameAr: cur.venueNameAr || p.nameAr || "",
      lat: String(p.lat),
      lng: String(p.lng),
    }));
  };

  const labels: Record<string, string> = {
    titleEn: a.titleEn,
    titleAr: a.titleAr,
    descriptionEn: a.descriptionEn,
    descriptionAr: a.descriptionAr,
    category: a.category,
    venueName: a.venueEn,
    venueNameAr: a.venueAr,
    placeId: a.linkPlace,
    lat: t.admin.common.lat,
    lng: t.admin.common.lng,
    startDate: a.startDate,
    endDate: a.endDate,
    openingTimes: a.timesEn,
    openingTimesAr: a.timesAr,
    priceMin: a.priceMin,
    priceMax: a.priceMax,
    priceNote: a.priceNote,
    ageRestriction: a.age,
    ticketUrl: a.ticketUrl,
    officialUrl: a.officialUrl,
    image: t.admin.featured.image,
    sourceName: a.sourceName,
    sourceUrl: a.sourceUrl,
    status: a.status,
    lastVerifiedAt: a.lastVerified,
    changeNote: a.changeNote,
  };

  const save = async () => {
    setBusy(true);
    const r = eventId
      ? await adminRequest<{ changes: string[]; notified: number }>(`/api/admin/events/${eventId}`, "PATCH", v)
      : await adminRequest<{ id: string }>("/api/admin/events", "POST", v);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields);
      fail(r);
      if (Object.keys(r.fields).length) document.getElementById("event-form-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    if (eventId) {
      const data = r.data as { changes: string[]; notified: number };
      const next = { ...v, changeNote: "" };
      setV(next);
      setBaseline(next);
      toast(data.changes.length ? plural(locale, data.notified, a.notified) : t.admin.common.saved);
      router.refresh();
    } else {
      setBaseline(v);
      toast(a.created);
      router.push(`/${locale}/admin/events/${(r.data as { id: string }).id}`);
    }
  };

  const la = parseCoord(v.lat);
  const ln = parseCoord(v.lng);
  const e = (k: string) => err(errors[k]);
  const fieldsText = changes.map((c) => a.changeFields[c]).join(locale === "ar" ? "، " : ", ");

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <p className="flex items-start gap-3 rounded-2xl bg-gold-400/15 p-4 text-sm text-ink-800 ring-1 ring-gold-400/40">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
        {a.honesty}
      </p>

      <div id="event-form-errors" tabIndex={-1}>
        <ErrorSummary errors={errors} labels={labels} />
      </div>

      <Section id="ev-basics" title={a.sections.basics}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="titleEn" label={a.titleEn} required dir="ltr" value={v.titleEn} onChange={(x) => set("titleEn", x)} error={e("titleEn")} maxLength={200} />
          <TextField name="titleAr" label={a.titleAr} required dir="rtl" value={v.titleAr} onChange={(x) => set("titleAr", x)} error={e("titleAr")} maxLength={200} />
          <TextAreaField name="descriptionEn" label={a.descriptionEn} dir="ltr" rows={5} value={v.descriptionEn} onChange={(x) => set("descriptionEn", x)} error={e("descriptionEn")} maxLength={5000} />
          <TextAreaField name="descriptionAr" label={a.descriptionAr} dir="rtl" rows={5} value={v.descriptionAr} onChange={(x) => set("descriptionAr", x)} error={e("descriptionAr")} maxLength={5000} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            name="category"
            label={a.category}
            required
            value={v.category}
            onChange={(x) => set("category", x)}
            placeholder="—"
            options={EVENT_CATEGORIES.map((c) => ({ value: c.slug, label: c.name[locale] }))}
            error={e("category")}
          />
          <SelectField
            name="status"
            label={a.status}
            hint={a.statusHint}
            value={v.status}
            onChange={(x) => set("status", x as EventFormValues["status"])}
            options={(["draft", "published", "archived"] as const).map((s) => ({ value: s, label: t.admin.status[s] }))}
            error={e("status")}
          />
        </div>
      </Section>

      <Section id="ev-venue" title={a.sections.venue}>
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-800">{a.linkPlace}</p>
          {place ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sea-50 px-4 py-3 ring-1 ring-sea-100">
              <span className="flex items-center gap-2 text-sm">
                <Link2 className="size-4 text-sea-600" aria-hidden />
                {a.linkedTo.replace("{name}", placeName(locale, place) || place.slug)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPlace(null);
                  set("placeId", null);
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-ink-700 ring-1 ring-sand-300 hover:bg-white"
              >
                <X className="size-3.5" aria-hidden /> {a.unlink}
              </button>
            </div>
          ) : (
            <PlaceSearch onSelect={choosePlace} label={t.admin.placeSearch.label} />
          )}
          <p className="text-xs text-ink-500">{a.linkPlaceHint}</p>
          {errors.placeId && <p className="text-[13px] font-medium text-coral-500">{e("placeId")}</p>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="venueName" label={a.venueEn} required dir="ltr" value={v.venueName} onChange={(x) => set("venueName", x)} error={e("venueName")} maxLength={200} />
          <TextField name="venueNameAr" label={a.venueAr} dir="rtl" value={v.venueNameAr} onChange={(x) => set("venueNameAr", x)} error={e("venueNameAr")} maxLength={200} />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <CoordinatePicker
            className="h-64"
            lat={la != null && !Number.isNaN(la) ? la : null}
            lng={ln != null && !Number.isNaN(ln) ? ln : null}
            onPick={(lat, lng) => setV((cur) => ({ ...cur, lat: String(lat), lng: String(lng) }))}
          />
          <div className="grid h-fit grid-cols-2 gap-3">
            <TextField name="lat" label={t.admin.common.lat} dir="ltr" inputMode="decimal" value={v.lat} onChange={(x) => set("lat", x)} error={e("lat")} />
            <TextField name="lng" label={t.admin.common.lng} dir="ltr" inputMode="decimal" value={v.lng} onChange={(x) => set("lng", x)} error={e("lng")} />
            {place && (v.lat !== String(place.lat) || v.lng !== String(place.lng)) && (
              <button
                type="button"
                onClick={() => setV((cur) => ({ ...cur, lat: String(place.lat), lng: String(place.lng) }))}
                className="col-span-2 justify-self-start text-sm font-medium text-sea-600 hover:underline"
              >
                {a.useplaceCoords}
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section id="ev-when" title={a.sections.when}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="startDate" label={a.startDate} required type="date" dir="ltr" value={v.startDate} onChange={(x) => set("startDate", x)} error={e("startDate")} />
          <TextField name="endDate" label={a.endDate} required type="date" dir="ltr" value={v.endDate} onChange={(x) => set("endDate", x)} error={e("endDate")} />
          <TextField name="openingTimes" label={a.timesEn} hint={a.timesHint} dir="ltr" value={v.openingTimes} onChange={(x) => set("openingTimes", x)} error={e("openingTimes")} maxLength={300} />
          <TextField name="openingTimesAr" label={a.timesAr} dir="rtl" value={v.openingTimesAr} onChange={(x) => set("openingTimesAr", x)} error={e("openingTimesAr")} maxLength={300} />
        </div>
      </Section>

      <Section id="ev-price" title={a.sections.price}>
        <Toggle checked={v.isFree} onChange={(x) => set("isFree", x)} label={a.isFree} />
        {!v.isFree && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="priceMin" label={`${a.priceMin} (${t.admin.common.sar})`} dir="ltr" inputMode="numeric" value={v.priceMin} onChange={(x) => set("priceMin", x)} error={e("priceMin")} />
            <TextField name="priceMax" label={`${a.priceMax} (${t.admin.common.sar})`} dir="ltr" inputMode="numeric" value={v.priceMax} onChange={(x) => set("priceMax", x)} error={e("priceMax")} />
          </div>
        )}
        {v.isFree && errors.priceMin && <p className="text-[13px] font-medium text-coral-500">{e("priceMin")}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="priceNote" label={a.priceNote} hint={a.priceNoteHint} value={v.priceNote} onChange={(x) => set("priceNote", x)} error={e("priceNote")} maxLength={300} />
          <TextField name="ageRestriction" label={a.age} hint={a.ageHint} value={v.ageRestriction} onChange={(x) => set("ageRestriction", x)} error={e("ageRestriction")} maxLength={80} />
          <TextField name="ticketUrl" label={a.ticketUrl} type="url" dir="ltr" placeholder="https://" value={v.ticketUrl} onChange={(x) => set("ticketUrl", x)} error={e("ticketUrl")} />
          <TextField name="officialUrl" label={a.officialUrl} type="url" dir="ltr" placeholder="https://" value={v.officialUrl} onChange={(x) => set("officialUrl", x)} error={e("officialUrl")} />
        </div>
      </Section>

      <Section id="ev-image" title={a.sections.image} lede={a.imageLede}>
        <ImageManager images={v.image ? [v.image] : []} onChange={(x) => set("image", x[0] ?? null)} folder="events" max={1} errors={errors} prefix="image" />
      </Section>

      <Section id="ev-source" title={a.sections.source}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="sourceName" label={a.sourceName} hint={a.sourceNameHint} required value={v.sourceName} onChange={(x) => set("sourceName", x)} error={e("sourceName")} maxLength={200} />
          <TextField name="sourceUrl" label={a.sourceUrl} required type="url" dir="ltr" placeholder="https://" value={v.sourceUrl} onChange={(x) => set("sourceUrl", x)} error={e("sourceUrl")} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            name="lastVerifiedAt"
            label={a.lastVerified}
            type="date"
            dir="ltr"
            className="w-56"
            value={v.lastVerifiedAt}
            onChange={(x) => set("lastVerifiedAt", x)}
            error={e("lastVerifiedAt")}
          />
          <Button type="button" variant="secondary" onClick={() => set("lastVerifiedAt", cityToday())}>
            <CalendarCheck className="size-4" aria-hidden /> {a.verifyToday}
          </Button>
        </div>
      </Section>

      {changes.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-gold-400/60 bg-gold-400/10 p-5 md:p-6" aria-labelledby="change-title">
          <h2 id="change-title" className="flex items-center gap-2 font-display text-xl font-semibold">
            <BellRing className="size-5 text-gold-500" aria-hidden /> {a.changeTitle}
          </h2>
          <p className="text-sm text-ink-700">{a.changeLede.replace("{fields}", fieldsText).replace("{saves}", plural(locale, saves, a.changeSaves))}</p>
          <TextAreaField
            name="changeNote"
            label={a.changeNote}
            hint={a.changeNoteHint}
            required
            rows={2}
            maxLength={300}
            value={v.changeNote}
            onChange={(x) => set("changeNote", x)}
            error={e("changeNote")}
          />
        </section>
      )}

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+12px)] z-10 md:bottom-4">
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-ink-900 p-3 text-sand-50 shadow-lift md:px-4">
          {dirty && <span className="me-auto text-xs text-sand-300">{t.admin.places.unsaved}</span>}
          <Button type="submit" disabled={busy} className="min-w-36">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {busy ? t.admin.common.saving : eventId ? t.admin.common.save : t.admin.common.create}
          </Button>
        </div>
      </div>
    </form>
  );
}
