import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { ImageCredit } from "@/lib/db/schema";
import { GEM_TYPES } from "@/lib/taxonomy";
import { CoverArt } from "@/components/place/cover-art";

export type GemSubmissionLite = {
  id: string;
  name: string;
  gemType: string;
  description: string;
  neighbourhood: string | null;
  photos: ImageCredit[];
};

export function gemTypeName(slug: string, locale: Locale): string {
  return GEM_TYPES.find((g) => g.slug === slug)?.name[locale] ?? slug;
}

/** Card for a moderator-approved community recommendation. */
export function GemCard({
  g,
  locale,
  t,
  hoodName,
  size = "md",
}: {
  g: GemSubmissionLite;
  locale: Locale;
  t: Dictionary;
  hoodName?: string | null;
  size?: "md" | "grid";
}) {
  const photo = g.photos[0];
  return (
    <article className={`group shrink-0 snap-start ${size === "grid" ? "w-full" : "w-[62vw] max-w-[260px] sm:w-[240px]"}`}>
      <Link href={`/${locale}/hidden-gems/${g.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-800">
          {photo ? (
            <Image src={photo.url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
          ) : (
            <CoverArt seed={g.id} category="hidden-gems" initial={g.name} className="absolute inset-0 size-full transition duration-700 group-hover:scale-[1.04]" />
          )}
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-800 backdrop-blur">
            <Users className="size-3.5" /> {t.gems.community}
          </span>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-coral-500">{gemTypeName(g.gemType, locale)}</p>
        <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug group-hover:underline" dir="auto">
          {g.name}
        </h3>
        {hoodName && <p className="text-sm text-ink-500">{hoodName}</p>}
        <p className="mt-1 line-clamp-2 text-sm text-ink-600" dir="auto">
          {g.description}
        </p>
      </Link>
    </article>
  );
}
