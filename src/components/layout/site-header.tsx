"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession } from "@/components/providers/app-state";
import { Wordmark } from "./logo";
import { LocationPicker } from "./location-picker";
import { LanguageSwitch } from "./language-switch";
import { SearchBar } from "./search-bar";
import { formatNumber } from "@/lib/i18n/format";

export function SiteHeader({ unread }: { unread: number }) {
  const { t, locale } = useI18n();
  const user = useSession();
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(en|ar)/, "") || "/";
  const isHome = rest === "/";
  const isMap = rest.startsWith("/map");
  const href = (p: string) => `/${locale}${p === "/" ? "" : p}`;

  const desktopLinks = [
    { href: "/explore", label: t.nav.explore, xl: false },
    { href: "/map", label: t.nav.map, xl: false },
    { href: "/plan", label: t.nav.planner, xl: false },
    { href: "/make-it-happen", label: t.nav.makeItHappen, xl: true },
    { href: "/events", label: t.nav.events, xl: false },
    { href: "/neighbourhoods", label: t.nav.neighbourhoods, xl: true },
    { href: "/together", label: t.nav.together, xl: true },
  ];

  return (
    <header className={`relative z-40 bg-ink-900 text-sand-50 ${isMap ? "" : "md:sticky md:top-0"}`}>
      <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link href={href("/")} className="shrink-0 rounded-lg" aria-label={t.brand.name}>
          <Wordmark locale={locale} />
        </Link>

        <nav aria-label={t.nav.mainNav} className="ms-4 hidden items-center gap-0.5 lg:flex">
          {desktopLinks.map((l) => {
            const active = rest.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={href(l.href)}
                aria-current={active ? "page" : undefined}
                className={`${l.xl ? "hidden xl:inline-block" : ""} whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  active ? "bg-white/10 text-white" : "text-ink-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <div className="hidden md:block">
            <LocationPicker variant="compact" />
          </div>
          {!isHome && (
            <Link
              href={href("/explore")}
              className="rounded-full p-2.5 text-ink-200 transition hover:bg-white/10 hover:text-white"
              aria-label={t.common.search}
            >
              <Search className="size-5" />
            </Link>
          )}
          <LanguageSwitch />
          {user && (
            <Link
              href={href("/notifications")}
              className="relative rounded-full p-2.5 text-ink-200 transition hover:bg-white/10 hover:text-white"
              aria-label={unread ? `${t.header.notifications} — ${t.header.unread.replace("{n}", formatNumber(locale, unread))}` : t.header.notifications}
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-semibold leading-4 text-white">
                  {unread > 9 ? "9+" : formatNumber(locale, unread)}
                </span>
              )}
            </Link>
          )}
          <Link
            href={href(user ? "/profile" : "/auth/sign-in")}
            className="ms-1 grid size-9 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold ring-1 ring-white/15 transition hover:ring-white/40"
            aria-label={user ? t.header.account : t.auth.signIn}
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            ) : user ? (
              <span>{user.displayName.trim().charAt(0).toUpperCase()}</span>
            ) : (
              <UserRound className="size-5 text-ink-200" />
            )}
          </Link>
        </div>
      </div>

      {isHome && (
        <div className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
          <div className="mb-3 md:hidden">
            <LocationPicker variant="inline" />
          </div>
          <SearchBar size="lg" />
        </div>
      )}
    </header>
  );
}
