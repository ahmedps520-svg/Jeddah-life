"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, adminRequest, useErrorText } from "./form";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";

/**
 * A button that opens a confirmation with a note (required unless stated)
 * and sends { ...payload, [noteKey]: note } to an admin endpoint.
 */
export function NoteAction({
  url,
  method = "PATCH",
  payload,
  noteKey = "note",
  label,
  title,
  body,
  noteLabel,
  noteHint,
  noteRequired = true,
  done,
  variant = "secondary",
  tone = "primary",
  icon,
}: {
  url: string;
  method?: "PATCH" | "POST";
  payload: Record<string, unknown>;
  noteKey?: string;
  label: string;
  title: string;
  body?: ReactNode;
  noteLabel?: string;
  noteHint?: string;
  noteRequired?: boolean;
  done: string;
  variant?: Variant;
  tone?: "primary" | "danger";
  icon?: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const err = useErrorText();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        {icon}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        confirmLabel={label}
        tone={tone}
        busy={busy}
        error={error}
        note={noteLabel !== undefined || noteRequired ? { label: noteLabel ?? t.admin.common.note, hint: noteHint, required: noteRequired } : undefined}
        onConfirm={async (note) => {
          setBusy(true);
          const r = await adminRequest(url, method, { ...payload, [noteKey]: note });
          setBusy(false);
          if (!r.ok) return setError(err(Object.values(r.fields)[0] ?? r.code));
          setOpen(false);
          toast(done);
          router.refresh();
        }}
      >
        {body}
      </ConfirmDialog>
    </>
  );
}
