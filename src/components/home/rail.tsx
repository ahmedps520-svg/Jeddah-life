"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";

/** Horizontal carousel with snap scrolling and RTL-aware arrow buttons. */
export function Rail({
  title,
  note,
  href,
  children,
  id,
  tone = "light",
}: {
  title: string;
  note?: string | null;
  href?: string;
  children: React.ReactNode;
  id?: string;
  tone?: "light" | "dark";
}) {
  const { t, dir, locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      setEdges({ start: pos < 8, end: pos > max - 8 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (forward: boolean) => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85 * (forward ? 1 : -1) * (dir === "rtl" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const dark = tone === "dark";

  return (
    <section aria-labelledby={id} className="mx-auto max-w-7xl py-6">
      <div className="mb-4 flex items-end justify-between gap-4 px-4 md:px-6">
        <div className="min-w-0">
          <h2 id={id} className={`font-display text-[24px] font-semibold leading-tight md:text-[28px] ${dark ? "text-sand-50" : "text-ink-900"}`}>
            {title}
          </h2>
          {note && <p className={`mt-1 text-sm ${dark ? "text-ink-300" : "text-ink-500"}`}>{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={`/${locale}${href}`} className={`text-sm font-medium ${dark ? "text-sea-200" : "text-sea-600"} hover:underline`}>
              {t.common.seeAll}
            </Link>
          )}
          <div className="hidden gap-1 md:flex">
            <button
              type="button"
              onClick={() => scroll(false)}
              disabled={edges.start}
              aria-label={t.common.previous}
              className="grid size-9 place-items-center rounded-full ring-1 ring-sand-300 transition hover:bg-sand-200 disabled:opacity-30"
            >
              <Prev className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(true)}
              disabled={edges.end}
              aria-label={t.common.next}
              className="grid size-9 place-items-center rounded-full ring-1 ring-sand-300 transition hover:bg-sand-200 disabled:opacity-30"
            >
              <Next className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={ref} className="rail gap-4 px-4 pb-2 md:px-6" tabIndex={0} aria-label={title}>
        {children}
      </div>
    </section>
  );
}
