"use client";

import { createContext, useContext } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/config";

type Ctx = { locale: Locale; t: Dictionary; dir: "ltr" | "rtl" };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, t, children }: { locale: Locale; t: Dictionary; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t, dir: locale === "ar" ? "rtl" : "ltr" }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Prefix an app path with the active locale. */
export function useHref() {
  const { locale } = useI18n();
  return (path: string) => `/${locale}${path === "/" ? "" : path}`;
}
