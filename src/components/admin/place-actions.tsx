"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, BadgeCheck, Eye, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { ActionButton, ConfirmDialog, adminRequest, useErrorText } from "./form";

/** Sidebar actions on the place edit page. */
export function PlaceActions({ id, slug, status }: { id: string; slug: string; status: "draft" | "published" | "archived" }) {
  const { t, locale } = useI18n();
  const a = t.admin.places;
  const url = `/api/admin/places/${id}/action`;
  return (
    <div className="flex flex-col gap-2">
      <ActionButton url={url} payload={{ action: "verify" }} label={a.markVerified} done={a.markedVerified} variant="primary" icon={<BadgeCheck className="size-4" aria-hidden />} />
      {status !== "published" && (
        <ActionButton url={url} payload={{ action: "publish" }} label={a.publish} done={a.published} icon={<Eye className="size-4" aria-hidden />} />
      )}
      {status === "published" && (
        <ActionButton url={url} payload={{ action: "draft" }} label={a.unpublish} done={t.admin.common.saved} icon={<EyeOff className="size-4" aria-hidden />} />
      )}
      {status === "archived" ? (
        <ActionButton url={url} payload={{ action: "draft" }} label={a.restore} done={a.restored} icon={<RotateCcw className="size-4" aria-hidden />} />
      ) : (
        <ActionButton
          url={url}
          payload={{ action: "archive" }}
          label={a.archive}
          done={a.archived}
          icon={<Archive className="size-4" aria-hidden />}
          confirm={{ title: a.archive, body: a.archiveConfirm }}
        />
      )}
      <DeleteRecord url={`/api/admin/places/${id}`} slug={slug} after={`/${locale}/admin/places`} labels={{ title: a.dangerZone, lede: a.deleteLede, button: a.delete, done: a.deleted }} />
    </div>
  );
}

/** Permanent deletion guarded by typing the record's slug. */
export function DeleteRecord({ url, slug, after, labels }: { url: string; slug: string; after: string; labels: { title: string; lede: string; button: string; done: string } }) {
  const router = useRouter();
  const toast = useToast();
  const err = useErrorText();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-coral-500 hover:bg-coral-400/10" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> {labels.button}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={labels.title}
        confirmLabel={labels.button}
        tone="danger"
        typeWord={slug}
        busy={busy}
        error={error}
        onConfirm={async () => {
          setBusy(true);
          const r = await adminRequest(url, "DELETE", { confirm: slug });
          setBusy(false);
          if (!r.ok) return setError(err(r.code));
          setOpen(false);
          toast(labels.done);
          router.push(after);
        }}
      >
        {labels.lede}
      </ConfirmDialog>
    </>
  );
}
