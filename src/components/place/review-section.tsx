"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession, useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { ReportButton } from "./personal-tools";
import { formatDay, formatNumber, formatSar, relativeTime } from "@/lib/i18n/format";
import type { ReviewView } from "@/lib/places/detail";

type Own = {
  id: string;
  rating: number;
  body: string;
  visitDate: string | null;
  priceAssessment: string | null;
  spentPerPerson: number | null;
  photos: { url: string }[];
  status: string;
} | null;

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-gold-400 text-gold-400" : "text-sand-400"}`} />
      ))}
    </span>
  );
}

export function ReviewSection({
  placeId,
  reviews,
  own,
  avg,
  count,
}: {
  placeId: string;
  reviews: ReviewView[];
  own: Own;
  avg: number | null;
  count: number;
}) {
  const { t, locale } = useI18n();
  const user = useSession();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [body, setBody] = useState(own?.body ?? "");
  const [visitDate, setVisitDate] = useState(own?.visitDate ?? "");
  const [price, setPrice] = useState(own?.priceAssessment ?? "");
  const [spent, setSpent] = useState(own?.spentPerPerson?.toString() ?? "");
  const [photos, setPhotos] = useState<{ url: string }[]>(own?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showForm = user && (!own || editing);
  const today = new Date().toISOString().slice(0, 10);

  async function upload(file: File) {
    const fd = new FormData();
    fd.set("folder", "reviews");
    fd.set("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (!res.ok) {
      toast(t.common.somethingWrong, { tone: "error" });
      return;
    }
    const d = (await res.json()) as { url: string };
    setPhotos((p) => [...p, { url: d.url }].slice(0, 4));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) return setError(t.reviews.rating);
    if (body.trim().length < 20) return setError(t.reviews.bodyHint);
    setBusy(true);
    const payload = {
      placeId,
      rating,
      body: body.trim(),
      visitDate: visitDate || null,
      priceAssessment: price || null,
      spentPerPerson: spent ? Math.round(Number(spent)) : null,
      photos,
    };
    const res = await fetch(own ? `/api/reviews/${own.id}` : "/api/reviews", {
      method: own ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      toast(own ? t.reviews.updated : t.reviews.thanks);
      setEditing(false);
      router.refresh();
    } else if (res.status === 429) setError(t.reviews.rateLimited);
    else setError(t.common.somethingWrong);
  }

  return (
    <section aria-labelledby="reviews-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-title" className="font-display text-2xl font-semibold">
            {t.reviews.title}
          </h2>
          {avg != null && count > 0 ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-600">
              <Stars value={avg} /> <strong>{formatNumber(locale, avg)}</strong> · {t.reviews.average.replace("{n}", formatNumber(locale, count))}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">{t.place.noReviews}</p>
          )}
          <p className="mt-1 text-xs text-ink-400">{t.reviews.onlyOurs}</p>
        </div>
        {user && own && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t.reviews.edit}
          </Button>
        )}
      </div>

      {!user && (
        <p className="rounded-2xl bg-white p-4 text-sm shadow-card">
          <Link href={`/${locale}/auth/sign-in`} className="font-medium text-sea-600 hover:underline">
            {t.reviews.signIn}
          </Link>
        </p>
      )}

      {showForm && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
          <h3 className="font-semibold">{own ? t.reviews.edit : t.reviews.write}</h3>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t.reviews.rating}</legend>
            <div className="flex items-center gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={rating === i}
                  aria-label={t.reviews.ratingLabels[i - 1]}
                  onClick={() => setRating(i)}
                  className="rounded-md p-1"
                >
                  <Star className={`size-8 transition ${i <= rating ? "fill-gold-400 text-gold-400" : "text-sand-400 hover:text-gold-400"}`} />
                </button>
              ))}
              {rating > 0 && <span className="ms-2 text-sm text-ink-600">{t.reviews.ratingLabels[rating - 1]}</span>}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.reviews.body}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              minLength={20}
              placeholder={t.reviews.bodyHint}
              className="w-full rounded-xl border border-sand-300 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t.reviews.visitDate}</span>
              <input type="date" max={today} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="h-11 w-full rounded-xl border border-sand-300 px-3" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t.reviews.spent}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                className="h-11 w-full rounded-xl border border-sand-300 px-3"
              />
            </label>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t.reviews.priceAssessment}</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ["lower", t.reviews.priceLower],
                ["as_expected", t.reviews.priceAsExpected],
                ["higher", t.reviews.priceHigher],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={price === v}
                  onClick={() => setPrice(price === v ? "" : v)}
                  className={`rounded-full px-3 py-1.5 text-sm ring-1 ${price === v ? "bg-sea-500 text-white ring-sea-500" : "ring-sand-300"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <span className="mb-1 block text-sm font-medium">{t.reviews.photo}</span>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((p) => (
                <span key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((x) => x.filter((y) => y.url !== p.url))}
                    className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink-900 text-white"
                    aria-label={t.common.remove}
                  >
                    ×
                  </button>
                </span>
              ))}
              {photos.length < 4 && (
                <label className="grid size-16 cursor-pointer place-items-center rounded-lg ring-1 ring-dashed ring-sand-400 hover:bg-sand-100">
                  <ImagePlus className="size-5 text-ink-400" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                  />
                  <span className="sr-only">{t.reviews.photo}</span>
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-400">{t.reviews.photoHint}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-coral-500">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {own ? t.reviews.update : t.reviews.submit}
            </Button>
            {own && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t.common.cancel}
              </Button>
            )}
          </div>
        </form>
      )}

      {own?.status === "hidden" && <p className="text-sm text-coral-500">{t.reviews.hiddenByMod}</p>}

      <ul className="space-y-4">
        {reviews.map((r) => {
          const mine = user?.id === r.authorId;
          return (
            <li key={r.id} className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-sm font-semibold">{mine ? t.reviews.you : r.author}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {relativeTime(locale, r.createdAt)}
                    {r.visitDate && ` · ${t.reviews.visited.replace("{date}", formatDay(locale, r.visitDate, { year: "numeric" }))}`}
                  </p>
                </div>
                {mine ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(t.reviews.deleteConfirm)) return;
                      const res = await fetch(`/api/reviews/${r.id}`, { method: "DELETE" });
                      if (res.ok) {
                        toast(t.reviews.deleted);
                        router.refresh();
                      }
                    }}
                    className="rounded-full p-1.5 text-ink-400 hover:bg-sand-200 hover:text-coral-500"
                    aria-label={t.reviews.delete}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <ReportButton targetType="review" targetId={r.id} label={t.reviews.report} variant="icon" />
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-800">{r.body}</p>
              {(r.priceAssessment || r.spentPerPerson != null) && (
                <p className="mt-2 text-xs text-ink-500">
                  {r.priceAssessment && (t.reviews.priceLine as Record<string, string>)[r.priceAssessment]}
                  {r.priceAssessment && r.spentPerPerson != null && " · "}
                  {r.spentPerPerson != null && t.reviews.spentLine.replace("{amount}", formatSar(locale, r.spentPerPerson))}
                </p>
              )}
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.url} src={p.url} alt="" loading="lazy" className="size-24 rounded-xl object-cover" />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
