import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { AlertTriangle, AtSign, BadgeCheck, Clock, Gem, Globe, Info, MapPin, Phone, Sparkles, Wallet } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCatalog, toLite } from "@/lib/places/catalog";
import { getPersonal, getPlace, getReviews, otherBranches, similarPlaces } from "@/lib/places/detail";
import { openStatus, weekSchedule } from "@/lib/places/hours";
import { costEstimate, typicalDuration } from "@/lib/places/estimates";
import { getCurrentUser } from "@/lib/auth/session";
import { bumpPlaceStat, recordInteraction } from "@/lib/stats";
import { categoryDef, FACILITIES, OCCASIONS, subcategoryLabel } from "@/lib/taxonomy";
import { formatDateTime, formatDistance, formatMinutes, formatSarRange, formatTime, placeName, plural } from "@/lib/i18n/format";
import { PlaceCard, type HoodNames } from "@/components/place/place-card";
import { CoverArt } from "@/components/place/cover-art";
import { PlaceActions } from "@/components/place/place-actions";
import { DistanceFromYou, NotesBox, ReportButton, VisitedToggle } from "@/components/place/personal-tools";
import { ReviewSection } from "@/components/place/review-section";
import { Rail } from "@/components/home/rail";
import { MiniMap } from "@/components/map/mini-map";
import type { PlaceAttributes } from "@/lib/db/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/place/[slug]">): Promise<Metadata> {
  const { locale } = await getDictionary();
  const { slug } = await params;
  const p = await getPlace(slug);
  if (!p) return {};
  const name = placeName(locale, p);
  const desc = (locale === "ar" ? p.descriptionAr : p.descriptionEn) ?? undefined;
  return {
    title: name,
    description: desc?.slice(0, 160),
    openGraph: p.images[0] ? { images: [{ url: p.images[0].url }] } : undefined,
  };
}

const WEEKDAYS: Record<"en" | "ar", string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

