import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collections, itineraries, places, reviews, saves, submissions, visits } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { formatDateTime, formatNumber, placeName } from "@/lib/i18n/format";
import { ButtonLink } from "@/components/ui/button";
import { InterestsEditor, SettingsForm } from "@/components/profile/settings-form";
import { InstallApp } from "@/components/profile/install-app";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { PlaceRow, type HoodNames } from "@/components/place/place-card";
import { Stars } from "@/components/place/review-section";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.profile.title, robots: { index: false } };
}

const n = sql<number>`count(*)`;
const first = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

export default async function ProfilePage({ searchParams }: PageProps<"/[lang]/profile">) {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  const welcome = (await searchParams).welcome === "1";

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <h1 className="font-display text-[34px] font-semibold">{t.profile.guestTitle}</h1>
        <p className="text-ink-600">{t.profile.guestLede}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/${locale}/auth/sign-up`} size="lg">
            {t.auth.signUp}
          </ButtonLink>
          <ButtonLink href={`/${locale}/auth/sign-in`} variant="secondary" size="lg">
            {t.auth.signIn}
          </ButtonLink>
        </div>
        <div className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t.profile.language}</span>
            <LanguageSwitch tone="light" />
          </div>
          <InstallApp />
        </div>
      </div>
    );
  }

  const [nSaved, nCollections, nItineraries, nVisited, nReviews, nSubs, visited, myReviews, mySubs, catalog] = await Promise.all([
    db.select({ n }).from(saves).where(eq(saves.userId, user.id)).then(first),
    db.select({ n }).from(collections).where(eq(collections.userId, user.id)).then(first),
    db.select({ n }).from(itineraries).where(eq(itineraries.userId, user.id)).then(first),
    db.select({ n }).from(visits).where(eq(visits.userId, user.id)).then(first),
    db.select({ n }).from(reviews).where(eq(reviews.userId, user.id)).then(first),
    db.select({ n }).from(submissions).where(eq(submissions.userId, user.id)).then(first),
    db.select({ placeId: visits.placeId }).from(visits).where(eq(visits.userId, user.id)).orderBy(desc(visits.createdAt)).limit(12),
    db
      .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, status: reviews.status, slug: places.slug, nameEn: places.nameEn, nameAr: places.nameAr, createdAt: reviews.createdAt })
      .from(reviews)
      .innerJoin(places, eq(places.id, reviews.placeId))
      .where(eq(reviews.userId, user.id))
      .orderBy(desc(reviews.createdAt))
      .limit(20),
    db.select().from(submissions).where(eq(submissions.userId, user.id)).orderBy(desc(submissions.createdAt)).limit(20),
    getCatalog(),
  ]);
  const hoods: HoodNames = Object.fromEntries(catalog.hoods.map((h) => [h.slug, { en: h.nameEn, ar: h.nameAr }]));
  const stats = [
    { label: t.profile.savedPlaces, n: nSaved, href: "/saved" },
    { label: t.profile.collections, n: nCollections, href: "/saved?tab=collections" },
    { label: t.profile.itineraries, n: nItineraries, href: "/saved?tab=outings" },
    { label: t.profile.visited, n: nVisited, href: "#visited" },
    { label: t.profile.reviews, n: nReviews, href: "#reviews" },
    { label: t.profile.recommendations, n: nSubs, href: "#submissions" },
  ];
  const statusLabel = { pending: t.gems.statusPending, approved: t.gems.statusApproved, rejected: t.gems.statusRejected };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex items-center gap-5">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-900 text-3xl text-sand-50 ring-4 ring-white">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-display">{user.displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-tight">{user.displayName}</h1>
          <p className="text-sm text-ink-500">{t.profile.memberSince.replace("{date}", formatDateTime(locale, user.createdAt))}</p>
          {user.role === "admin" && (
            <Link href={`/${locale}/admin`} className="mt-1 inline-block text-sm font-semibold text-sea-600 hover:underline">
              {t.nav.admin} →
            </Link>
          )}
        </div>
      </header>

      <ul className="mt-8 grid grid-cols-3 gap-3 md:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href.startsWith("#") ? s.href : `/${locale}${s.href}`} className="block rounded-2xl bg-white p-4 text-center shadow-card hover:ring-1 hover:ring-sea-200">
              <span className="block font-display text-2xl font-semibold">{formatNumber(locale, s.n)}</span>
              <span className="mt-1 block text-xs text-ink-500">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className={`rounded-3xl bg-white p-6 shadow-card ${welcome ? "ring-2 ring-sea-300" : ""}`} aria-labelledby="interests-title">
            <h2 id="interests-title" className="sr-only">
              {t.profile.interests}
            </h2>
            {welcome && <p className="mb-4 font-display text-xl">{t.auth.welcome}</p>}
            <InterestsEditor
              init={{
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                interests: user.interests,
                favoriteCategories: user.favoriteCategories,
                budgetPreference: user.budgetPreference,
                homeNeighbourhood: user.homeNeighbourhood,
                privacy: user.privacy,
                notificationPrefs: user.notificationPrefs,
              }}
            />
          </section>

          <section id="visited" aria-labelledby="visited-title">
            <h2 id="visited-title" className="mb-3 font-display text-2xl font-semibold">
              {t.profile.visited}
            </h2>
            {visited.length ? (
              <div className="space-y-1 rounded-3xl bg-white p-2 shadow-card">
                {visited.map((v) => {
                  const p = catalog.byId.get(v.placeId);
                  return p ? <PlaceRow key={p.id} p={p} locale={locale} t={t} hoods={hoods} /> : null;
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-500">—</p>
            )}
          </section>

          <section id="reviews" aria-labelledby="myreviews-title">
            <h2 id="myreviews-title" className="mb-3 font-display text-2xl font-semibold">
              {t.profile.myReviews}
            </h2>
            {myReviews.length ? (
              <ul className="space-y-3">
                {myReviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
                    <Link href={`/${locale}/place/${r.slug}`} className="font-semibold hover:text-sea-600">
                      {placeName(locale, r)}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                      <Stars value={r.rating} size="size-3.5" /> {formatDateTime(locale, r.createdAt)}
                      {r.status !== "published" && <span className="text-coral-500">· {t.reviews.hiddenByMod}</span>}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-ink-700">{r.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">—</p>
            )}
          </section>

          <section id="submissions" aria-labelledby="mysubs-title">
            <h2 id="mysubs-title" className="mb-3 font-display text-2xl font-semibold">
              {t.profile.mySubmissions}
            </h2>
            {mySubs.length ? (
              <ul className="space-y-3">
                {mySubs.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">{s.description}</p>
                      {s.moderatorNote && <p className="mt-1 text-xs text-ink-500">{s.moderatorNote}</p>}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        s.status === "approved" ? "bg-sea-50 text-sea-700" : s.status === "rejected" ? "bg-coral-400/15 text-coral-500" : "bg-sand-200 text-ink-700"
                      }`}
                    >
                      {statusLabel[s.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Link href={`/${locale}/hidden-gems/submit`} className="text-sm font-medium text-sea-600 hover:underline">
                {t.gems.submit}
              </Link>
            )}
          </section>
        </div>

        <aside>
          <SettingsForm
            init={{
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              interests: user.interests,
              favoriteCategories: user.favoriteCategories,
              budgetPreference: user.budgetPreference,
              homeNeighbourhood: user.homeNeighbourhood,
              privacy: user.privacy,
              notificationPrefs: user.notificationPrefs,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
