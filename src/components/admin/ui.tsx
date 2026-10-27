import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* Shared admin presentation primitives (server-safe: no hooks). */

export const inputClass =
  "h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-[15px] text-ink-900 placeholder:text-ink-400 transition focus-visible:border-sea-400 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:bg-coral-400/5 disabled:bg-sand-100 disabled:text-ink-500";
export const textareaClass =
  "min-h-28 w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-400 transition focus-visible:border-sea-400 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:bg-coral-400/5";
export const cardClass = "rounded-3xl bg-white p-5 shadow-card md:p-6";

export function PageHeader({ title, lede, actions, back }: { title: string; lede?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 rounded text-sm font-medium text-sea-600 hover:underline">
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-[30px] font-semibold leading-tight md:text-[34px]">{title}</h1>
        {lede && <p className="mt-1.5 text-[15px] text-ink-600">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export type Tone = "neutral" | "sea" | "coral" | "gold" | "ink" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-sand-200 text-ink-700",
  sea: "bg-sea-50 text-sea-700 ring-1 ring-sea-100",
  coral: "bg-coral-400/15 text-coral-500",
  gold: "bg-gold-400/20 text-[#7a5f2e]",
  ink: "bg-ink-900 text-sand-50",
  muted: "bg-ink-100 text-ink-500",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  published: "sea",
  draft: "neutral",
  archived: "muted",
  pending: "gold",
  approved: "sea",
  rejected: "coral",
  open: "gold",
  resolved: "sea",
  dismissed: "muted",
  hidden: "coral",
  removed: "muted",
  verified: "sea",
  unverified: "neutral",
  community: "gold",
};

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-sand-400 bg-sand-50 px-6 py-10 text-center text-[15px] text-ink-500">
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  href?: string;
  tone?: "default" | "alert";
}) {
  const body = (
    <>
      <span className="block text-sm text-ink-500">{label}</span>
      <span className={`mt-1 block font-display text-[30px] font-semibold leading-none ${tone === "alert" ? "text-coral-500" : "text-ink-900"}`}>{value}</span>
      {sub && <span className="mt-2 block text-xs text-ink-500">{sub}</span>}
    </>
  );
  const cls = "block h-full rounded-2xl bg-white p-4 shadow-card md:p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:ring-1 hover:ring-sea-200`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Tabs rendered as links (server-side state in the URL). */
export function LinkTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; active: boolean; count?: string }[] }) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-1.5 rounded-full bg-sand-200/70 p-1 md:inline-flex">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab.active ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900"
          }`}
        >
          {tab.label}
          {tab.count && (
            <span className={`rounded-full px-1.5 text-[11px] leading-5 ${tab.active ? "bg-sand-200 text-ink-700" : "bg-white/70 text-ink-500"}`}>{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  pages,
  hrefFor,
  labels,
}: {
  page: number;
  pages: number;
  hrefFor: (p: number) => string;
  labels: { previous: string; next: string; pageOf: string };
}) {
  if (pages <= 1) return null;
  const link = "inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-medium ring-1 ring-sand-300 bg-white hover:ring-ink-300";
  const off = "inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm font-medium text-ink-400 ring-1 ring-sand-200";
  return (
    <nav aria-label={labels.pageOf} className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link} rel="prev">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {labels.previous}
        </Link>
      ) : (
        <span className={off} aria-disabled>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {labels.previous}
        </span>
      )}
      <span className="text-sm text-ink-500">{labels.pageOf}</span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={link} rel="next">
          {labels.next}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      ) : (
        <span className={off} aria-disabled>
          {labels.next}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </span>
      )}
    </nav>
  );
}

/** Builds hrefs that keep the current filters while changing some of them. */
export function hrefWith(base: string, current: Record<string, string | undefined>, changes: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) {
    if (v !== undefined && v !== null && v !== "" && !(k === "page" && String(v) === "1")) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Normalises Next.js searchParams to single strings. */
export function flatParams(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
