"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Dices, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation, useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { PlaceCover } from "@/components/place/place-card";
import { INTERESTS } from "@/lib/taxonomy";
import { cityToday, formatMinutes, formatNumber, formatSar, formatSarRange, formatTime, placeName, plural } from "@/lib/i18n/format";
import type { Plan, PlanSettings } from "@/lib/planner/engine";
import type { PlaceLite } from "@/lib/places/types";
import { HANDOFF_KEY } from "./planner-wizard";

type Option = { key: "food" | "adventure" | "chill" | "surprise"; plan: Plan | null };

export function MakeItHappen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { origin } = useCityLocation();
  const [budget, setBudget] = useState(150);
  const [mode, setMode] = useState<"group" | "per_person">("group");
  const [hours, setHours] = useState(4);
  const [people, setPeople] = useState(4);
  const [interests, setInterests] = useState<string[]>([]);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [places, setPlaces] = useState<Record<string, PlaceLite>>({});
  const [settings, setSettings] = useState<PlanSettings | null>(null);
  const [loading, setLoading] = useState<"options" | "surprise" | null>(null);

  const build = (): PlanSettings => {
    const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const [h] = now.split(":").map(Number);
    const startH = Math.min(22, Math.max(9, h + 1));
    return {
      groupType: people === 1 ? "solo" : people === 2 ? "couple" : people >= 7 ? "large" : "friends",
      groupSize: people,
      budget,
      budgetMode: mode,
      interests,
      date: cityToday(),
      startTime: `${String(startH).padStart(2, "0")}:00`,
      durationMin: hours * 60,
      start: origin ? { lat: origin.lat, lng: origin.lng } : null,
      transport: "car",
    };
  };

  async function run(kind: "options" | "surprise") {
    const s = build();
    setLoading(kind);
    const res = await fetch("/api/planner/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: s, mode: kind, seed: Math.floor(Math.random() * 1e9) }),
    });
    setLoading(null);
    if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
    const d = (await res.json()) as { options: Option[]; places: Record<string, PlaceLite> };
    setSettings(s);
    setPlaces(d.places);
    setOptions(d.options);
    setTimeout(() => document.getElementById("mih-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function choose(o: Option) {
    if (!o.plan || !settings) return;
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ plan: o.plan, places, settings }));
    router.push(`/${locale}/plan`);
  }

  const meta = {
    food: { name: t.mih.optionA, desc: t.mih.optionADesc },
    adventure: { name: t.mih.optionB, desc: t.mih.optionBDesc },
    chill: { name: t.mih.optionC, desc: t.mih.optionCDesc },
    surprise: { name: t.mih.optionSurprise, desc: t.mih.surpriseNote },
  };
  const num = "w-20 rounded-lg border-b-2 border-sea-400 bg-transparent px-1 text-center font-display text-[inherit] font-semibold outline-none focus:border-coral-400";

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-ink-900 p-6 text-sand-50 shadow-lift md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral-400">{t.mih.kicker}</p>
        <div className="mt-4 font-display text-[26px] leading-[1.5] md:text-[36px]">
          <label>
            <span className="sr-only">{t.mih.budget}</span>
            {locale === "ar" ? "عندنا " : "We have "}
            <input type="number" inputMode="numeric" min={0} max={20000} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} className={num} />
            {locale === "ar" ? " ريال" : " SAR"}
          </label>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mx-2 rounded-lg bg-white/10 px-2 py-0.5 text-[0.6em] align-middle outline-none">
            <option value="group">{t.planner.budgetGroup}</option>
            <option value="per_person">{t.planner.budgetPerPerson}</option>
          </select>
          {locale === "ar" ? "، و" : ", "}
          <label>
            <span className="sr-only">{t.mih.time}</span>
            <input type="number" inputMode="numeric" min={1} max={12} value={hours} onChange={(e) => setHours(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className={num} />
            {locale === "ar" ? " ساعات" : hours === 1 ? " hour" : " hours"}
          </label>
          {locale === "ar" ? "، و" : " and "}
          <label>
            <span className="sr-only">{t.mih.people}</span>
            <input type="number" inputMode="numeric" min={1} max={30} value={people} onChange={(e) => setPeople(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className={num} />
            {locale === "ar" ? " أشخاص." : people === 1 ? " person." : " people."}
          </label>
        </div>
        <fieldset className="mt-6">
          <legend className="mb-2 text-sm text-ink-300">{t.mih.interests}</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.includes(i.slug);
              return (
                <button
                  key={i.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInterests(on ? interests.filter((x) => x !== i.slug) : [...interests, i.slug])}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${on ? "bg-sea-400 text-ink-950" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {i.name[locale]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => run("options")} disabled={loading !== null}>
            <Sparkles className="size-5" /> {loading === "options" ? t.planner.generating : t.mih.go}
          </Button>
          <Button size="lg" variant="outline-light" onClick={() => run("surprise")} disabled={loading !== null}>
            <Dices className="size-5" /> {loading === "surprise" ? t.planner.generating : t.mih.surprise}
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-400">{t.mih.surpriseNote}</p>
      </section>

      {options && settings && (
        <section id="mih-results" aria-labelledby="mih-compare" className="scroll-mt-24 space-y-4">
          <h2 id="mih-compare" className="font-display text-[28px] font-semibold">
            {options.length > 1 ? t.mih.compare : t.mih.optionSurprise}
          </h2>
          <div className={`grid gap-5 ${options.length > 1 ? "md:grid-cols-3" : "max-w-xl"}`}>
            {options.map((o) => (
              <OptionCard key={o.key} o={o} meta={meta[o.key]} places={places} settings={settings} onChoose={() => choose(o)} />
            ))}
          </div>
          <p className="rounded-2xl bg-sand-200/60 p-4 text-xs leading-relaxed text-ink-600">{t.planner.estimatesNote}</p>
        </section>
      )}
      <p className="text-sm text-ink-500">
        <Link href={`/${locale}/plan`} className="font-medium text-sea-600 hover:underline">
          {t.planner.title}
        </Link>
      </p>
    </div>
  );
}

function OptionCard({
  o,
  meta,
  places,
  settings,
  onChoose,
}: {
  o: Option;
  meta: { name: string; desc: string };
  places: Record<string, PlaceLite>;
  settings: PlanSettings;
  onChoose: () => void;
}) {
  const { t, locale } = useI18n();
  const plan = o.plan;
  const tt = plan?.totals;
  const budgetGroup = tt?.budgetGroup ?? null;
  const colors = ["#127c83", "#d9734f", "#b8955a", "#5b4b8a", "#2f7d4f"];
  return (
    <article className="flex flex-col rounded-3xl bg-white p-5 shadow-card">
      <h3 className="font-display text-2xl font-semibold">{meta.name}</h3>
      <p className="mt-1 text-sm text-ink-500">{meta.desc}</p>
      {!plan ? (
        <div className="mt-6 rounded-2xl bg-sand-100 p-4 text-sm text-ink-600">
          <p>{t.mih.noOption}</p>
          <p className="mt-1 text-ink-500">{t.mih.noOptionWhy}</p>
        </div>
      ) : (
        <>
          <ol className="mt-5 space-y-3">
            {plan.stops.map((s, i) => {
              const p = places[s.placeId];
              if (!p) return null;
              return (
                <li key={s.placeId} className="flex items-center gap-3">
                  <PlaceCover p={p} sizes="56px" className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-ink-400">
                      {formatTime(locale, s.arriveAt)} · {(t.planner.stopKind as Record<string, string>)[s.kind] ?? ""}
                    </p>
                    <Link href={`/${locale}/place/${p.slug}`} className="block truncate font-semibold hover:text-sea-600">
                      {i + 1}. {placeName(locale, p)}
                    </Link>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {s.cost.basis === "free"
                      ? t.common.free
                      : s.cost.min != null && s.cost.max != null
                        ? formatSarRange(locale, s.cost.min, s.cost.max)
                        : "—"}
                  </span>
                </li>
              );
            })}
          </ol>

          {tt && (
            <div className="mt-5 space-y-3 border-t border-sand-200 pt-4">
              <h4 className="text-sm font-semibold">{t.mih.breakdown}</h4>
              {budgetGroup != null && budgetGroup > 0 && (
                <div className="flex h-3 overflow-hidden rounded-full bg-sand-200" role="img" aria-label={t.mih.breakdown}>
                  {plan.stops.map((s, i) =>
                    (s.cost.perPerson ?? 0) > 0 ? (
                      <span
                        key={i}
                        style={{ width: `${Math.min(100, (((s.cost.perPerson ?? 0) * settings.groupSize) / budgetGroup) * 100)}%`, background: colors[i % colors.length] }}
                      />
                    ) : null,
                  )}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-ink-500">{t.common.perPerson}</dt>
                <dd className="text-end font-semibold tabular-nums">{formatSar(locale, tt.perPerson)}</dd>
                <dt className="text-ink-500">{t.mih.groupTotal}</dt>
                <dd className="text-end font-semibold tabular-nums">{formatSar(locale, tt.group)}</dd>
                <dt className="text-ink-500">{t.mih.totalTime}</dt>
                <dd className="text-end tabular-nums">{formatMinutes(locale, tt.totalMinutes)}</dd>
              </dl>
              {budgetGroup != null &&
                (tt.overGroup > 0 ? (
                  <p className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-medium text-coral-500">{t.mih.over.replace("{amount}", formatSar(locale, tt.overGroup))}</p>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-xl bg-sea-50 px-3 py-2 text-sm font-medium text-sea-700">
                    <Check className="size-4" /> {t.mih.fits} · {t.mih.leftOver.replace("{amount}", formatSar(locale, Math.max(0, budgetGroup - tt.group)))}
                  </p>
                ))}
              {tt.unknownStops > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-coral-500">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {t.mih.unknownWarning}
                </p>
              )}
              {plan.walkable && <p className="text-xs text-sea-700">{t.mih.walkable}</p>}
              <p className="text-[11px] text-ink-400">{plural(locale, plan.stops.length, t.planner.stops)} · {formatNumber(locale, settings.groupSize)}×</p>
            </div>
          )}
          <Button className="mt-auto w-full" onClick={onChoose}>
            {t.mih.choose}
          </Button>
        </>
      )}
    </article>
  );
}
