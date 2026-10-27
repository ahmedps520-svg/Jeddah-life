"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  HelpCircle,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/place/cover-art";
import { MiniMap } from "@/components/map/mini-map";
import { categoryDef, subcategoryLabel, TRANSPORT } from "@/lib/taxonomy";
import { cityToday, fmt, formatDay, formatMinutes, formatSar, formatSarRange, formatTime, placeName, relativeTime } from "@/lib/i18n/format";
import { directionsUrl } from "@/lib/map/style";
import type { PlanState } from "@/lib/together";

type Option = PlanState["options"][number];
type Hit = { id: string; nameEn: string | null; nameAr: string | null; category: string; sub: string | null };

const POLL_MS = 5000;

export function PlanRoom({ initial }: { initial: PlanState }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const version = useRef(initial.plan.version);
  const code = s.plan.code;
  const base = `/api/together/${code}`;
  const me = s.me!;
  const isOrg = me.role === "organizer";
  const open = s.plan.status === "planning";
  const T = t.together;

  const refresh = useCallback(async () => {
    const res = await fetch(`${base}?v=${version.current}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as PlanState | { unchanged: true } | { preview: unknown };
    if ("plan" in d) {
      version.current = d.plan.version;
      setS(d);
    } else if ("preview" in d) {
      router.refresh(); // We were removed from the plan.
    }
  }, [base, router]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, method: string, payload?: unknown): Promise<boolean> => {
      const res = await fetch(url, {
        method,
        headers: payload ? { "content-type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      }).catch(() => null);
      if (!res?.ok) {
        const code = res ? (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "") : "";
        toast((T.errors as Record<string, string>)[code] ?? t.common.somethingWrong, { tone: "error" });
        return false;
      }
      await refresh();
      return true;
    },
    [refresh, toast, T.errors, t.common.somethingWrong],
  );

  const placeOpts = useMemo(() => s.options.filter((o) => o.kind === "place").sort((a, b) => b.score - a.score), [s.options]);
  const dateOpts = useMemo(
    () => s.options.filter((o) => o.kind === "date").sort((a, b) => b.score - a.score || (a.date ?? "").localeCompare(b.date ?? "")),
    [s.options],
  );
  const whenLabel = (v: string) => {
    const [d, time] = v.split("T");
    const day = formatDay(locale, d, { weekday: "long", day: "numeric", month: "long" });
    return time ? `${day} · ${formatTime(locale, time)}` : day;
  };
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/together/${code}` : "";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-coral-500">
            {T.title} · {s.plan.status === "final" ? T.statusFinal : s.plan.status === "cancelled" ? T.statusCancelled : T.statusPlanning}
          </p>
          <h1 className="mt-1 font-display text-[34px] font-semibold leading-tight md:text-[44px]" dir="auto">
            {s.plan.title}
          </h1>
          {s.plan.description && (
            <p className="mt-2 whitespace-pre-line text-ink-600" dir="auto">
              {s.plan.description}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-400">{T.liveNote}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 ps-4 shadow-card">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{T.codeLabel}</p>
            <p className="font-mono text-xl font-semibold tracking-[0.2em]" dir="ltr">
              {code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(code).then(() => toast(T.codeCopied), () => {})}
            className="rounded-full p-2.5 text-ink-500 hover:bg-sand-100"
            aria-label={T.copyCode}
          >
            <Copy className="size-5" />
          </button>
          <Button
            size="sm"
            onClick={async () => {
              const text = fmt(T.shareText, { title: s.plan.title, code });
              try {
                if (navigator.share) return await navigator.share({ title: s.plan.title, text, url: shareUrl });
                await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
                toast(t.share.copied);
              } catch (e) {
                if ((e as Error)?.name !== "AbortError") toast(t.share.failed, { tone: "error" });
              }
            }}
          >
            <Share2 className="size-4" /> {T.share}
          </Button>
        </div>
      </header>

      {s.plan.status === "cancelled" && <p className="rounded-2xl bg-coral-400/15 p-4 text-ink-800">{T.cancelledNote}</p>}
      {s.plan.status === "final" && <FinalPlan s={s} />}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {/* Places */}
          <section aria-labelledby="places-title" className="space-y-4">
            <h2 id="places-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <MapPin className="size-5 text-sea-600" /> {T.places}
            </h2>
            {open && <PlaceSearch onPick={(id) => mutate(`${base}/options`, "POST", { kind: "place", placeId: id })} />}
            {placeOpts.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-sm text-ink-500 ring-1 ring-sand-200">{T.noPlaces}</p>
            ) : (
              <ul className="space-y-3">
                {placeOpts.map((o) => (
                  <PlaceOption key={o.id} o={o} s={s} open={open} canRemove={open && (o.proposedBy.id === me.id || isOrg)} mutate={mutate} base={base} />
                ))}
              </ul>
            )}
          </section>

          {/* Dates */}
          <section aria-labelledby="dates-title" className="space-y-4">
            <h2 id="dates-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <CalendarDays className="size-5 text-sea-600" /> {T.dates}
            </h2>
            {open && <DateAdder onAdd={(date) => mutate(`${base}/options`, "POST", { kind: "date", date })} />}
            {dateOpts.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-sm text-ink-500 ring-1 ring-sand-200">{T.noDates}</p>
            ) : (
              <ul className="space-y-2">
                {dateOpts.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
                    <div className="min-w-0">
                      <p className="font-medium">{whenLabel(o.date!)}</p>
                      <VoteSummary o={o} />
                      <p className="text-xs text-ink-400">{fmt(T.suggestedBy, { name: o.proposedBy.name })}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <VoteButtons o={o} meId={me.id} disabled={!open} onVote={(value) => mutate(`${base}/votes`, "PUT", { optionId: o.id, value })} />
                      {open && (o.proposedBy.id === me.id || isOrg) && (
                        <button type="button" onClick={() => mutate(`${base}/options/${o.id}`, "DELETE")} className="rounded-full p-2 text-ink-400 hover:bg-sand-100 hover:text-coral-600" aria-label={T.remove}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <People s={s} meId={me.id} />
          <Budget s={s} placeOpts={placeOpts} isOrg={isOrg && open} onSave={(v) => mutate(base, "PATCH", { budgetPerPerson: v })} />
          <Discussion s={s} meId={me.id} onSend={(body) => mutate(`${base}/comments`, "POST", { body })} />
          {isOrg && open && (
            <Finalize
              placeOpts={placeOpts}
              dateOpts={dateOpts}
              s={s}
              whenLabel={whenLabel}
              onConfirm={(date, placeIds) => mutate(base, "PATCH", { finalize: { date, placeIds } })}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {isOrg && s.plan.status !== "planning" && (
              <Button variant="secondary" size="sm" onClick={() => mutate(base, "PATCH", { status: "planning" })}>
                {T.reopen}
              </Button>
            )}
            {isOrg && s.plan.status === "planning" && (
              <Button variant="secondary" size="sm" onClick={() => confirm(T.cancelConfirm) && mutate(base, "PATCH", { status: "cancelled" })}>
                {T.cancelPlan}
              </Button>
            )}
            {isOrg && (
              <Button
                variant="ghost"
                size="sm"
                className="text-coral-600"
                onClick={async () => {
                  if (!confirm(T.deleteConfirm)) return;
                  const res = await fetch(base, { method: "DELETE" });
                  if (res.ok) router.push(`/${locale}/together`);
                  else toast(t.common.somethingWrong, { tone: "error" });
                }}
              >
                <Trash2 className="size-4" /> {T.deletePlan}
              </Button>
            )}
            {!isOrg && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm(T.leaveConfirm)) return;
                  const res = await fetch(`${base}/join`, { method: "DELETE" });
                  if (res.ok) router.push(`/${locale}/together`);
                  else toast(t.common.somethingWrong, { tone: "error" });
                }}
              >
                {T.leave}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function VoteSummary({ o }: { o: Option }) {
  const { t, locale } = useI18n();
  const n = (v: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(o.votes.filter((x) => x.value === v).length);
  return <p className="text-sm text-ink-600">{fmt(t.together.votesLine, { yes: n(1), maybe: n(0), no: n(-1) })}</p>;
}

function VoteButtons({ o, meId, disabled, onVote }: { o: Option; meId: string; disabled: boolean; onVote: (v: 1 | 0 | -1 | null) => void }) {
  const { t } = useI18n();
  const mine = o.votes.find((v) => v.participantId === meId)?.value ?? null;
  const btn = (value: 1 | 0 | -1, label: string, Icon: typeof ThumbsUp, on: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={mine === value}
      onClick={() => onVote(mine === value ? null : value)}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition disabled:opacity-50 ${mine === value ? on : "bg-sand-100 text-ink-600 hover:bg-sand-200"}`}
    >
      <Icon className="size-4" /> <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
  return (
    <div className="flex gap-1" role="group" aria-label={t.together.yes}>
      {btn(1, t.together.yes, ThumbsUp, "bg-sea-500 text-white")}
      {btn(0, t.together.maybe, HelpCircle, "bg-gold-400 text-ink-900")}
      {btn(-1, t.together.no, ThumbsDown, "bg-coral-500 text-white")}
    </div>
  );
}

function PlaceOption({
  o,
  s,
  open,
  canRemove,
  mutate,
  base,
}: {
  o: Option;
  s: PlanState;
  open: boolean;
  canRemove: boolean;
  mutate: (url: string, method: string, payload?: unknown) => Promise<boolean>;
  base: string;
}) {
  const { t, locale } = useI18n();
  const p = s.places[o.placeId!];
  if (!p) return null;
  const sub = subcategoryLabel(p.sub, locale) ?? categoryDef(p.category).name[locale];
  return (
    <li className="flex gap-3 rounded-2xl bg-white p-3 shadow-card sm:gap-4 sm:p-4">
      <Link href={`/${locale}/place/${p.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-ink-800 sm:size-24">
        {p.img ? (
          <Image src={p.img.url} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <CoverArt seed={p.slug} category={p.category} initial={p.nameEn || p.nameAr} className="absolute inset-0 size-full" />
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/${locale}/place/${p.slug}`} className="block truncate font-display text-lg font-semibold hover:underline">
              {placeName(locale, p)}
            </Link>
            <p className="truncate text-sm text-ink-500">
              {sub}
              {p.cost.min != null && p.cost.max != null && (
                <>
                  {" · "}
                  {p.cost.basis === "free" ? t.common.free : formatSarRange(locale, p.cost.min, p.cost.max)}
                  {p.cost.basis === "estimate" && ` · ${t.common.estimate}`}
                </>
              )}
            </p>
          </div>
          {canRemove && (
            <button type="button" onClick={() => mutate(`${base}/options/${o.id}`, "DELETE")} className="rounded-full p-2 text-ink-400 hover:bg-sand-100 hover:text-coral-600" aria-label={t.together.remove}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        <VoteSummary o={o} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VoteButtons o={o} meId={s.me!.id} disabled={!open} onVote={(value) => mutate(`${base}/votes`, "PUT", { optionId: o.id, value })} />
          <span className="text-xs text-ink-400">{fmt(t.together.suggestedBy, { name: o.proposedBy.name })}</span>
        </div>
      </div>
    </li>
  );
}

function PlaceSearch({ onPick }: { onPick: (id: string) => Promise<boolean> }) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const query = q.trim();
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      if (query.length < 2) return setHits([]);
      fetch(`/api/places/search?limit=6&q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: Hit[] }) => setHits(d.hits))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);
  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">{t.together.suggestPlace}</span>
        <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${t.together.suggestPlace} — ${t.together.searchPlaces}`}
          className="h-12 w-full rounded-full border border-sand-300 bg-white pe-4 ps-10 text-[15px] outline-none focus:border-sea-500 focus:ring-2 focus:ring-sea-500/20"
        />
      </label>
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-sand-200">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-sand-100"
                onClick={async () => {
                  if (await onPick(h.id)) {
                    setQ("");
                    setHits([]);
                  }
                }}
              >
                <span className="truncate font-medium">{placeName(locale, h)}</span>
                <span className="shrink-0 text-xs text-ink-500">{subcategoryLabel(h.sub, locale) ?? categoryDef(h.category).name[locale]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DateAdder({ onAdd }: { onAdd: (date: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const field = "h-11 rounded-xl border border-sand-300 bg-white px-3 text-[15px]";
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!date) return;
        if (await onAdd(time ? `${date}T${time}` : date)) {
          setDate("");
          setTime("");
        }
      }}
    >
      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">{t.together.suggestDate}</span>
        <input type="date" value={date} min={cityToday()} onChange={(e) => setDate(e.target.value)} className={field} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-500">{t.together.time}</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
      </label>
      <Button type="submit" variant="secondary" disabled={!date}>
        {t.together.add}
      </Button>
    </form>
  );
}

function People({ s, meId }: { s: PlanState; meId: string }) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card" aria-labelledby="people-title">
      <h2 id="people-title" className="flex items-center gap-2 font-semibold">
        <Users className="size-4 text-sea-600" /> {t.together.people} <span className="text-ink-400">({s.participants.length})</span>
      </h2>
      <ul className="mt-3 space-y-2">
        {s.participants.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand-200 text-sm font-semibold">{p.displayName.trim().charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {p.displayName}
              {p.id === meId && <span className="text-ink-400"> ({t.together.you})</span>}
            </span>
            {p.role === "organizer" ? (
              <span className="flex items-center gap-1 text-xs text-gold-500">
                <Crown className="size-3.5" /> {t.together.organizer}
              </span>
            ) : p.isGuest ? (
              <span className="text-xs text-ink-400">{t.together.guest}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Budget({ s, placeOpts, isOrg, onSave }: { s: PlanState; placeOpts: Option[]; isOrg: boolean; onSave: (v: number | null) => Promise<boolean> }) {
  const { t, locale } = useI18n();
  const T = t.together;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(s.plan.budgetPerPerson?.toString() ?? "");
  const favs = placeOpts.filter((o) => o.score > 0).slice(0, 4);
  const places = favs.map((o) => s.places[o.placeId!]).filter(Boolean);
  const known = places.filter((p) => p.cost.planning != null);
  const total = known.reduce((a, p) => a + (p.cost.planning ?? 0), 0);
  const unknown = places.length - known.length;
  const budget = s.plan.budgetPerPerson;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-card" aria-labelledby="budget-title">
      <h2 id="budget-title" className="flex items-center gap-2 font-semibold">
        <Wallet className="size-4 text-sea-600" /> {T.budget}
      </h2>
      {editing ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = value.trim() === "" ? null : Math.max(0, Math.round(Number(value)));
            if (await onSave(Number.isFinite(v) ? v : null)) setEditing(false);
          }}
        >
          <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 w-full rounded-xl border border-sand-300 px-3" aria-label={T.budgetLabel} />
          <Button type="submit" size="sm">
            {T.saveBudget}
          </Button>
        </form>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-ink-700">{budget != null ? fmt(T.budgetPerPerson, { amount: formatSar(locale, budget) }) : T.noBudget}</p>
          {isOrg && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-sea-600 hover:underline">
              {T.setBudget}
            </button>
          )}
        </div>
      )}
      {places.length > 0 && (
        <div className="mt-4 rounded-2xl bg-sand-100 p-4 text-sm">
          <p className="font-medium">{T.budgetEstimateTitle}</p>
          {known.length > 0 && (
            <p className="mt-1 text-ink-700">
              {fmt(T.budgetEstimate, { amount: total === 0 ? t.common.free : formatSar(locale, total), n: new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(places.length) })}
            </p>
          )}
          {unknown > 0 && <p className="mt-1 text-ink-500">{fmt(T.budgetUnknown, { n: new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(unknown) })}</p>}
          {/* Only claim it fits when every price is known. */}
          {budget != null && (total > budget || unknown === 0) && (
            <p className={`mt-1 ${total > budget ? "text-coral-700" : "text-sea-700"}`}>{total > budget ? fmt(T.budgetOver, { amount: formatSar(locale, total - budget) }) : T.budgetWithin}</p>
          )}
          <p className="mt-2 text-xs text-ink-500">{T.budgetNote}</p>
        </div>
      )}
    </section>
  );
}

function Discussion({ s, meId, onSend }: { s: PlanState; meId: string; onSend: (body: string) => Promise<boolean> }) {
  const { t, locale } = useI18n();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [s.comments.length]);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card" aria-labelledby="disc-title">
      <h2 id="disc-title" className="flex items-center gap-2 font-semibold">
        <MessageCircle className="size-4 text-sea-600" /> {t.together.discussion}
      </h2>
      {s.comments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{t.together.noComments}</p>
      ) : (
        <ul ref={list} className="mt-3 max-h-80 space-y-3 overflow-y-auto pe-1">
          {s.comments.map((c) => (
            <li key={c.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${c.author.id === meId ? "ms-6 bg-sea-50" : "me-6 bg-sand-100"}`}>
              <p className="text-xs text-ink-500">
                <span className="font-semibold text-ink-700" dir="auto">
                  {c.author.name}
                </span>{" "}
                · {relativeTime(locale, c.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-ink-800" dir="auto">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          if (await onSend(body.trim())) setBody("");
          setBusy(false);
        }}
      >
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} placeholder={t.together.comment} className="h-10 min-w-0 flex-1 rounded-full border border-sand-300 px-4 text-sm" dir="auto" />
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {t.together.send}
        </Button>
      </form>
    </section>
  );
}

function Finalize({
  placeOpts,
  dateOpts,
  s,
  whenLabel,
  onConfirm,
}: {
  placeOpts: Option[];
  dateOpts: Option[];
  s: PlanState;
  whenLabel: (v: string) => string;
  onConfirm: (date: string, placeIds: string[]) => Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const T = t.together;
  const [openPanel, setOpenPanel] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const best = dateOpts[0]?.date ?? "";
    setDate(best.split("T")[0]);
    setTime(best.split("T")[1] ?? "");
    setChosen(placeOpts.filter((o) => o.score > 0).map((o) => o.placeId!).slice(0, 5));
    setOpenPanel(true);
  };
  const move = (i: number, d: -1 | 1) =>
    setChosen((c) => {
      const n = [...c];
      const j = i + d;
      if (j < 0 || j >= n.length) return c;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  if (!openPanel)
    return (
      <Button className="w-full" onClick={start}>
        <CheckCircle2 className="size-[18px]" /> {T.finalize}
      </Button>
    );

  return (
    <section className="rounded-3xl bg-ink-900 p-5 text-sand-50 shadow-card" aria-labelledby="final-title">
      <div className="flex items-center justify-between">
        <h2 id="final-title" className="font-semibold">
          {T.finalize}
        </h2>
        <button type="button" onClick={() => setOpenPanel(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label={t.common.close}>
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-200">{T.finalizeLede}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-200">{T.chooseDate}</span>
          {dateOpts.length > 0 && (
            <select
              value={dateOpts.some((o) => o.date?.split("T")[0] === date) ? date : ""}
              onChange={(e) => {
                const o = dateOpts.find((x) => x.date?.split("T")[0] === e.target.value);
                setDate(e.target.value);
                if (o?.date?.includes("T")) setTime(o.date.split("T")[1]);
              }}
              className="mb-2 h-10 w-full rounded-xl bg-white px-2 text-sm text-ink-900"
            >
              <option value="">—</option>
              {[...new Map(dateOpts.map((o) => [o.date!.split("T")[0], o])).values()].map((o) => (
                <option key={o.id} value={o.date!.split("T")[0]}>
                  {whenLabel(o.date!.split("T")[0])}
                </option>
              ))}
            </select>
          )}
          <input type="date" value={date} min={cityToday()} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-xl bg-white px-2 text-sm text-ink-900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-200">{T.chooseTime}</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-full rounded-xl bg-white px-2 text-sm text-ink-900" />
        </label>
      </div>
      <p className="mb-2 mt-4 text-xs text-ink-200">{T.choosePlaces}</p>
      <ul className="space-y-1.5">
        {placeOpts.map((o) => {
          const p = s.places[o.placeId!];
          const i = chosen.indexOf(o.placeId!);
          return (
            <li key={o.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
              <input
                type="checkbox"
                checked={i >= 0}
                onChange={(e) => setChosen((c) => (e.target.checked ? [...c, o.placeId!] : c.filter((x) => x !== o.placeId)))}
                className="size-4 accent-sea-400"
                aria-label={placeName(locale, p)}
              />
              <span className="w-5 text-center text-xs tabular-nums text-ink-300">{i >= 0 ? i + 1 : ""}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{placeName(locale, p)}</span>
              {i >= 0 && (
                <>
                  <button type="button" onClick={() => move(i, -1)} className="rounded p-1 hover:bg-white/10" aria-label="↑">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded p-1 hover:bg-white/10" aria-label="↓">
                    <ArrowDown className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-coral-300">{error}</p>}
      <Button
        className="mt-4 w-full"
        onClick={async () => {
          setError(null);
          if (!date || chosen.length === 0) return setError(T.needDateAndPlace);
          if (await onConfirm(time ? `${date}T${time}` : date, chosen)) setOpenPanel(false);
        }}
      >
        <Check className="size-[18px]" /> {T.confirmFinal}
      </Button>
    </section>
  );
}

function FinalPlan({ s }: { s: PlanState }) {
  const { t, locale } = useI18n();
  const T = t.together;
  const f = s.final;
  if (!f || !s.plan.finalDate) return null;
  const [date, time] = s.plan.finalDate.split("T");
  const car = TRANSPORT.find((m) => m.slug === "car")?.name[locale] ?? "";
  const carLabel = locale === "en" ? car.toLowerCase() : car;
  return (
    <section className="overflow-hidden rounded-3xl bg-ink-900 text-sand-50 shadow-lift" aria-labelledby="final-plan-title">
      <div className="grid gap-0 lg:grid-cols-[1fr_420px]">
        <div className="p-6 md:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sea-300">
            <CheckCircle2 className="size-4" /> {T.finalTitle}
          </p>
          <h2 id="final-plan-title" className="mt-2 font-display text-3xl font-semibold">
            {formatDay(locale, date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <p className="mt-1 text-ink-200">{time ? fmt(T.finalStartsAt, { time: formatTime(locale, time) }) : T.finalNoTime}</p>
          <ol className="mt-5 space-y-3">
            {f.stops.map((st, i) => {
              const p = s.places[st.placeId];
              if (!p) return null;
              return (
                <li key={st.placeId} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sea-500 text-sm font-semibold">
                    {new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/${locale}/place/${p.slug}`} className="font-medium hover:underline">
                      {placeName(locale, p)}
                    </Link>
                    <p className="text-sm text-ink-300">
                      {formatTime(locale, st.arriveAt)} · {formatMinutes(locale, st.durationMin)}
                      {st.cost.perPerson != null && ` · ${st.cost.basis === "free" ? t.common.free : `~${formatSar(locale, st.cost.perPerson)}`}`}
                      {st.travel && i > 0 && ` · ${fmt(t.planner.travelApprox, { min: formatMinutes(locale, st.travel.minutes), mode: carLabel })}`}
                    </p>
                  </div>
                  <a href={directionsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer" className="self-center rounded-full p-2 text-ink-200 hover:bg-white/10" aria-label={t.common.directions}>
                    <Navigation className="size-4" />
                  </a>
                </li>
              );
            })}
          </ol>
          {f.totals.unknownStops < f.stops.length && (
            <p className="mt-5 font-medium">{fmt(T.finalTotal, { amount: f.totals.perPerson === 0 ? t.common.free : formatSar(locale, f.totals.perPerson) })}</p>
          )}
          {f.totals.budgetPerPerson != null && (f.totals.overPerPerson > 0 || f.totals.unknownStops === 0) && (
            <p className={`text-sm ${f.totals.overPerPerson > 0 ? "text-coral-300" : "text-sea-300"}`}>
              {f.totals.overPerPerson > 0 ? fmt(T.budgetOver, { amount: formatSar(locale, f.totals.overPerPerson) }) : T.budgetWithin}
            </p>
          )}
          {f.totals.unknownStops > 0 && (
            <p className="mt-2 text-sm text-ink-300">{fmt(T.budgetUnknown, { n: new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(f.totals.unknownStops) })}</p>
          )}
          <p className="mt-4 text-xs text-ink-300">{T.finalNote}</p>
        </div>
        <MiniMap
          className="h-72 lg:h-full lg:min-h-[360px]"
          connect
          ariaLabel={T.finalTitle}
          markers={f.stops
            .map((st, i) => ({ st, i, p: s.places[st.placeId] }))
            .filter((x) => x.p)
            .map(({ p, i }) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1, label: placeName(locale, p), href: `/${locale}/place/${p.slug}` }))}
        />
      </div>
    </section>
  );
}
