"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";

type Suggestion = { kind: "place" | "category" | "hood"; label: string; sub?: string; href: string };

const RECENT_KEY = "jl_recent_searches";

export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
export function pushRecent(q: string) {
  try {
    const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function SearchBar({ size = "md", autoFocus = false, initial }: { size?: "md" | "lg"; autoFocus?: boolean; initial?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setRecent(readRecent()), [focused]);
  useEffect(() => {
    if (!focused || popular) return;
    fetch(`/api/search/popular?locale=${locale}`)
      .then((r) => r.json())
      .then((d: { queries: string[] }) => setPopular(d.queries))
      .catch(() => setPopular([]));
  }, [focused, popular, locale]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&locale=${locale}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { suggestions: Suggestion[] }) => setSuggestions(d.suggestions))
        .catch(() => {});
    }, 160);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [value, locale]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit(q: string) {
    const query = q.trim();
    if (!query) return;
    pushRecent(query);
    setFocused(false);
    const sp = new URLSearchParams();
    sp.set("q", query);
    router.push(`/${locale}/explore?${sp.toString()}`);
  }

  const showPanel = focused;
  const items: Array<{ key: string; node: React.ReactNode; onSelect: () => void }> = [];
  if (value.trim().length >= 2) {
    for (const s of suggestions) {
      items.push({
        key: s.href,
        onSelect: () => {
          setFocused(false);
          router.push(`/${locale}${s.href}`);
        },
        node: (
          <span className="flex items-center gap-3">
            {s.kind === "hood" ? <MapPin className="size-4 text-ink-400" /> : <Search className="size-4 text-ink-400" />}
            <span className="truncate">{s.label}</span>
            {s.sub && <span className="ms-auto shrink-0 text-xs text-ink-400">{s.sub}</span>}
          </span>
        ),
      });
    }
    items.unshift({
      key: "__submit",
      onSelect: () => submit(value),
      node: (
        <span className="flex items-center gap-3 font-medium text-sea-600">
          <Sparkles className="size-4" />
          <span className="truncate">“{value.trim()}”</span>
        </span>
      ),
    });
  }

  const big = size === "lg";

  return (
    <div ref={wrap} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) items[active].onSelect();
          else submit(value);
        }}
        className={`group flex items-center gap-3 rounded-2xl bg-sand-50 text-ink-900 shadow-lift ring-1 ring-black/5 transition-all duration-300 focus-within:ring-2 focus-within:ring-sea-300 ${
          big ? "h-14 px-5" : "h-12 px-4"
        } ${focused && big ? "md:scale-[1.01]" : ""}`}
      >
        <Search className="size-5 shrink-0 text-sea-500" aria-hidden />
        <input
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(-1);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === "Escape") {
              setFocused(false);
            }
          }}
          placeholder={t.header.searchPlaceholder}
          aria-label={t.header.searchPlaceholder}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          role="combobox"
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-400 ${big ? "text-[17px]" : "text-[15px]"}`}
          enterKeyHint="search"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="rounded-full p-1 text-ink-400 hover:bg-sand-200 hover:text-ink-700"
            aria-label={t.common.clear}
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {showPanel && (
        <div
          id={listId}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60dvh] animate-fade-up overflow-y-auto rounded-2xl bg-sand-50 p-2 text-ink-900 shadow-lift ring-1 ring-black/5"
        >
          {items.length > 0 ? (
            <ul role="listbox">
              {items.map((it, i) => (
                <li key={it.key} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={it.onSelect}
                    className={`w-full rounded-xl px-3 py-2.5 text-start text-[15px] transition ${i === active ? "bg-sand-200" : "hover:bg-sand-100"}`}
                  >
                    {it.node}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-4 p-2">
              {recent.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-400">
                    <span>{t.explore.recent}</span>
                    <button
                      type="button"
                      className="font-medium normal-case tracking-normal text-sea-600 hover:underline"
                      onClick={() => {
                        localStorage.removeItem(RECENT_KEY);
                        setRecent([]);
                      }}
                    >
                      {t.explore.clearRecent}
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => submit(r)}
                          className="flex items-center gap-1.5 rounded-full bg-sand-200 px-3 py-1.5 text-sm hover:bg-sand-300"
                        >
                          <Clock className="size-3.5 text-ink-400" />
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {popular && popular.length > 0 && (
                <section>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t.explore.popular}</div>
                  <ul className="flex flex-wrap gap-2">
                    {popular.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => submit(r)}
                          className="flex items-center gap-1.5 rounded-full bg-sand-200 px-3 py-1.5 text-sm hover:bg-sand-300"
                        >
                          <TrendingUp className="size-3.5 text-ink-400" />
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t.explore.tryExamples}</div>
                <ul className="flex flex-wrap gap-2">
                  {t.explore.examples.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => submit(r)}
                        className="rounded-full px-3 py-1.5 text-sm text-ink-700 ring-1 ring-sand-300 hover:bg-sand-100"
                      >
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
