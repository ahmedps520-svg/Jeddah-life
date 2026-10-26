"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Flag, Lock, MapPin } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useCityLocation, useSession, useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { haversineKm } from "@/lib/places/estimates";
import { formatDistance } from "@/lib/i18n/format";

export function NotesBox({ placeId, initial }: { placeId: string; initial: string }) {
  const { t, locale } = useI18n();
  const user = useSession();
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (!user) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Lock className="size-4" />
        <Link href={`/${locale}/auth/sign-in`} className="text-sea-600 underline-offset-2 hover:underline">
          {t.common.signInRequired}
        </Link>
      </p>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/me/notes", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId, body: value }),
        });
        setBusy(false);
        if (res.ok) {
          setSaved(value);
          toast(t.place.notesSaved);
        } else toast(t.common.somethingWrong, { tone: "error" });
      }}
      className="space-y-2"
    >
      <label htmlFor="note" className="sr-only">
        {t.place.notes}
      </label>
      <textarea
        id="note"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t.place.notesPlaceholder}
        className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-sea-400"
      />
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-ink-400">
          <Lock className="size-3.5" /> {t.place.notesHint}
        </span>
        <Button type="submit" size="sm" disabled={busy || value === saved}>
          {t.place.saveNote}
        </Button>
      </div>
    </form>
  );
}

export function VisitedToggle({ placeId, initial }: { placeId: string; initial: boolean }) {
  const { t } = useI18n();
  const user = useSession();
  const toast = useToast();
  const [visited, setVisited] = useState(initial);
  if (!user) return null;
  return (
    <button
      type="button"
      aria-pressed={visited}
      onClick={async () => {
        const next = !visited;
        setVisited(next);
        const res = await fetch("/api/me/visits", {
          method: next ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId }),
        });
        if (!res.ok) {
          setVisited(!next);
          toast(t.common.somethingWrong, { tone: "error" });
        }
      }}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 transition ${
        visited ? "bg-sea-50 text-sea-700 ring-sea-200" : "ring-sand-300 hover:bg-sand-200"
      }`}
    >
      <Check className="size-4" /> {visited ? t.place.visited : t.place.markVisited}
    </button>
  );
}

export function DistanceFromYou({ lat, lng }: { lat: number; lng: number }) {
  const { t, locale } = useI18n();
  const { origin } = useCityLocation();
  if (!origin) return null;
  const km = haversineKm(origin, { lat, lng });
  return (
    <span className="inline-flex items-center gap-1.5">
      <MapPin className="size-4 text-coral-500" />
      {t.place.distanceFromYou.replace("{distance}", formatDistance(locale, km))}
    </span>
  );
}

const PLACE_REASONS = ["closed", "wrong_location", "wrong_hours", "wrong_price", "wrong_contact", "wrong_details", "duplicate", "something_else"] as const;
const CONTENT_REASONS = ["inappropriate", "spam", "misleading", "outdated", "something_else"] as const;

export function ReportButton({
  targetType,
  targetId,
  label,
  variant = "link",
}: {
  targetType: "place" | "review" | "submission" | "event";
  targetId: string;
  label?: string;
  variant?: "link" | "icon";
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const reasons = targetType === "place" || targetType === "event" ? PLACE_REASONS : CONTENT_REASONS;
  const [reason, setReason] = useState<string>(reasons[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const reasonLabels = t.report.reasons as Record<string, string>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "icon"
            ? "rounded-full p-1.5 text-ink-400 hover:bg-sand-200 hover:text-ink-700"
            : "inline-flex items-center gap-1.5 text-sm text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
        }
        aria-label={label ?? t.report.title}
      >
        <Flag className="size-4" />
        {variant === "link" && (label ?? t.report.title)}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.report.title} labelledBy={`report-${targetId}`} size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await fetch("/api/reports", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ targetType, targetId, reason, details: details || undefined }),
            });
            setBusy(false);
            if (res.ok) {
              toast(t.report.sent);
              setOpen(false);
              setDetails("");
            } else toast(res.status === 429 ? t.report.rateLimited : t.common.somethingWrong, { tone: "error" });
          }}
        >
          <p className="text-sm text-ink-500">{t.report.lede}</p>
          <fieldset>
            <legend className="mb-2 font-semibold">{t.report.reason}</legend>
            <div className="space-y-1">
              {reasons.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-sand-100">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-sea-500" />
                  {reasonLabels[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block font-semibold">{t.report.details}</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t.report.detailsHint}
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2"
            />
          </label>
          <Button type="submit" disabled={busy} className="w-full">
            {t.report.send}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
