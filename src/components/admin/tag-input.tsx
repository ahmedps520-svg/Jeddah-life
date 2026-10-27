"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { fieldId } from "./form";
import { inputClass } from "./ui";

/** Free-text tags: type and press Enter (or comma) to add; each chip has a remove button. */
export function TagInput({ name, label, hint, value, onChange, error }: { name: string; label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const id = fieldId(name);

  const add = () => {
    const parts = draft
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < 25) next.push(p.slice(0, 40));
    onChange(next);
    setDraft("");
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-800">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-sea-50 py-1 ps-3 pe-1 text-sm text-sea-700 ring-1 ring-sea-100">
              <bdi>{tag}</bdi>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== tag))}
                className="grid size-6 place-items-center rounded-full hover:bg-sea-100"
                aria-label={t.admin.places.tagRemove.replace("{tag}", tag)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          maxLength={200}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
        <button type="button" onClick={add} className="h-11 shrink-0 rounded-xl px-4 text-sm font-medium ring-1 ring-sand-300 hover:bg-sand-100">
          {t.admin.places.tagAdd}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && <p className="mt-1 text-[13px] font-medium text-coral-500">{error}</p>}
    </div>
  );
}
