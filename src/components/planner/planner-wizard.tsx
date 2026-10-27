"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation, useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { useNeighbourhoods } from "@/components/layout/location-picker";
import { GROUP_TYPES, INTERESTS, TRANSPORT } from "@/lib/taxonomy";
import { cityToday, formatNumber, plural } from "@/lib/i18n/format";
import type { Plan, PlanSettings } from "@/lib/planner/engine";
import type { PlaceLite } from "@/lib/places/types";
import { ItineraryView } from "./itinerary-view";

const BUDGETS = [0, 50, 100, 200, 500];
const DURATIONS = [120, 180, 240, 360, 480];

function nextHour() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }).format(new Date());
  const h = (Number(parts) + 1) % 24;
  return `${String(Math.max(h, 8)).padStart(2, "0")}:00`;
}

export const HANDOFF_KEY = "jl_plan_handoff";

export function PlannerWizard({
  mustInclude,
  mustIncludeName,
  initialStart,
}: {
  mustInclude?: string | null;
  mustIncludeName?: string | null;
  /** Neighbourhood slug to start from, e.g. when coming from a neighbourhood guide */
  initialStart?: string | null;
}) {
  const { t, locale, dir } = useI18n();
  const toast = useToast();
  const { origin, location } = useCityLocation();
  const hoods = useNeighbourhoods();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<PlanSettings>({
    groupType: "friends",
    groupSize: 4,
    budget: 150,
    budgetMode: "per_person",
    interests: [],
    date: cityToday(),
    startTime: "17:00",
    durationMin: 240,
    start: null,
    transport: "car",
  });
  const [customBudget, setCustomBudget] = useState(false);
  const [startChoice, setStartChoice] = useState<"anywhere" | "device" | string>(initialStart ?? "anywhere");
  const [result, setResult] = useState<{ plan: Plan; places: Record<string, PlaceLite>; settings: PlanSettings } | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    setS((x) => ({ ...x, startTime: nextHour() }));
    // A plan handed over from Make It Happen or an event page.
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      if (raw) {
        sessionStorage.removeItem(HANDOFF_KEY);
        const d = JSON.parse(raw) as { plan: Plan; places: Record<string, PlaceLite>; settings: PlanSettings };
        setS(d.settings);
        setResult(d);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (location.kind === "device" && startChoice === "anywhere") setStartChoice("device");
  }, [location.kind, startChoice]);

  async function generate(settings: PlanSettings = s, seed?: number) {
    setLoading(true);
    setEmpty(false);
    const start =
      startChoice === "device" && origin
        ? { lat: origin.lat, lng: origin.lng, label: t.header.myLocation }
        : startChoice !== "anywhere" && startChoice !== "device"
          ? (() => {
              const h = hoods?.find((x) => x.slug === startChoice);
              return h ? { lat: h.center[0], lng: h.center[1], label: locale === "ar" ? h.nameAr || h.nameEn : h.nameEn } : null;
            })()
          : null;
    const finalSettings = { ...settings, start };
    const res = await fetch("/api/planner/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: finalSettings, seed: seed ?? Math.floor(Math.random() * 1e9), mustInclude: mustInclude ?? null }),
    });
    setLoading(false);
    if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
    const d = (await res.json()) as { plan: Plan | null; places: Record<string, PlaceLite> };
    if (!d.plan || !d.plan.stops.length) {
      setEmpty(true);
      return;
    }
    setResult({ plan: d.plan, places: d.places, settings: finalSettings });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return (
      <div className="animate-fade-up space-y-6">
        <button type="button" onClick={() => setResult(null)} className="text-sm font-medium text-sea-600 hover:underline">
          ← {t.planner.edit}
        </button>
        <ItineraryView
          settings={result.settings}
          plan={result.plan}
          places={result.places}
          onRegenerate={(settings) => generate(settings)}
        />
      </div>
    );
  }

  const steps = [t.planner.stepGroup, t.planner.stepBudget, t.planner.stepInterests, t.planner.stepSchedule];
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;
  const Next = dir === "rtl" ? ArrowLeft : ArrowRight;
  const tile = (active: boolean) =>
    `rounded-2xl p-4 text-start ring-1 transition active:scale-[0.98] ${active ? "bg-ink-900 text-white ring-ink-900 shadow-lift" : "bg-white ring-sand-200 hover:ring-ink-300"}`;

  return (
    <div className="mx-auto max-w-2xl">
      {mustIncludeName && (
        <p className="mb-4 rounded-2xl bg-sea-50 px-4 py-3 text-sm text-sea-700">
          <Sparkles className="me-1.5 inline size-4" />
          {mustIncludeName}
        </p>
      )}
      <div className="mb-6">
        <p className="text-sm text-ink-500">{t.planner.step.replace("{n}", formatNumber(locale, step + 1)).replace("{total}", formatNumber(locale, steps.length))}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-sea-500" : "bg-sand-300"}`} />
          ))}
        </div>
        <h2 className="mt-5 font-display text-[30px] font-semibold leading-tight md:text-[36px]">{steps[step]}</h2>
      </div>

      <div key={step} className="animate-fade-up">
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {GROUP_TYPES.map((g) => (
                <button key={g.slug} type="button" onClick={() => setS({ ...s, groupType: g.slug, groupSize: g.slug === "custom" ? s.groupSize : g.size })} className={tile(s.groupType === g.slug)} aria-pressed={s.groupType === g.slug}>
                  <span className="block font-display text-xl font-semibold">{g.name[locale]}</span>
                  <span className={`text-sm ${s.groupType === g.slug ? "text-ink-200" : "text-ink-500"}`}>{plural(locale, g.size, t.mih.peopleCount)}</span>
                </button>
              ))}
            </div>
            {s.groupType !== "solo" && s.groupType !== "couple" && (
              <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
                <span className="font-medium">{t.planner.groupSize}</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setS({ ...s, groupSize: Math.max(2, s.groupSize - 1) })} className="grid size-10 place-items-center rounded-full ring-1 ring-sand-300" aria-label="-1">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center font-display text-2xl tabular-nums">{formatNumber(locale, s.groupSize)}</span>
                  <button type="button" onClick={() => setS({ ...s, groupSize: Math.min(50, s.groupSize + 1) })} className="grid size-10 place-items-center rounded-full ring-1 ring-sand-300" aria-label="+1">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setCustomBudget(false);
                    setS({ ...s, budget: b });
                  }}
                  className={tile(!customBudget && s.budget === b)}
                  aria-pressed={!customBudget && s.budget === b}
                >
                  <span className="block font-display text-xl font-semibold">
                    {b === 0 ? t.planner.budgetPresetFree : t.planner.budgetPresetUnder.replace("{n}", formatNumber(locale, b))}
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => setCustomBudget(true)} className={tile(customBudget)} aria-pressed={customBudget}>
                <span className="block font-display text-xl font-semibold">{t.planner.budgetCustom}</span>
              </button>
            </div>
            {customBudget && (
              <label className="block rounded-2xl bg-white p-4 shadow-card">
                <span className="mb-2 block font-medium">{t.planner.budgetAmount}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100000}
                  value={s.budget ?? ""}
                  onChange={(e) => setS({ ...s, budget: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                  className="h-12 w-full rounded-xl border border-sand-300 px-4 text-lg"
                />
              </label>
            )}
            {s.budget !== 0 && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-sand-200/70 p-1.5">
                {(["per_person", "group"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setS({ ...s, budgetMode: m })}
                    aria-pressed={s.budgetMode === m}
                    className={`rounded-xl py-2.5 text-sm font-medium transition ${s.budgetMode === m ? "bg-white shadow-card" : "text-ink-600"}`}
                  >
                    {m === "per_person" ? t.planner.budgetPerPerson : t.planner.budgetGroup}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-ink-500">{t.planner.interestsHint}</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = s.interests.includes(i.slug);
                return (
                  <button
                    key={i.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setS({ ...s, interests: on ? s.interests.filter((x) => x !== i.slug) : [...s.interests, i.slug] })}
                    className={`rounded-full px-5 py-3 text-[15px] font-medium transition active:scale-95 ${on ? "bg-sea-500 text-white shadow-lift" : "bg-white ring-1 ring-sand-300 hover:ring-ink-300"}`}
                  >
                    {i.name[locale]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block rounded-2xl bg-white p-4 shadow-card">
                <span className="mb-1 block text-sm font-medium">{t.planner.date}</span>
                <input type="date" min={cityToday()} value={s.date} onChange={(e) => setS({ ...s, date: e.target.value || cityToday() })} className="h-11 w-full rounded-xl border border-sand-300 px-3" />
              </label>
              <label className="block rounded-2xl bg-white p-4 shadow-card">
                <span className="mb-1 block text-sm font-medium">{t.planner.startTime}</span>
                <input type="time" value={s.startTime} onChange={(e) => setS({ ...s, startTime: e.target.value || "17:00" })} className="h-11 w-full rounded-xl border border-sand-300 px-3" />
              </label>
            </div>
            <fieldset className="rounded-2xl bg-white p-4 shadow-card">
              <legend className="mb-2 px-1 text-sm font-medium">{t.planner.duration}</legend>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setS({ ...s, durationMin: m })}
                    aria-pressed={s.durationMin === m}
                    className={`rounded-full px-4 py-2 text-sm ${s.durationMin === m ? "bg-ink-900 text-white" : "ring-1 ring-sand-300"}`}
                  >
                    {plural(locale, m / 60, t.planner.hours)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block rounded-2xl bg-white p-4 shadow-card">
              <span className="mb-1 block text-sm font-medium">{t.planner.startFrom}</span>
              <select value={startChoice} onChange={(e) => setStartChoice(e.target.value)} className="h-11 w-full rounded-xl border border-sand-300 px-3">
                <option value="anywhere">{t.planner.startAnywhere}</option>
                {origin && location.kind === "device" && <option value="device">{t.planner.startMyLocation}</option>}
                {(hoods ?? [])
                  .filter((h) => h.featured)
                  .concat((hoods ?? []).filter((h) => !h.featured))
                  .map((h) => (
                    <option key={h.slug} value={h.slug}>
                      {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                    </option>
                  ))}
              </select>
            </label>
            <fieldset className="rounded-2xl bg-white p-4 shadow-card">
              <legend className="mb-2 px-1 text-sm font-medium">{t.planner.transport}</legend>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORT.map((m) => (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => setS({ ...s, transport: m.slug })}
                    aria-pressed={s.transport === m.slug}
                    className={`rounded-xl py-2.5 text-sm ${s.transport === m.slug ? "bg-ink-900 text-white" : "ring-1 ring-sand-300"}`}
                  >
                    {m.name[locale]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {empty && <p className="mt-5 rounded-2xl bg-coral-400/15 p-4 text-sm text-coral-500">{t.planner.noPlan}</p>}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}>
          <Back className="size-4" /> {t.common.back}
        </Button>
        {step < 3 ? (
          <Button size="lg" onClick={() => setStep((x) => x + 1)} disabled={step === 1 && s.budget == null}>
            {t.common.next} <Next className="size-4" />
          </Button>
        ) : (
          <Button size="lg" onClick={() => generate()} disabled={loading}>
            <Sparkles className="size-4" /> {loading ? t.planner.generating : t.planner.generate}
          </Button>
        )}
      </div>
    </div>
  );
}
