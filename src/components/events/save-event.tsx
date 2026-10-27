"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession, useToast } from "@/components/providers/app-state";

export function SaveEventButton({ eventId, initial }: { eventId: string; initial: boolean }) {
  const { t } = useI18n();
  const user = useSession();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={async () => {
        if (!user) return toast(t.common.signInRequired, { action: { label: t.auth.signIn, href: "/auth/sign-in" } });
        const next = !saved;
        setSaved(next);
        const res = await fetch("/api/me/event-saves", {
          method: next ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        if (!res.ok) {
          setSaved(!next);
          toast(t.common.somethingWrong, { tone: "error" });
        } else if (next) toast(t.events.saved);
      }}
      className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium transition ${
        saved ? "bg-coral-500 text-white" : "bg-white ring-1 ring-sand-300 hover:ring-ink-300"
      }`}
    >
      <Bookmark className={`size-[18px] ${saved ? "fill-current" : ""}`} /> {saved ? t.events.saved : t.events.save}
    </button>
  );
}
