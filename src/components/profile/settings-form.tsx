"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Download, LogOut, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";
import { useNeighbourhoods } from "@/components/layout/location-picker";
import { INTERESTS, PLACE_CATEGORIES } from "@/lib/taxonomy";
import type { NotificationPrefs, PrivacyPrefs } from "@/lib/db/schema";
import { signOutAction } from "@/lib/actions/auth";
import { formatNumber } from "@/lib/i18n/format";
import { InstallApp } from "./install-app";

export type SettingsInit = {
  displayName: string;
  avatarUrl: string | null;
  interests: string[];
  favoriteCategories: string[];
  budgetPreference: number | null;
  homeNeighbourhood: string | null;
  privacy: PrivacyPrefs;
  notificationPrefs: NotificationPrefs;
};

async function patch(data: Partial<SettingsInit>) {
  const res = await fetch("/api/me/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export function InterestsEditor({ init, autoSave = true }: { init: SettingsInit; autoSave?: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [interests, setInterests] = useState(init.interests);
  const [cats, setCats] = useState(init.favoriteCategories);

  const toggle = async (list: string[], set: (v: string[]) => void, key: "interests" | "favoriteCategories", v: string) => {
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    set(next);
    if (autoSave) {
      if (await patch({ [key]: next })) router.refresh();
      else toast(t.common.somethingWrong, { tone: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="font-semibold">{t.profile.interests}</legend>
        <p className="mb-3 text-sm text-ink-500">{t.profile.interestsLede}</p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = interests.includes(i.slug);
            return (
              <button
                key={i.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(interests, setInterests, "interests", i.slug)}
                className={`rounded-full px-4 py-2 text-sm transition ${on ? "bg-sea-500 text-white" : "bg-white ring-1 ring-sand-300 hover:ring-ink-300"}`}
              >
                {i.name[locale]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 font-semibold">{t.profile.favoriteCategories}</legend>
        <div className="flex flex-wrap gap-2">
          {PLACE_CATEGORIES.map((c) => {
            const on = cats.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(cats, setCats, "favoriteCategories", c.slug)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${on ? "bg-ink-900 text-white" : "bg-white ring-1 ring-sand-300 hover:ring-ink-300"}`}
              >
                <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name[locale]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

export function SettingsForm({ init }: { init: SettingsInit }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const hoods = useNeighbourhoods();
  const [name, setName] = useState(init.displayName);
  const [avatar, setAvatar] = useState(init.avatarUrl);
  const [budget, setBudget] = useState<number | null>(init.budgetPreference);
  const [home, setHome] = useState(init.homeNeighbourhood);
  const [privacy, setPrivacy] = useState(init.privacy);
  const [notif, setNotif] = useState(init.notificationPrefs);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const ok = await patch({ displayName: name, avatarUrl: avatar, budgetPreference: budget, homeNeighbourhood: home, privacy, notificationPrefs: notif });
    setBusy(false);
    if (ok) {
      toast(t.profile.savedChanges);
      router.refresh();
    } else toast(t.common.somethingWrong, { tone: "error" });
  }

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.set("folder", "avatars");
    fd.set("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
    setAvatar(((await res.json()) as { url: string }).url);
  }

  const card = "space-y-4 rounded-3xl bg-white p-6 shadow-card";
  const input = "h-11 w-full rounded-xl border border-sand-300 bg-white px-3";

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="pref-title">
        <h2 id="pref-title" className="font-display text-xl font-semibold">
          {t.profile.editProfile}
        </h2>
        <div className="flex items-center gap-4">
          <label className="relative grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full bg-sand-200 ring-1 ring-sand-300">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-display text-2xl">{name.charAt(0).toUpperCase()}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-ink-950/50 py-1 text-white">
              <Camera className="size-3.5" />
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <span className="sr-only">{t.profile.avatar}</span>
          </label>
          <div className="text-xs text-ink-500">
            <p className="font-medium text-ink-700">{t.profile.avatar}</p>
            <p>{t.profile.avatarHint}</p>
            {avatar && (
              <button type="button" className="mt-1 text-coral-500 hover:underline" onClick={() => setAvatar(null)}>
                {t.common.remove}
              </button>
            )}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t.auth.displayName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.profile.budget}</span>
            <select value={budget ?? ""} onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : null)} className={input}>
              <option value="">{t.profile.budgetNone}</option>
              {[0, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? t.common.free : t.explore.priceUnder.replace("{n}", formatNumber(locale, n))}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.profile.homeArea}</span>
            <select value={home ?? ""} onChange={(e) => setHome(e.target.value || null)} className={input}>
              <option value="">{t.explore.anyArea}</option>
              {(hoods ?? []).map((h) => (
                <option key={h.slug} value={h.slug}>
                  {locale === "ar" ? h.nameAr || h.nameEn : h.nameEn}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={card} aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="font-display text-xl font-semibold">
          {t.profile.privacy}
        </h2>
        <Toggle checked={privacy.profilePublic} onChange={(v) => setPrivacy({ ...privacy, profilePublic: v })} label={t.profile.privacyPublic} hint={t.profile.privacyPublicHint} />
        <Toggle checked={privacy.showVisited} onChange={(v) => setPrivacy({ ...privacy, showVisited: v })} label={t.profile.privacyVisited} />
        <Toggle checked={privacy.showReviewsOnProfile} onChange={(v) => setPrivacy({ ...privacy, showReviewsOnProfile: v })} label={t.profile.privacyReviews} />
        <Toggle checked={privacy.personalize} onChange={(v) => setPrivacy({ ...privacy, personalize: v })} label={t.profile.privacyPersonalize} hint={t.profile.privacyPersonalizeHint} />
      </section>

      <section id="notifications" className={`${card} scroll-mt-24`} aria-labelledby="notif-title">
        <h2 id="notif-title" className="font-display text-xl font-semibold">
          {t.profile.notificationsPrefs}
        </h2>
        <Toggle checked={notif.savedEvents} onChange={(v) => setNotif({ ...notif, savedEvents: v })} label={t.profile.notifSavedEvents} />
        <Toggle checked={notif.outingReminders} onChange={(v) => setNotif({ ...notif, outingReminders: v })} label={t.profile.notifOutings} />
        <Toggle checked={notif.eventChanges} onChange={(v) => setNotif({ ...notif, eventChanges: v })} label={t.profile.notifEventChanges} />
        <Toggle checked={notif.planInvites} onChange={(v) => setNotif({ ...notif, planInvites: v })} label={t.profile.notifInvites} />
        <Toggle checked={notif.planActivity} onChange={(v) => setNotif({ ...notif, planActivity: v })} label={t.profile.notifActivity} />
        <Toggle checked={notif.promotional} onChange={(v) => setNotif({ ...notif, promotional: v })} label={t.profile.notifPromotional} hint={t.profile.notifPromotionalHint} />
      </section>

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+12px)] z-10 md:bottom-4">
        <Button onClick={save} disabled={busy} size="lg" className="w-full shadow-lift">
          {t.profile.saveChanges}
        </Button>
      </div>

      <section className={card}>
        <InstallApp />
        <div className="flex flex-wrap gap-3 border-t border-sand-200 pt-4">
          <a href="/api/me/export" className="inline-flex h-11 items-center gap-2 rounded-full px-5 ring-1 ring-sand-300 hover:bg-sand-100">
            <Download className="size-4" /> {t.profile.exportData}
          </a>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full px-5 ring-1 ring-sand-300 hover:bg-sand-100">
              <LogOut className="size-4" /> {t.auth.signOut}
            </button>
          </form>
        </div>
        <p className="text-xs text-ink-500">{t.profile.exportHint}</p>
      </section>

      <section className="space-y-4 rounded-3xl border border-coral-400/40 bg-coral-400/5 p-6" aria-labelledby="danger-title">
        <h2 id="danger-title" className="font-display text-xl font-semibold text-coral-500">
          {t.profile.dangerZone}
        </h2>
        <p className="text-sm text-ink-700">{t.profile.deleteLede}</p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t.profile.deleteConfirmLabel}</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" className={input} autoComplete="off" />
        </label>
        <Button
          variant="danger"
          disabled={confirm !== "DELETE"}
          onClick={async () => {
            const res = await fetch("/api/me/account", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ confirm }),
            });
            if (res.ok) {
              toast(t.profile.deleted);
              window.location.assign(`/${locale}`);
            } else toast(t.common.somethingWrong, { tone: "error" });
          }}
        >
          <Trash2 className="size-4" /> {t.profile.deleteButton}
        </Button>
      </section>
    </div>
  );
}
