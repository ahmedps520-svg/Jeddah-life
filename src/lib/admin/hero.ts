import "server-only";
import { z } from "zod";
import type { ImageCredit } from "@/lib/db/schema";
import { FieldError, zodFields } from "./api";
import { checkImages, ImageShape } from "./places";
import { HERO_THEMES, type FieldErrors } from "./types";
import { isAppPath } from "./validate";

const t = (max: number) => z.string().trim().max(max, "too_long").default("");

const HeroShape = z.object({
  theme: t(30),
  titleEn: t(120),
  titleAr: t(120),
  subtitleEn: t(240),
  subtitleAr: t(240),
  href: t(300),
  sortOrder: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  active: z.boolean().default(true),
  image: ImageShape.nullable().optional(),
});

export type HeroValues = {
  theme: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  href: string;
  sortOrder: number;
  active: boolean;
  image: ImageCredit;
};

export function validateHero(raw: unknown): HeroValues {
  const parsed = HeroShape.safeParse(raw);
  if (!parsed.success) throw new FieldError(zodFields(parsed.error));
  const d = parsed.data;
  const e: FieldErrors = {};
  if (!(HERO_THEMES as readonly string[]).includes(d.theme)) e.theme = d.theme ? "theme" : "required";
  if (!d.titleEn) e.titleEn = "required";
  if (!d.titleAr) e.titleAr = "required";
  if (!d.href) e.href = "required";
  else if (!isAppPath(d.href)) e.href = "href_path";
  const sortOrder = /^-?\d+$/.test(d.sortOrder) ? Number(d.sortOrder) : Number.NaN;
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 10_000) e.sortOrder = "sort_order";
  let image: ImageCredit | null = null;
  if (!d.image) e["image"] = "required";
  else {
    [image] = checkImages([d.image], e, "image");
    for (const k of Object.keys(e)) {
      if (k.startsWith("image.0.")) {
        e[k.replace("image.0.", "image.")] = e[k];
        delete e[k];
      }
    }
  }
  if (Object.keys(e).length) throw new FieldError(e);
  return {
    theme: d.theme,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    subtitleEn: d.subtitleEn || null,
    subtitleAr: d.subtitleAr || null,
    href: d.href,
    sortOrder,
    active: d.active,
    image: image!,
  };
}
