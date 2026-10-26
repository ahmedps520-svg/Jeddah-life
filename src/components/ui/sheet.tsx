"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";

/**
 * Accessible modal built on <dialog>: focus is trapped, Esc closes it and
 * the page behind is inert. It slides up as a bottom sheet on phones and
 * appears as a centred panel on larger screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = size === "sm" ? "md:max-w-md" : size === "lg" ? "md:max-w-3xl" : "md:max-w-xl";

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-sand-50 p-0 text-ink-900 shadow-sheet backdrop:bg-ink-950/50 backdrop:backdrop-blur-[2px] open:flex open:animate-sheet-up open:flex-col md:m-auto md:max-h-[85dvh] md:rounded-3xl md:open:animate-fade-up ${width}`}
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-sand-300 md:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-2 md:pt-5">
        {title ? (
          <h2 id={labelledBy} className="font-display text-xl font-semibold">
            {title}
          </h2>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="-me-2 rounded-full p-2 text-ink-500 transition hover:bg-sand-200 hover:text-ink-900"
          aria-label={t.common.close}
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer && <div className="border-t border-sand-200 bg-sand-50 px-5 py-4 safe-bottom">{footer}</div>}
    </dialog>
  );
}
