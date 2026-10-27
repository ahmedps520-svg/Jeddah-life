"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Car, Clock, Footprints, Minus, Plus, RefreshCw, Save, Search, Share2, Trash2, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession, useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button, buttonClass } from "@/components/ui/button";
import { PlaceCover, PriceText } from "@/components/place/place-card";
import { MiniMap } from "@/components/map/mini-map";
import { shareOrCopy } from "@/components/place/place-actions";
import type { Plan, PlanSettings, PlannedStop } from "@/lib/planner/engine";
import type { PlaceLite } from "@/lib/places/types";
import { categoryDef, subcategoryLabel, TRANSPORT } from "@/lib/taxonomy";
import { formatDay, formatMinutes, formatSar, formatSarRange, formatTime, placeName, plural } from "@/lib/i18n/format";
import { intlLocale } from "@/lib/i18n/config";

export type StopInput = { placeId: string; kind: PlannedStop["kind"]; durationMin?: number };

export function weekdayName(date: string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

export function ItineraryView({
  settings: initialSettings,
  plan: initialPlan,
  places: initialPlaces,
  itineraryId,
  initialTitle,
  shareToken: initialShare,
  readOnly = false,
  onRegenerate,
}: {
  settings: PlanSettings;
  plan: Plan;
  places: Record<string, PlaceLite>;
  itineraryId?: string;
  initialTitle?: string;
  shareToken?: string | null;
  readOnly?: boolean;
  onRegenerate?: (s: PlanSettings) => void;
}) {
  const { t, locale } = useI18n();
  const user = useSession();
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [plan, setPlan] = useState(initialPlan);
  const [places, setPlaces] = useState(initialPlaces);
  const [busy, setBusy] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [alts, setAlts] = useState<PlaceLite[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [shareToken, setShareToken] = useState(initialShare ?? null);
  const [dirty, setDirty] = useState(false);

  // A new plan from the parent (e.g. "generate again") replaces local edits.
  const [source, setSource] = useState({ initialPlan, initialPlaces, initialSettings });
  if (source.initialPlan !== initialPlan || source.initialPlaces !== initialPlaces || source.initialSettings !== initialSettings) {
    setSource({ initialPlan, initialPlaces, initialSettings });
    setPlan(initialPlan);
    setPlaces(initialPlaces);
    setSettings(initialSettings);
  }

  const stopsInput = (p: Plan = plan): StopInput[] => p.stops.map((s) => ({ placeId: s.placeId, kind: s.kind, durationMin: s.durationMin }));

  const recalc = useCallback(
    async (stops: StopInput[], s: PlanSettings = settings) => {
      setBusy(true);
      const res = await fetch("/api/planner/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: s, stops }),
      });
      setBusy(false);
      if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
      const d = (await res.json()) as { plan: Plan; places: Record<string, PlaceLite> };
      setPlan(d.plan);
      setPlaces((p) => ({ ...p, ...d.places }));
      setDirty(true);
    },
    [settings, toast, t],
  );

  const move = (i: number, dir: -1 | 1) => {
    const s = stopsInput();
    const j = i + dir;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    recalc(s);
  };
  const remove = (i: number) => recalc(stopsInput().filter((_, k) => k !== i));
  const changeDuration = (i: number, delta: number) => {
    const s = stopsInput();
    s[i] = { ...s[i], durationMin: Math.max(15, Math.min(600, (s[i].durationMin ?? 60) + delta)) };
    recalc(s);
  };

  async function openReplace(i: number) {
    setReplaceIdx(i);
    setAlts(null);
    const res = await fetch("/api/planner/alternatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings, stops: stopsInput(), index: i }),
    });
    setAlts(res.ok ? ((await res.json()) as { places: PlaceLite[] }).places : []);
  }

  async function save() {
    if (!user) return toast(t.planner.signInToSave, { action: { label: t.auth.signIn, href: "/auth/sign-in" } });
    const name = title.trim() || `${t.planner.untitled} — ${weekdayName(settings.date, locale)}`;
    const res = await fetch(itineraryId ? `/api/itineraries/${itineraryId}` : "/api/itineraries", {
      method: itineraryId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: name, settings, stops: stopsInput() }),
    });
    if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
    toast(t.planner.saved);
    setDirty(false);
    if (!itineraryId) {
      const { id } = (await res.json()) as { id: string };
      router.push(`/${locale}/plan/${id}`);
    } else router.refresh();
  }

  async function share() {
    if (!itineraryId) {
      if (!user) return toast(t.planner.signInToSave, { action: { label: t.auth.signIn, href: "/auth/sign-in" } });
      return toast(t.planner.save);
    }
    let token = shareToken;
    if (!token) {
      const res = await fetch(`/api/itineraries/${itineraryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ share: true }),
      });
      if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
      token = ((await res.json()) as { shareToken: string }).shareToken;
      setShareToken(token);
    }
    await shareOrCopy(`${window.location.origin}/${locale}/o/${token}`, title || t.planner.untitled, toast, t.share);
  }

  const totals = plan.totals;
  const groupPhrase = (t.planner.groupPhrase as Record<string, string>)[settings.groupType] ?? "";
  const heading = t.planner.resultTitle.replace("{day}", weekdayName(settings.date, locale)).replace("{group}", groupPhrase);
  const budgetLabel =
    settings.budget == null
      ? null
      : settings.budget === 0
        ? t.common.free
        : `${formatSar(locale, settings.budget)} ${settings.budgetMode === "per_person" ? t.common.perPerson : t.planner.totalGroup}`;
  const transportName = TRANSPORT.find((x) => x.slug === settings.transport)?.name[locale] ?? "";
  const kindLabels = t.planner.stopKind as Record<string, string>;
  const markers = plan.stops
    .map((s, i) => {
      const p = places[s.placeId];
      return p ? { id: p.id, lat: p.lat, lng: p.lng, n: i + 1, color: categoryDef(p.category).color, label: placeName(locale, p) } : null;
    })
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className={`grid gap-8 lg:grid-cols-[1fr_400px] ${busy ? "opacity-70 transition-opacity" : ""}`} aria-busy={busy}>
      <div className="min-w-0 space-y-6">
        <header className="space-y-2">
          {readOnly ? (
            <h1 className="font-display text-[32px] font-semibold leading-tight md:text-[40px]">{initialTitle || heading}</h1>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-wider text-sea-600">
                {formatDay(locale, settings.date, { weekday: "long", year: "numeric" })}
              </p>
              <label className="block">
                <span className="sr-only">{t.planner.titleLabel}</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  maxLength={80}
                  placeholder={heading}
                  className="w-full bg-transparent font-display text-[30px] font-semibold leading-tight outline-none placeholder:text-ink-900 md:text-[40px]"
                />
              </label>
            </>
          )}
          <p className="text-ink-600">
            {budgetLabel && <>{t.planner.budgetLine.replace("{budget}", budgetLabel)} · </>}
            {plural(locale, plan.stops.length, t.planner.stops)} · {formatTime(locale, settings.startTime)}–{formatTime(locale, totals.endsAt)}
          </p>
        </header>

        <ol className="relative space-y-0">
          {plan.stops.map((s, i) => {
            const p = places[s.placeId];
            if (!p) return null;
            const def = categoryDef(p.category);
            return (
              <li key={`${s.placeId}-${i}`} className="relative">
                {s.travel && (
                  <div className="flex items-center gap-2 py-2 ps-[22px] text-xs text-ink-500">
                    <span className="h-6 border-s-2 border-dashed border-sand-400" aria-hidden />
                    {settings.transport === "walk" ? <Footprints className="size-3.5" /> : <Car className="size-3.5" />}
                    {t.planner.travelApprox.replace("{min}", formatMinutes(locale, s.travel.minutes)).replace("{mode}", transportName)}
                  </div>
                )}
                <div className="flex gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: def.color }}>
                      {i + 1}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-ink-600">{formatTime(locale, s.arriveAt)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-3">
                      <Link href={`/${locale}/place/${p.slug}`} className="shrink-0">
                        <PlaceCover p={p} sizes="96px" className="size-20 rounded-xl" />
                      </Link>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          {kindLabels[s.kind] ?? ""} · {subcategoryLabel(p.sub, locale) ?? def.name[locale]}
                        </p>
                        <Link href={`/${locale}/place/${p.slug}`} className="block truncate font-display text-lg font-semibold hover:text-sea-600">
                          {placeName(locale, p)}
                        </Link>
                        <p className="text-sm text-ink-700">
                          {s.cost.basis === "unknown" ? (
                            <span className="text-coral-500">{t.common.priceUnknown}</span>
                          ) : (
                            <PriceText p={p} locale={locale} t={t} />
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-ink-500">
                          <Clock className="size-3.5" /> {t.planner.durationFor.replace("{duration}", formatMinutes(locale, s.durationMin))}
                        </p>
                        <p className={`text-xs ${s.open === false ? "text-coral-500" : s.open ? "text-sea-600" : "text-ink-400"}`}>
                          {s.open === true ? t.planner.openAtArrival : s.open === false ? t.planner.closedAtArrival : t.planner.hoursUnknown}
                        </p>
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-sand-200 pt-2">
                        <button type="button" onClick={() => openReplace(i)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-sand-200">
                          <RefreshCw className="size-3.5" /> {t.planner.replace}
                        </button>
                        <button type="button" onClick={() => changeDuration(i, -15)} className="rounded-full p-1.5 hover:bg-sand-200" aria-label="-15">
                          <Minus className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => changeDuration(i, 15)} className="rounded-full p-1.5 hover:bg-sand-200" aria-label="+15">
                          <Plus className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1.5 hover:bg-sand-200 disabled:opacity-30" aria-label={t.planner.moveUp}>
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === plan.stops.length - 1}
                          className="rounded-full p-1.5 hover:bg-sand-200 disabled:opacity-30"
                          aria-label={t.planner.moveDown}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => remove(i)} className="ms-auto rounded-full p-1.5 text-ink-400 hover:bg-sand-200 hover:text-coral-500" aria-label={t.planner.remove}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdding(true)} disabled={plan.stops.length >= 10}>
              <Plus className="size-4" /> {t.planner.addStop}
            </Button>
            {onRegenerate && (
              <Button variant="ghost" onClick={() => onRegenerate(settings)}>
                <RefreshCw className="size-4" /> {t.planner.regenerate}
              </Button>
            )}
          </div>
        )}

        <p className="rounded-2xl bg-sand-200/60 p-4 text-xs leading-relaxed text-ink-600">{t.planner.estimatesNote}</p>
      </div>

      <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
        <section className="space-y-3 rounded-3xl bg-ink-900 p-5 text-sand-50 shadow-lift" aria-labelledby="totals">
          <h2 id="totals" className="flex items-center gap-2 font-semibold">
            <Wallet className="size-4 text-coral-400" /> {t.planner.total}
          </h2>
          <p className="font-display text-[34px] font-semibold leading-none">
            {formatSar(locale, totals.perPerson)} <span className="text-base font-normal text-ink-300">{t.planner.totalPerPerson}</span>
          </p>
          <p className="text-sm text-ink-300">
            {formatSar(locale, totals.group)} {t.planner.totalGroup} · {settings.groupSize}×
          </p>
          {totals.budgetPerPerson != null && (
            <p className={`rounded-xl px-3 py-2 text-sm font-medium ${totals.overPerPerson > 0 ? "bg-coral-500/20 text-coral-400" : "bg-sea-500/20 text-sea-200"}`}>
              {totals.overPerPerson > 0
                ? t.planner.overBudget.replace("{amount}", formatSar(locale, totals.overPerPerson))
                : totals.unknownStops > 0
                  ? t.planner.withinBudgetKnown
                  : t.planner.withinBudget}
            </p>
          )}
          {totals.overPerPerson > 0 && (
            <p className="text-xs text-ink-300">
              {t.planner.overBudgetWhy.replace(
                "{stops}",
                totals.overStops.map((id) => (places[id] ? placeName(locale, places[id]) : "")).join(locale === "ar" ? "، " : ", "),
              )}
            </p>
          )}
          {totals.unknownStops > 0 && (
            <p className="flex items-start gap-2 text-xs text-coral-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {plural(locale, totals.unknownStops, t.planner.unknownCosts)}
            </p>
          )}
          <ul className="space-y-1 border-t border-white/10 pt-3 text-sm">
            {plan.stops.map((s, i) => {
              const p = places[s.placeId];
              return (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-ink-200">
                    {i + 1}. {p ? placeName(locale, p) : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {s.cost.basis === "free"
                      ? t.common.free
                      : s.cost.min != null && s.cost.max != null
                        ? `${formatSarRange(locale, s.cost.min, s.cost.max)}${s.cost.basis === "estimate" ? "*" : ""}`
                        : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-ink-400">* {t.place.priceEstimate}</p>
          <div className="border-t border-white/10 pt-3 text-sm text-ink-200">
            <p>
              {t.planner.timeUsed.replace("{used}", formatMinutes(locale, totals.totalMinutes)).replace("{available}", formatMinutes(locale, settings.durationMin))}
            </p>
            {totals.overTimeMin > 0 && <p className="text-coral-400">{t.planner.overTime.replace("{over}", formatMinutes(locale, totals.overTimeMin))}</p>}
          </div>
        </section>

        {!readOnly && (
          <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
            <h2 className="font-semibold">{t.planner.edit}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-ink-500">{t.planner.budgetAmount}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={settings.budget ?? ""}
                  onChange={(e) => setSettings({ ...settings, budget: e.target.value === "" ? null : Number(e.target.value) })}
                  onBlur={() => recalc(stopsInput(), settings)}
                  className="h-10 w-full rounded-xl border border-sand-300 px-3"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ink-500">{t.planner.duration}</span>
                <select
                  value={settings.durationMin}
                  onChange={(e) => {
                    const s = { ...settings, durationMin: Number(e.target.value) };
                    setSettings(s);
                    recalc(stopsInput(), s);
                  }}
                  className="h-10 w-full rounded-xl border border-sand-300 px-2"
                >
                  {[90, 120, 180, 240, 300, 360, 480].map((m) => (
                    <option key={m} value={m}>
                      {formatMinutes(locale, m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.budgetMode === "group"}
                onChange={(e) => {
                  const s = { ...settings, budgetMode: (e.target.checked ? "group" : "per_person") as PlanSettings["budgetMode"] };
                  setSettings(s);
                  recalc(stopsInput(), s);
                }}
                className="accent-sea-500"
              />
              {t.planner.budgetGroup}
            </label>
          </section>
        )}

        <MiniMap markers={markers} connect className="h-72" ariaLabel={t.planner.viewRoute} />
        <p className="text-xs text-ink-500">{t.planner.routeNote}</p>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || (!!itineraryId && !dirty)}>
              <Save className="size-4" /> {t.planner.save}
            </Button>
            <Button variant="secondary" onClick={share}>
              <Share2 className="size-4" /> {t.planner.share}
            </Button>
            {itineraryId && (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm(t.planner.deleteConfirm)) return;
                  const res = await fetch(`/api/itineraries/${itineraryId}`, { method: "DELETE" });
                  if (res.ok) router.push(`/${locale}/saved?tab=outings`);
                }}
              >
                <Trash2 className="size-4" /> {t.planner.deleteOuting}
              </Button>
            )}
          </div>
        )}
        {!readOnly && shareToken && <p className="text-xs text-ink-500">{t.planner.shareNote}</p>}
        {readOnly && (
          <Link href={`/${locale}/plan`} className={buttonClass("primary")}>
            {t.home.planCta}
          </Link>
        )}
      </aside>

      <Sheet open={replaceIdx !== null} onClose={() => setReplaceIdx(null)} title={t.planner.replaceWith} labelledBy="replace-title">
        {alts === null ? (
          <p className="text-sm text-ink-500">{t.common.loading}</p>
        ) : alts.length === 0 ? (
          <p className="text-sm text-ink-500">{t.planner.noPlan}</p>
        ) : (
          <ul className="space-y-2">
            {alts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    const s = stopsInput();
                    if (replaceIdx === null) return;
                    s[replaceIdx] = { placeId: p.id, kind: s[replaceIdx].kind };
                    setReplaceIdx(null);
                    recalc(s);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-start hover:bg-sand-100"
                >
                  <PlaceCover p={p} sizes="64px" className="size-16 shrink-0 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{placeName(locale, p)}</span>
                    <span className="block text-xs text-ink-500">{subcategoryLabel(p.sub, locale) ?? categoryDef(p.category).name[locale]}</span>
                    <span className="block text-xs text-ink-700">
                      {p.cost.basis === "unknown" ? t.common.priceUnknown : <PriceText p={p} locale={locale} t={t} />}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <AddStopSheet
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(p) => {
          setAdding(false);
          setPlaces((x) => ({ ...x, [p.id]: p }));
          recalc([...stopsInput(), { placeId: p.id, kind: "custom" }]);
        }}
      />
    </div>
  );
}

export function AddStopSheet({ open, onClose, onPick, title }: { open: boolean; onClose: () => void; onPick: (p: PlaceLite) => void; title?: string }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceLite[]>([]);
  const shownHits = q.trim().length >= 2 ? hits : [];
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(q)}&limit=12`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { hits: PlaceLite[] }) => setHits(d.hits))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);
  return (
    <Sheet open={open} onClose={onClose} title={title ?? t.planner.addStop} labelledBy="add-stop">
      <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-sand-300 bg-white px-3">
        <Search className="size-4 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.planner.addStopSearch} className="flex-1 bg-transparent outline-none" autoFocus />
      </label>
      <ul className="space-y-1">
        {shownHits.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-start hover:bg-sand-100">
              <PlaceCover p={p} sizes="56px" className="size-14 shrink-0 rounded-xl" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{placeName(locale, p)}</span>
                <span className="block text-xs text-ink-500">{subcategoryLabel(p.sub, locale) ?? categoryDef(p.category).name[locale]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
