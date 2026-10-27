"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession, useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-sea-500 focus:ring-2 focus:ring-sea-500/20";

export function CreatePlanForm() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (title.trim().length < 2) return;
        setBusy(true);
        const res = await fetch("/api/together", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            budgetPerPerson: budget.trim() ? Math.max(0, Math.round(Number(budget))) : null,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "";
          return toast((t.together.errors as Record<string, string>)[code] ?? t.common.somethingWrong, { tone: "error" });
        }
        const d = (await res.json()) as { code: string };
        router.push(`/${locale}/together/${d.code}`);
      }}
    >
      <label className="block">
        <span className="mb-1.5 block font-medium">{t.together.planTitle}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder={t.together.planTitlePlaceholder} className={field} dir="auto" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-600">{t.together.descriptionLabel}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={field} dir="auto" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-600">{t.together.budgetLabel}</span>
        <input type="number" inputMode="numeric" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
      </label>
      <Button type="submit" disabled={busy || title.trim().length < 2} className="w-full">
        {t.together.create}
      </Button>
    </form>
  );
}

export function JoinCodeForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(c)) return setError(t.together.invalidCode);
        router.push(`/${locale}/together/${c}`);
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t.together.codeLabel}</span>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t.together.codePlaceholder}
          className={`${field} font-mono tracking-[0.25em]`}
          dir="ltr"
        />
      </label>
      <Button type="submit" variant="dark">
        {t.together.go}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-coral-700">
          {error}
        </p>
      )}
    </form>
  );
}

/** Shown to people who open a plan link but haven't joined yet. */
export function JoinPlan({ code }: { code: string }) {
  const { t } = useI18n();
  const user = useSession();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function join() {
    setBusy(true);
    const res = await fetch(`/api/together/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(user ? {} : { displayName: name.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const c = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "";
      return toast((t.together.errors as Record<string, string>)[c] ?? t.common.somethingWrong, { tone: "error" });
    }
    router.refresh();
  }
  if (user)
    return (
      <Button onClick={join} disabled={busy} size="lg">
        {t.together.joinWithAccount.replace("{name}", user.displayName)}
      </Button>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) join();
      }}
    >
      <label className="block">
        <span className="mb-1.5 block font-medium">{t.together.yourName}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={field} dir="auto" autoComplete="given-name" />
      </label>
      <Button type="submit" disabled={busy || !name.trim()} size="lg" className="w-full">
        {t.together.joinAsGuest}
      </Button>
      <p className="text-xs text-ink-500">{t.together.guestNote}</p>
    </form>
  );
}
