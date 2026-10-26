"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/explore/explore-controls";

export function NewCollectionButton() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {t.saved.newCollection}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.saved.newCollection} labelledBy="new-collection" size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await fetch("/api/me/collections", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, description: description || undefined, isPublic }),
            });
            setBusy(false);
            if (!res.ok) return toast(t.common.somethingWrong, { tone: "error" });
            const { id } = (await res.json()) as { id: string };
            router.push(`/${locale}/saved/collections/${id}`);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t.saved.collectionName}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className="h-11 w-full rounded-xl border border-sand-300 px-3" />
          </label>
          <div className="flex flex-wrap gap-2">
            {t.saved.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="rounded-full bg-sand-200 px-3 py-1 text-sm hover:bg-sand-300">
                {s}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              {t.saved.collectionDescription} <span className="text-ink-400">({t.common.optional})</span>
            </span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={2} className="w-full rounded-xl border border-sand-300 px-3 py-2" />
          </label>
          <Toggle checked={isPublic} onChange={setPublic} label={t.saved.makePublic} hint={isPublic ? t.saved.publicNote : t.saved.privateNote} />
          <Button type="submit" disabled={busy || !name.trim()} className="w-full">
            {t.common.done}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
