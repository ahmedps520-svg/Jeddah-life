import "server-only";
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import en, { type Dictionary } from "./dictionaries/en";
import ar from "./dictionaries/ar";
import { isLocale, type Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
