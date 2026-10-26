"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, House, Map, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";

export function BottomNav() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(en|ar)/, "") || "/";
  const items = [
    { href: "/", label: t.nav.home, Icon: House, match: (p: string) => p === "/" },
    { href: "/explore", label: t.nav.explore, Icon: Compass, match: (p: string) => p.startsWith("/explore") || p.startsWith("/category") },
    { href: "/map", label: t.nav.map, Icon: Map, match: (p: string) => p.startsWith("/map") },
    { href: "/saved", label: t.nav.saved, Icon: Heart, match: (p: string) => p.startsWith("/saved") },
    { href: "/profile", label: t.nav.profile, Icon: UserRound, match: (p: string) => p.startsWith("/profile") || p.startsWith("/auth") },
  ];
  return (
    <nav
      aria-label={t.nav.mainNav}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-300/70 bg-sand-50/95 backdrop-blur-md safe-bottom md:hidden"
    >
      <ul className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg grid-cols-5">
        {items.map(({ href, label, Icon, match }) => {
          const active = match(rest);
          return (
            <li key={href}>
              <Link
                href={`/${locale}${href === "/" ? "" : href}`}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  active ? "text-sea-600" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <Icon className={`size-[22px] transition ${active ? "stroke-[2.4]" : "stroke-[1.8]"}`} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
