"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LOCALE_COOKIE } from "@/lib/i18n/config";

export function LanguageSwitch({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  const target = `/${other}${pathname.replace(/^\/(en|ar)/, "")}`;

  return (
    <a
      href={target}
      hrefLang={other}
      lang={other}
      onClick={(e) => {
        e.preventDefault();
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        // Full navigation so the document direction, fonts and dictionary all switch together.
        window.location.assign(target + window.location.search + window.location.hash);
      }}
      aria-label={t.nav.languageLabel}
      className={`rounded-full px-2 py-1.5 text-sm sm:px-3 font-medium transition ${
        tone === "dark" ? "text-ink-100 hover:bg-white/10" : "text-ink-700 hover:bg-sand-200"
      } ${other === "ar" ? "font-[family-name:var(--font-sans-ar)]" : ""}`}
    >
      {t.nav.language}
    </a>
  );
}