export default async function PlacePage({ params }: PageProps<"/[lang]/place/[slug]">) {
  const { t, locale } = await getDictionary();
  const { slug } = await params;
  const user = await getCurrentUser();
  const place = await getPlace(slug, { includeUnpublished: user?.role === "admin" });
  if (!place) notFound();

  const [catalog, reviews, personal] = await Promise.all([
    getCatalog(),
    getReviews(place.id),
    user ? getPersonal(user.id, place.id) : Promise.resolve(null),
  ]);
  const lite =
    catalog.byId.get(place.id) ??
    toLite(place, { rating: null, reviews: 0, saves: 0, pop: 0 });
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const hood = place.neighbourhood ? catalog.hoodBySlug.get(place.neighbourhood) : null;
  const hoodLabel = hood ? (locale === "ar" ? hood.nameAr || hood.nameEn : hood.nameEn) : null;

  const name = placeName(locale, place);
  const altName = locale === "ar" ? (place.nameEn && place.nameEn !== name ? place.nameEn : null) : place.nameAr && place.nameAr !== name ? place.nameAr : null;
  const def = categoryDef(place.category);
  const sub = subcategoryLabel(place.subcategory, locale) ?? def.name[locale];
  const description = locale === "ar" ? place.descriptionAr || place.descriptionEn : place.descriptionEn || place.descriptionAr;
  const cost = costEstimate(place);
  const status = openStatus(place.openingHours);
  const week = weekSchedule(place.openingHours);
  const similar = similarPlaces(catalog, lite);
  const branches = otherBranches(catalog, lite);
  const avg = lite.rating;

  after(async () => {
    await bumpPlaceStat(place.id, "views");
    await recordInteraction(user, "view", { placeId: place.id });
  });

  const attrLabels: Record<keyof PlaceAttributes, string> = {
    familyFriendly: t.attrs.familyFriendly,
    indoor: t.attrs.indoor,
    outdoor: t.attrs.outdoor,
    free: t.attrs.free,
    groups: t.attrs.groups,
    wheelchair: t.attrs.wheelchair,
    photoSpot: t.attrs.photoSpot,
    romantic: t.attrs.romantic,
    quiet: t.attrs.quiet,
  };
  const attrs = (Object.entries(place.attributes ?? {}) as [keyof PlaceAttributes, { value: boolean | null; source: string }][]).filter(
    ([k, a]) => a?.value === true && k !== "wheelchair",
  );
  const sourceLine =
    place.source === "editorial"
      ? t.place.sourceEditorial
      : place.source === "overture"
        ? t.place.sourceOverture.replace("{datasets}", place.sourceDetail?.split(" via ")[0] || "Meta, Microsoft")
        : place.source === "community"
          ? t.place.sourceCommunity
          : t.place.sourceAdmin;

  return (
    <article>
      {/* Gallery */}
      <div className="relative bg-ink-900">
        <div className="mx-auto max-w-7xl md:px-6 md:pt-6">
          {place.images.length > 0 ? (
            <div className={`grid gap-1.5 md:gap-2 ${place.images.length > 1 ? "md:grid-cols-[2fr_1fr]" : ""}`}>
              <figure className="relative aspect-[4/3] overflow-hidden md:aspect-[16/9] md:rounded-2xl">
                <Image src={place.images[0].url} alt={place.images[0].alt ?? name} fill priority sizes="(max-width: 768px) 100vw, 66vw" className="object-cover" />
                <ImageCredit img={place.images[0]} t={t} />
              </figure>
              {place.images.length > 1 && (
                <div className="hidden grid-rows-2 gap-2 md:grid">
                  {place.images.slice(1, 3).map((img) => (
                    <figure key={img.url} className="relative overflow-hidden rounded-2xl">
                      <Image src={img.url} alt={img.alt ?? ""} fill sizes="33vw" className="object-cover" />
                      <ImageCredit img={img} t={t} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-56 w-full overflow-hidden md:h-72 md:rounded-2xl">
              <CoverArt seed={place.slug} category={place.category} initial={place.nameEn || place.nameAr} className="absolute inset-0 size-full" />
              <span className="absolute bottom-3 start-3 rounded-full bg-ink-950/50 px-3 py-1 text-xs text-white backdrop-blur">{t.place.noPhotos}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 md:px-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          {/* Title */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-ink-500">
              <span className="size-2 rounded-full" style={{ background: def.color }} aria-hidden />
              <Link href={`/${locale}/category/${def.slug}`} className="hover:text-ink-900">
                {def.name[locale]}
              </Link>
              <span aria-hidden>·</span>
              <span>{sub}</span>
              {place.editorsPick && (
                <span className="flex items-center gap-1 rounded-full bg-gold-400/20 px-2 py-0.5 normal-case tracking-normal text-gold-500">
                  <Sparkles className="size-3.5" /> {t.place.editorsPick}
                </span>
              )}
              {place.hiddenGem && (
                <span className="flex items-center gap-1 rounded-full bg-sea-50 px-2 py-0.5 normal-case tracking-normal text-sea-700">
                  <Gem className="size-3.5" /> {t.place.hiddenGem}
                </span>
              )}
            </div>
            <h1 className="font-display text-[36px] font-semibold leading-[1.1] md:text-[52px]">{name}</h1>
            {altName && (
              <p className="text-lg text-ink-500" lang={locale === "ar" ? "en" : "ar"} dir={locale === "ar" ? "ltr" : "rtl"}>
                {altName}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-ink-600">
              {hoodLabel && (
                <Link href={`/${locale}/neighbourhoods/${hood!.slug}`} className="inline-flex items-center gap-1.5 hover:text-ink-900">
                  <MapPin className="size-4 text-ink-400" /> {hoodLabel}
                </Link>
              )}
              <DistanceFromYou lat={place.lat} lng={place.lng} />
              {place.verification === "verified" ? (
                <span className="inline-flex items-center gap-1.5 text-sea-600">
                  <BadgeCheck className="size-4" /> {t.common.verified}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-ink-500">
                  <Info className="size-4" /> {t.common.unverified}
                </span>
              )}
            </div>
            <PlaceActions placeId={place.id} name={name} lat={place.lat} lng={place.lng} website={place.website} />
            {personal && <VisitedToggle placeId={place.id} initial={personal.visited} />}
          </header>

          {place.flaggedOutdated && (
            <p className="flex items-start gap-2 rounded-2xl bg-coral-400/15 p-4 text-sm text-coral-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t.place.flaggedOutdated}
            </p>
          )}

          {/* Quick facts */}
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact icon={<Wallet className="size-5" />} label={t.place.price}>
              {cost.basis === "free" ? (
                <>
                  <span className="font-semibold text-sea-600">{t.place.priceFree}</span>
                </>
              ) : cost.min != null && cost.max != null ? (
                <>
                  <span className="font-semibold">{formatSarRange(locale, cost.min, cost.max)}</span>
                  <span className="text-ink-500"> {t.common.perPerson}</span>
                  <span className="mt-1 block text-xs text-ink-500">
                    {cost.basis === "verified" && place.priceSource
                      ? t.place.priceVerified
                          .replace("{source}", place.priceSource)
                          .replace("{date}", place.priceCheckedAt ? formatDateTime(locale, place.priceCheckedAt) : "—")
                      : t.place.priceEstimate}
                  </span>
                </>
              ) : (
                <span className="text-sm text-ink-500">{t.place.priceUnknown}</span>
              )}
            </Fact>
            <Fact icon={<Clock className="size-5" />} label={t.place.hours}>
              {status ? (
                <>
                  <span className={`font-semibold ${status.state === "open" ? "text-sea-600" : "text-ink-700"}`}>
                    {status.state === "open" ? t.place.listedOpen : status.state === "closed" ? t.place.listedClosed : t.common.notProvided}
                  </span>
                  {status.nextChange && !status.nextChangeLaterDay && (
                    <span className="block text-sm text-ink-500">
                      {(status.state === "open" ? t.place.closesAt : t.place.opensAt).replace("{time}", formatTime(locale, status.nextChange))}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-ink-500">{t.place.hoursNotProvided}</span>
              )}
            </Fact>
            <Fact icon={<Clock className="size-5" />} label={t.planner.duration2}>
              <span className="text-sm text-ink-700">
                {t.place.estimatedVisit.replace("{duration}", formatMinutes(locale, typicalDuration(place.category, place.subcategory)))}
              </span>
              <span className="mt-1 block text-xs text-ink-500">{t.common.estimate}</span>
            </Fact>
          </dl>

          {/* About */}
          <section aria-labelledby="about" className="space-y-3">
            <h2 id="about" className="font-display text-2xl font-semibold">
              {t.place.about}
            </h2>
            {description ? (
              <p className="max-w-prose whitespace-pre-line text-[17px] leading-relaxed text-ink-800">{description}</p>
            ) : (
              <p className="text-ink-500">{t.place.descriptionMissing}</p>
            )}
            {place.hiddenGem && (locale === "ar" ? place.hiddenGemNoteAr : place.hiddenGemNoteEn) && (
              <p className="max-w-prose rounded-2xl bg-sea-50 p-4 text-[15px] text-sea-700">
                <Gem className="me-1.5 inline size-4" />
                {locale === "ar" ? place.hiddenGemNoteAr : place.hiddenGemNoteEn}
              </p>
            )}
            {attrs.length > 0 && (
              <div className="pt-2">
                <h3 className="mb-2 text-sm font-semibold text-ink-600">{t.explore.attributes}</h3>
                <ul className="flex flex-wrap gap-2">
                  {attrs.map(([k, a]) => (
                    <li key={k} className="rounded-full bg-white px-3 py-1.5 text-sm shadow-card ring-1 ring-sand-200">
                      {attrLabels[k]}
                      {a.source === "category" && <span className="text-ink-400"> · {t.attrs.byCategory}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {place.occasions.length > 0 && (
              <div className="pt-2">
                <h3 className="mb-2 text-sm font-semibold text-ink-600">{t.place.suitableFor}</h3>
                <ul className="flex flex-wrap gap-2">
                  {place.occasions.map((o) => (
                    <li key={o} className="rounded-full bg-sand-200 px-3 py-1.5 text-sm">
                      {OCCASIONS.find((x) => x.slug === o)?.name[locale] ?? o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {place.tags.length > 0 && (
              <div className="pt-2">
                <h3 className="mb-2 text-sm font-semibold text-ink-600">{t.place.tags}</h3>
                <ul className="flex flex-wrap gap-2 text-sm text-ink-600">
                  {place.tags.map((tag) => (
                    <li key={tag}>#{tag}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Hours table */}
          <section aria-labelledby="hours" className="space-y-3">
            <h2 id="hours" className="font-display text-2xl font-semibold">
              {t.place.hours}
            </h2>
            {week ? (
              <>
                <table className="w-full max-w-md text-[15px]">
                  <tbody>
                    {week.map((d, i) => (
                      <tr key={i} className={`border-b border-sand-200 ${i === 0 ? "font-semibold" : ""}`}>
                        <th scope="row" className="py-2 text-start font-normal">
                          {WEEKDAYS[locale][d.weekday]}
                        </th>
                        <td className="py-2 text-end tabular-nums">
                          {d.intervals.length
                            ? d.intervals.map(([a, b]) => `${formatTime(locale, a)}–${b === "24:00" ? formatTime(locale, "00:00") : formatTime(locale, b)}`).join(", ")
                            : t.place.closedDay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-ink-500">
                  {place.hoursSource === "OpenStreetMap" ? t.place.hoursSource : t.place.hoursSourceGeneric.replace("{source}", place.hoursSource ?? "—")}
                </p>
              </>
            ) : (
              <p className="text-ink-500">{t.place.hoursNotProvided}</p>
            )}
          </section>

          {/* Reviews */}
          <ReviewSection
            placeId={place.id}
            reviews={reviews}
            own={
              personal?.review
                ? {
                    id: personal.review.id,
                    rating: personal.review.rating,
                    body: personal.review.body,
                    visitDate: personal.review.visitDate,
                    priceAssessment: personal.review.priceAssessment,
                    spentPerPerson: personal.review.spentPerPerson,
                    photos: personal.review.photos.map((p) => ({ url: p.url })),
                    status: personal.review.status,
                  }
                : null
            }
            avg={avg}
            count={lite.reviews}
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <MiniMap
            markers={[{ id: place.id, lat: place.lat, lng: place.lng, color: def.color, label: name }]}
            className="h-56"
            ariaLabel={`${t.place.location}: ${name}`}
          />
          <div className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
            <InfoRow icon={<MapPin className="size-4" />} label={t.place.address}>
              {place.address || <span className="text-ink-400">{t.common.notProvided}</span>}
              {hoodLabel && <span className="block text-ink-500">{hoodLabel}</span>}
            </InfoRow>
            <InfoRow icon={<Phone className="size-4" />} label={t.place.phone}>
              {place.phone ? (
                <a href={`tel:${place.phone}`} dir="ltr" className="text-sea-600 hover:underline">
                  {place.phone}
                </a>
              ) : (
                <span className="text-ink-400">{t.common.notProvided}</span>
              )}
            </InfoRow>
            <InfoRow icon={<Globe className="size-4" />} label={t.place.website}>
              {place.website ? (
                <a href={place.website} target="_blank" rel="noreferrer noopener" className="break-all text-sea-600 hover:underline" dir="ltr">
                  {place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              ) : (
                <span className="text-ink-400">{t.common.notProvided}</span>
              )}
            </InfoRow>
            {place.instagram && (
              <InfoRow icon={<AtSign className="size-4" />} label={t.place.instagram}>
                <a href={place.instagram} target="_blank" rel="noreferrer noopener" className="text-sea-600 hover:underline" dir="ltr">
                  @{place.instagram.split("/").filter(Boolean).pop()}
                </a>
              </InfoRow>
            )}
            <InfoRow icon={<Info className="size-4" />} label={t.place.facilities}>
              {place.facilities.length ? (
                place.facilities.map((f) => FACILITIES[f]?.[locale] ?? f).join(" · ")
              ) : (
                <span className="text-ink-400">{t.common.notProvided}</span>
              )}
            </InfoRow>
            <InfoRow icon={<Info className="size-4" />} label={t.place.accessibility}>
              {place.attributes?.wheelchair && place.attributes.wheelchair.value !== null ? (
                place.attributes.wheelchair.source === "verified" ? (
                  t.place.wheelchairVerified
                ) : place.attributes.wheelchair.value ? (
                  t.place.wheelchairYes
                ) : (
                  t.place.wheelchairNo
                )
              ) : (
                <span className="text-ink-400">{t.place.accessibilityUnknown}</span>
              )}
              {place.accessibilityNote && <span className="block">{place.accessibilityNote}</span>}
            </InfoRow>
          </div>

          <div className="space-y-3 rounded-2xl bg-white p-5 shadow-card">
            <h2 className="font-semibold">{t.place.notes}</h2>
            <NotesBox placeId={place.id} initial={personal?.note ?? ""} />
          </div>

          <div className="space-y-2 rounded-2xl bg-sand-200/60 p-5 text-sm text-ink-600">
            <h2 className="font-semibold text-ink-800">{t.place.dataSource}</h2>
            <p>{sourceLine}</p>
            {place.verification === "verified" && place.lastVerifiedAt ? (
              <p>{t.place.verifiedOn.replace("{date}", formatDateTime(locale, place.lastVerifiedAt))}</p>
            ) : (
              <p>{t.place.notVerifiedNote}</p>
            )}
            <p className="text-xs text-ink-500">{t.common.lastUpdated.replace("{date}", formatDateTime(locale, place.updatedAt))}</p>
            <ReportButton targetType="place" targetId={place.id} label={t.place.report} />
          </div>
        </aside>
      </div>

      {branches.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="font-display text-2xl font-semibold">{t.place.otherBranches}</h2>
          <p className="mt-1 text-sm text-ink-500">{t.place.chain}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <li key={b.id}>
                <Link href={`/${locale}/place/${b.slug}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-card hover:ring-1 hover:ring-sea-200">
                  <span>{b.hood && hoods[b.hood] ? (locale === "ar" ? hoods[b.hood].ar || hoods[b.hood].en : hoods[b.hood].en) : placeName(locale, b)}</span>
                  <span className="text-sm text-ink-500">{formatDistance(locale, b.km)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <Rail id="similar" title={t.place.youMightLike} note={t.place.youMightLikeWhy}>
          {similar.map((s) => (
            <PlaceCard key={s.id} p={s} locale={locale} t={t} hoods={hoods} />
          ))}
        </Rail>
      )}

      <p className="sr-only">{plural(locale, lite.reviews, t.place.reviewsCount)}</p>
    </article>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <dt className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[15px]">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function ImageCredit({ img, t }: { img: { author?: string | null; license?: string | null; sourceUrl?: string | null }; t: { place: { photoCredit: string } } }) {
  if (!img.author) return null;
  const text = t.place.photoCredit.replace("{author}", img.author).replace("{license}", img.license ?? "");
  return (
    <figcaption className="absolute bottom-0 end-0 max-w-full truncate rounded-ss-lg bg-ink-950/55 px-2 py-1 text-[10px] text-white/85 backdrop-blur">
      {img.sourceUrl ? (
        <a href={img.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
          {text}
        </a>
      ) : (
        text
      )}
    </figcaption>
  );
}
