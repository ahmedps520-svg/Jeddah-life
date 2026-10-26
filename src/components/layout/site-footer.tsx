import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { Wordmark } from "./logo";
import { LanguageSwitch } from "./language-switch";

export async function SiteFooter() {
  const { t, locale } = await getDictionary();
  const href = (p: string) => `/${locale}${p}`;
  const links = [
    { href: "/explore", label: t.nav.explore },
    { href: "/map", label: t.nav.map },
    { href: "/plan", label: t.nav.planner },
    { href: "/make-it-happen", label: t.nav.makeItHappen },
    { href: "/events", label: t.nav.events },
    { href: "/neighbourhoods", label: t.nav.neighbourhoods },
    { href: "/hidden-gems", label: t.nav.hiddenGems },
    { href: "/together", label: t.nav.together },
    { href: "/about", label: t.nav.about },
  ];
  return (
    <footer className="mt-16 bg-ink-950 pb-[calc(var(--bottom-nav-h)+24px)] text-ink-300 md:pb-10">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 md:grid-cols-[1.2fr_2fr] md:px-6">
        <div>
          <Wordmark locale={locale} className="text-sand-50" />
          <p className="mt-4 max-w-sm font-display text-lg text-sand-100">{t.brand.closing}</p>
          <div className="mt-4">
            <LanguageSwitch />
          </div>
        </div>
        <div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={href(l.href)} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-ink-400">{t.footer.attribution}</p>
          <p className="mt-2 text-xs text-ink-500">{t.footer.made}</p>
        </div>
      </div>
    </footer>
  );
}
