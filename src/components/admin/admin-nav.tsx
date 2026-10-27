"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Flag,
  Gauge,
  Inbox,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { formatNumber } from "@/lib/i18n/format";

type Counts = { reports: number; submissions: number };

/** Section navigation: a sidebar on large screens, a scrollable strip on small ones. */
export function AdminNav({ counts }: { counts: Counts }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(en|ar)\/admin/, "") || "/";
  const n = t.admin.nav;

  type Item = { href: string; label: string; Icon: typeof Gauge; badge?: number };
  const groups: { label: string; items: Item[] }[] = [
    { label: n.overview, items: [{ href: "", label: n.dashboard, Icon: Gauge }] },
    {
      label: n.content,
      items: [
        { href: "/places", label: n.places, Icon: MapPin },
        { href: "/categories", label: n.categories, Icon: LayoutGrid },
        { href: "/events", label: n.events, Icon: CalendarDays },
        { href: "/featured", label: n.featured, Icon: Sparkles },
      ],
    },
    {
      label: n.moderation,
      items: [
        { href: "/reviews", label: n.reviews, Icon: MessageSquareText },
        { href: "/submissions", label: n.submissions, Icon: Inbox, badge: counts.submissions },
        { href: "/reports", label: n.reports, Icon: Flag, badge: counts.reports },
      ],
    },
    {
      label: n.people,
      items: [
        { href: "/users", label: n.users, Icon: Users },
        { href: "/audit", label: n.audit, Icon: ScrollText },
      ],
    },
  ];

  const isActive = (href: string) => (href === "" ? rest === "/" : rest === href || rest.startsWith(`${href}/`));

  return (
    <nav aria-label={n.label}>
      {/* Small screens: one horizontal strip (wrapped because .rail sets its own display) */}
      <div className="lg:hidden">
        <ul className="rail -mx-4 gap-1.5 px-4 pb-1">
          {groups
            .flatMap((g) => g.items)
            .map(({ href, label, Icon, badge }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={`/${locale}/admin${href}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition ${
                      active ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-sand-200 hover:ring-ink-300"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                    {!!badge && <span className="rounded-full bg-coral-500 px-1.5 text-[11px] leading-5 text-white">{formatNumber(locale, badge)}</span>}
                  </Link>
                </li>
              );
            })}
        </ul>
      </div>

      {/* Large screens: grouped sidebar */}
      <div className="hidden space-y-5 lg:block">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, Icon, badge }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={`/${locale}/admin${href}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition ${
                        active ? "bg-ink-900 font-medium text-white" : "text-ink-700 hover:bg-sand-200"
                      }`}
                    >
                      <Icon className={`size-[18px] ${active ? "text-sea-200" : "text-ink-400"}`} aria-hidden />
                      <span className="flex-1">{label}</span>
                      {!!badge && (
                        <span className={`rounded-full px-2 text-xs leading-5 ${active ? "bg-white/15 text-white" : "bg-coral-500 text-white"}`}>
                          {formatNumber(locale, badge)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
