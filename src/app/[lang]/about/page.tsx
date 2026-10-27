import type { Metadata } from "next";
import { BadgeCheck, Database, Flag, Lock, Search } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/search/interpret";
import { fmt, formatDay } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.about.title, description: t.about.lede };
}

/** Date the editorial landmark research was last checked (see data/research/anchors). */
const RESEARCHED_ON = "2026-10-26";

export default async function AboutPage() {
  const { t, locale } = await getDictionary();
  const A = t.about;
  const h2 = "flex items-center gap-2 font-display text-2xl font-semibold";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <header>
        <h1 className="font-display text-[38px] font-semibold leading-tight md:text-[48px]">{A.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{A.lede}</p>
      </header>

      <section className="mt-12" aria-labelledby="src-title">
        <h2 id="src-title" className={h2}>
          <Database className="size-5 text-sea-600" /> {A.sourcesTitle}
        </h2>
        <dl className="mt-5 space-y-5">
          {A.sources.map((s) => (
            <div key={s.title} className="rounded-2xl bg-white p-5 shadow-card">
              <dt className="font-semibold">{s.title}</dt>
              <dd className="mt-1 text-ink-700">{s.body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-500">{fmt(A.checkedOn, { date: formatDay(locale, RESEARCHED_ON, { year: "numeric", month: "long" }) })}</p>
      </section>

      <section className="mt-12" aria-labelledby="read-title">
        <h2 id="read-title" className={h2}>
          <BadgeCheck className="size-5 text-sea-600" /> {A.readingTitle}
        </h2>
        <dl className="mt-5 divide-y divide-sand-200 overflow-hidden rounded-2xl bg-white shadow-card">
          {A.reading.map((r) => (
            <div key={r.term} className="grid gap-1 p-5 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="font-semibold">{r.term}</dt>
              <dd className="text-ink-700">{r.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="search-title">
        <h2 id="search-title" className={h2}>
          <Search className="size-5 text-sea-600" /> {A.searchTitle}
        </h2>
        <p className="mt-3 text-ink-700">{aiEnabled() ? A.searchAi : A.searchRules}</p>
      </section>

      <section className="mt-12" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className={h2}>
          <Lock className="size-5 text-sea-600" /> {A.privacyTitle}
        </h2>
        <ul className="mt-4 list-disc space-y-2 ps-5 text-ink-700 marker:text-sea-500">
          {A.privacy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-3xl bg-sand-200/60 p-6" aria-labelledby="report-title">
        <h2 id="report-title" className="flex items-center gap-2 font-semibold">
          <Flag className="size-4 text-coral-500" /> {A.reportTitle}
        </h2>
        <p className="mt-2 text-ink-700">{A.reportBody}</p>
      </section>
    </div>
  );
}
