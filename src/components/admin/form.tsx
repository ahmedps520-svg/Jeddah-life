"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/providers/app-state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { FieldErrors } from "@/lib/admin/types";
import { inputClass, textareaClass } from "./ui";

/* ------------------------------------------------------------------ */
/* Requests                                                             */
/* ------------------------------------------------------------------ */

export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; fields: FieldErrors };

/** JSON request to an admin API route; never throws. */
export async function adminRequest<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH" | "DELETE", payload?: unknown): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: res.status,
      code: typeof data.error === "string" ? data.error : "generic",
      fields: (data.fields as FieldErrors) ?? {},
    };
  } catch {
    return { ok: false, status: 0, code: "generic", fields: {} };
  }
}

/** Localised message for an error code returned by the admin API. */
export function useErrorText() {
  const { t } = useI18n();
  const map = t.admin.errors as Record<string, string>;
  return (code?: string | null) => (code ? (map[code] ?? map.invalid) : undefined);
}

/** Toast for a failed request (field errors are shown inline instead). */
export function useFailToast() {
  const toast = useToast();
  const err = useErrorText();
  const { t } = useI18n();
  return (r: { code: string; fields: FieldErrors }) => {
    if (Object.keys(r.fields).length) toast(t.admin.common.errorsTitle, { tone: "error" });
    else toast((t.admin.errors as Record<string, string>)[r.code] ?? err("generic")!, { tone: "error" });
  };
}

/* ------------------------------------------------------------------ */
/* Fields                                                               */
/* ------------------------------------------------------------------ */

export const fieldId = (name: string) => `f-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;

type Control = { id: string; "aria-invalid"?: true; "aria-describedby"?: string; "aria-required"?: true };

export function Field({
  name,
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: Control) => ReactNode;
}) {
  const { t } = useI18n();
  const id = fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 flex items-baseline gap-1.5 text-sm font-medium text-ink-800">
        {label}
        {required && (
          <span className="text-coral-500" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">({t.admin.common.required})</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": required ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1 text-[13px] font-medium text-coral-500">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { name: string; label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string };

export function TextField({
  value,
  onChange,
  type = "text",
  dir,
  placeholder,
  inputMode,
  maxLength,
  autoComplete = "off",
  ...f
}: Common & {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dir?: "ltr" | "rtl" | "auto";
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <Field {...f}>
      {(c) => (
        <input
          {...c}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className={inputClass}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  value,
  onChange,
  dir,
  rows = 4,
  maxLength,
  placeholder,
  ...f
}: Common & { value: string; onChange: (v: string) => void; dir?: "ltr" | "rtl" | "auto"; rows?: number; maxLength?: number; placeholder?: string }) {
  return (
    <Field {...f}>
      {(c) => (
        <textarea
          {...c}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className={textareaClass}
        />
      )}
    </Field>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  ...f
}: Common & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field {...f}>
      {(c) => (
        <select {...c} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Group of toggle chips for multi-select vocabularies. */
export function ChipGroup({
  legend,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  legend: string;
  options: { value: string; label: string; color?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-800">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
                on ? "bg-ink-900 text-white" : "bg-white text-ink-700 ring-1 ring-sand-300 hover:ring-ink-300"
              }`}
            >
              {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} aria-hidden />}
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
      {error && <p className="mt-1 text-[13px] font-medium text-coral-500">{error}</p>}
    </fieldset>
  );
}

/** Lists every field error with links to the fields, announced to screen readers. */
export function ErrorSummary({ errors, labels }: { errors: FieldErrors; labels: Record<string, string> }) {
  const { t } = useI18n();
  const err = useErrorText();
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-coral-400/50 bg-coral-400/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-coral-500">
        <AlertCircle className="size-4" aria-hidden />
        {t.admin.common.errorsTitle}
      </p>
      <ul className="mt-2 list-disc space-y-1 ps-6 text-ink-800">
        {keys.map((k) => (
          <li key={k}>
            <a href={`#${fieldId(k)}`} className="underline decoration-coral-400/60 underline-offset-2 hover:decoration-coral-500">
              {labels[k] ?? labels[k.split(".")[0]] ?? k}
            </a>
            : {err(errors[k])}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Confirmation dialog for consequential actions. Optionally asks for a note
 * (required or not) and/or a typed confirmation word.
 */
export function ConfirmDialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  note?: { label: string; hint?: string; required?: boolean };
  typeWord?: string;
  busy?: boolean;
  error?: string;
  onConfirm: (note: string) => void;
}) {
  const titleId = `confirm-${props.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 24)}-${props.confirmLabel.length}`;
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} labelledBy={titleId} size="sm">
      {/* Mounted only while open so the note and typed text reset every time. */}
      {props.open && <ConfirmBody {...props} idBase={titleId} />}
    </Sheet>
  );
}

function ConfirmBody({
  onClose,
  children,
  confirmLabel,
  tone = "primary",
  note,
  typeWord,
  busy,
  error,
  onConfirm,
  idBase,
}: Parameters<typeof ConfirmDialog>[0] & { idBase: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const ready = (!note?.required || text.trim().length > 0) && (!typeWord || typed.trim() === typeWord);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onConfirm(text.trim());
      }}
    >
      {children && <div className="text-[15px] text-ink-700">{children}</div>}
      {note && (
        <TextAreaField name={`${idBase}-note`} label={note.label} hint={note.hint} required={note.required} value={text} onChange={setText} rows={3} maxLength={500} />
      )}
      {typeWord && (
        <TextField name={`${idBase}-typed`} label={t.admin.common.typeToConfirm.replace("{word}", typeWord)} value={typed} onChange={setTyped} dir="ltr" />
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-coral-500">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-sand-200 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          {t.admin.common.cancel}
        </Button>
        <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} disabled={!ready || busy}>
          {busy ? t.admin.common.working : confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Button that posts an admin action, optionally after a confirmation, then
 * refreshes the server-rendered page.
 */
export function ActionButton({
  url,
  method = "POST",
  payload,
  label,
  done,
  confirm,
  variant = "secondary",
  size = "sm",
  icon,
  onDone,
}: {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  payload?: unknown;
  label: string;
  done?: string;
  confirm?: { title: string; body?: ReactNode; label?: string; tone?: "primary" | "danger" };
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md";
  icon?: ReactNode;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const fail = useFailToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setBusy(true);
    const r = await adminRequest(url, method, payload);
    setBusy(false);
    if (!r.ok) return fail(r);
    setOpen(false);
    if (done) toast(done);
    onDone?.();
    router.refresh();
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={busy} onClick={() => (confirm ? setOpen(true) : run())}>
        {icon}
        {label}
      </Button>
      {confirm && (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          confirmLabel={confirm.label ?? label}
          tone={confirm.tone}
          busy={busy}
          onConfirm={run}
        >
          {confirm.body}
        </ConfirmDialog>
      )}
    </>
  );
}
