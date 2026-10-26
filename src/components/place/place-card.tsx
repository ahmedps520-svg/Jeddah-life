import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Gem, Sparkles, Star } from "lucide-react";
import type { PlaceLite } from "@/lib/places/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { categoryDef, subcategoryLabel } from "@/lib/taxonomy";
import { formatDistance, formatNumber, formatSarRange, placeName } from "@/lib/i18n/format";
import { CoverArt } from "./cover-art";
import { SaveButton } from "./save-button";

export type HoodNames = Record<string, { en: string; ar: string | null }>;

export function PriceText({ p, locale, t }: { p: PlaceLite; locale: Locale; t: Dictionary }) {
  if (p.cost.basis === "free") return <span className="font-medium text-sea-600">{t.common.free}</span>;
  if (p.cost.min == null || p.cost.max == null) return null;
  return (
    <span>
      {formatSarRange(locale, p.cost.min, p.cost.max)}
      {p.cost.basis === "estimate" && <span className="text-ink-400"> · {t.common.estimate}</span>}
    </span>
  );
}

export function PlaceCover({
  p,
  sizes,
  className = "",
  priority = false,
}: {
  p: Pick<PlaceLite, "id" | "slug" | "category" | "img" | "nameEn" | "nameAr">;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-ink-800 ${className}`}>
      {p.img ? (
        <>
          <Image
            src={p.img.url}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
          />
          {p.img.author && (
            <span className="pointer-events-none absolute bottom-1 end-1.5 max-w-[80%] truncate text-[9px] text-white/70 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
              © {p.img.author}
              {p.img.license ? `, ${p.img.license}` : ""}
            </span>
          )}
        </>
      ) : (
        <CoverArt
          seed={p.slug}
          category={p.category}
          initial={p.nameEn || p.nameAr}
          className="absolute inset-0 size-full transition duration-700 group-hover:scale-[1.04]"
        />
      )}
    </div>
  );
}

export function PlaceCard({
  p,
  locale,
  t,
  hoods,
  distanceKm,
  size = "md",
  priority = false,
  why,
}: {
  p: PlaceLite;
  locale: Locale;
  t: Dictionary;
  hoods?: HoodNames;
  distanceKm?: number | null;
  size?: "md" | "lg" | "grid";
  priority?: boolean;
  why?: string | null;
}) {
  const name = placeName(locale, p);
  const def = categoryDef(p.category);
  const sub = subcategoryLabel(p.sub, locale) ?? def.name[locale];
  const hood = p.hood && hoods?.[p.hood] ? (locale === "ar" ? hoods[p.hood].ar || hoods[p.hood].en : hoods[p.hood].en) : null;
  const widths = size === "grid" ? "w-full" : size === "lg" ? "w-[78vw] max-w-[340px] sm:w-[320px]" : "w-[62vw] max-w-[260px] sm:w-[240px]";
  const aspect = size === "grid" ? "aspect-[4/3]" : "aspect-[4/5]";

  return (
    <article className={`group relative ${widths}`}>
      <Link href={`/${locale}/place/${p.slug}`} className="block rounded-[var(--radius-card)] outline-offset-4">
        <PlaceCover p={p} sizes="(max-width: 640px) 70vw, 320px" priority={priority} className={`${aspect} rounded-[var(--radius-card)] shadow-card`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-1.5 p-2.5">
          {p.pick && (
            <span className="flex items-center gap-1 rounded-full bg-sand-50/90 px-2 py-1 text-[11px] font-semibold text-ink-900 backdrop-blur">
              <Sparkles className="size-3 text-gold-500" /> {t.place.editorsPick}
            </span>
          )}
          {!p.pick && p.gem && (
            <span className="flex items-center gap-1 rounded-full bg-sand-50/90 px-2 py-1 text-[11px] font-semibold text-sea-700 backdrop-blur">
              <Gem className="size-3" /> {t.place.hiddenGem}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1 px-0.5">
          <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-400">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: def.color }} aria-hidden />
            <span className="truncate">{sub}</span>
            {p.ver === "verified" && <BadgeCheck className="size-3.5 shrink-0 text-sea-500" aria-label={t.common.verified} />}
          </div>
          <h3 className="line-clamp-2 font-display text-[19px] font-semibold leading-snug text-ink-900">{name}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-500">
            {hood && <span className="truncate">{hood}</span>}
            {distanceKm != null && <span>· {formatDistance(locale, distanceKm)}</span>}
            {p.rating != null && (
              <span className="flex items-center gap-0.5">
                · <Star className="size-3.5 fill-gold-400 text-gold-400" /> {formatNumber(locale, p.rating)}
                <span className="text-ink-400">({formatNumber(locale, p.reviews)})</span>
              </span>
            )}
          </div>
          <div className="text-[13px] text-ink-700">
            <PriceText p={p} locale={locale} t={t} />
          </div>
          {why && <p className="pt-1 text-[12px] leading-snug text-sea-700">{why}</p>}
        </div>
      </Link>
      <div className="absolute end-2.5 top-2.5">
        <SaveButton placeId={p.id} />
      </div>
    </article>
  );
}

export function PlaceRow({
  p,
  locale,
  t,
  hoods,
  distanceKm,
  active = false,
  onSelect,
}: {
  p: PlaceLite;
  locale: Locale;
  t: Dictionary;
  hoods?: HoodNames;
  distanceKm?: number | null;
  active?: boolean;
  onSelect?: () => void;
}) {
  const name = placeName(locale, p);
  const def = categoryDef(p.category);
  const sub = subcategoryLabel(p.sub, locale) ?? def.name[locale];
  const hood = p.hood && hoods?.[p.hood] ? (locale === "ar" ? hoods[p.hood].ar || hoods[p.hood].en : hoods[p.hood].en) : null;
  const body = (
    <>
      <PlaceCover p={p} sizes="96px" className="size-[84px] shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
          <span className="size-1.5 rounded-full" style={{ background: def.color }} aria-hidden />
          <span className="truncate">{sub}</span>
          {p.ver === "verified" && <BadgeCheck className="size-3.5 shrink-0 text-sea-500" aria-label={t.common.verified} />}
        </div>
        <h3 className="truncate font-display text-[17px] font-semibold text-ink-900">{name}</h3>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-500">
          {hood && <span className="truncate">{hood}</span>}
          {distanceKm != null && <span>· {formatDistance(locale, distanceKm)}</span>}
          {p.open === "open" && <span className="text-sea-600">· {t.place.listedOpen}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-700">
          <PriceText p={p} locale={locale} t={t} />
          {p.rating != null && (
            <span className="flex items-center gap-0.5 text-ink-500">
              <Star className="size-3.5 fill-gold-400 text-gold-400" /> {formatNumber(locale, p.rating)}
            </span>
          )}
        </div>
      </div>
    </>
  );
  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl p-2 transition ${active ? "bg-sea-50 ring-1 ring-sea-200" : "hover:bg-sand-200/60"}`}
    >
      {onSelect ? (
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          {body}
        </button>
      ) : (
        <Link href={`/${locale}/place/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      )}
      <SaveButton placeId={p.id} variant="icon" />
    </div>
  );
}
