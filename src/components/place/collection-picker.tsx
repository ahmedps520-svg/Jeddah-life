"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSession, useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/i18n/format";

type Col = { id: string; name: string; count: number; has: boolean };

export function CollectionPicker({ placeId, open, onClose }: { placeId: string; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const user = useSession();
  const toast = useToast();
  const [cols, setCols] = useState<Col[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/me/collections?placeId=${encodeURIComponent(placeId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { collections: Col[] }) => setCols(d.collections))
      .catch(() => setCols([]));

  useEffect(() => {
    if (open && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, placeId]);

  async function toggle(c: Col) {
    setCols((list) => list?.map((x) => (x.id === c.id ? { ...x, has: !c.has, count: x.count + (c.has ? -1 : 1) } : x)) ?? null);
    const res = await fetch(`/api/me/collections/${c.id}/items`, {
      method: c.has ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    if (res.ok) toast((c.has ? t.saved.removedFrom : t.saved.addedTo).replace("{name}", c.name));
    else {
      toast(t.common.somethingWrong, { tone: "error" });
      load();
    }
  }

  async function create(n: string) {
    if (!n.trim()) return;
    setBusy(true);
    const res = await fetch("/api/me/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: n.trim(), placeId }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      toast(t.saved.addedTo.replace("{name}", n.trim()));
      load();
    } else toast(t.common.somethingWrong, { tone: "error" });
  }

  return (
    <Sheet open={open} onClose={onClose} title={t.saved.addToCollectionTitle} labelledBy="collection-picker" size="sm">
      {!user ? (
        <div className="space-y-4">
          <p className="text-ink-600">{t.saved.signInPrompt}</p>
          <a href={`/${locale}/auth/sign-in`} className="inline-flex h-11 items-center rounded-full bg-sea-500 px-5 font-medium text-white">
            {t.auth.signIn}
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-sand-200">
            {cols === null && <li className="py-3 text-sm text-ink-500">{t.common.loading}</li>}
            {cols?.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => toggle(c)} className="flex w-full items-center gap-3 py-3 text-start" aria-pressed={c.has}>
                  <span className={`grid size-6 place-items-center rounded-md ring-1 ${c.has ? "bg-sea-500 text-white ring-sea-500" : "ring-sand-400"}`}>
                    {c.has && <Check className="size-4" />}
                  </span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-ink-400">{plural(locale, c.count, t.saved.placesCount)}</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create(name);
            }}
            className="flex gap-2"
          >
            <label className="sr-only" htmlFor="new-col">
              {t.saved.collectionName}
            </label>
            <input
              id="new-col"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t.saved.newCollection}
              className="h-11 flex-1 rounded-xl border border-sand-300 bg-white px-3"
            />
            <Button type="submit" disabled={busy || !name.trim()} aria-label={t.saved.newCollection}>
              <Plus className="size-4" />
            </Button>
          </form>
          {cols && cols.length === 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-ink-500">
                <FolderPlus className="size-4" /> {t.saved.emptyCollections}
              </p>
              <div className="flex flex-wrap gap-2">
                {t.saved.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => create(s)} className="rounded-full bg-sand-200 px-3 py-1.5 text-sm hover:bg-sand-300">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
