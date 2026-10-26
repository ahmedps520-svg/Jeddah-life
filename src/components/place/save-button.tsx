"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useSaved, useToast } from "@/components/providers/app-state";

export function SaveButton({
  placeId,
  variant = "overlay",
  className = "",
}: {
  placeId: string;
  variant?: "overlay" | "pill" | "icon";
  className?: string;
}) {
  const { t } = useI18n();
  const { isSaved, toggle } = useSaved();
  const toast = useToast();
  const [pop, setPop] = useState(false);
  const saved = isSaved(placeId);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = await toggle(placeId);
    if (result === true) {
      setPop(true);
      setTimeout(() => setPop(false), 400);
      toast(t.common.saved);
    }
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-medium transition active:scale-[0.98] ${
          saved ? "bg-coral-500 text-white" : "bg-white text-ink-900 ring-1 ring-sand-300 hover:ring-ink-300"
        } ${className}`}
      >
        <Heart className={`size-[18px] ${saved ? "fill-current" : ""} ${pop ? "animate-pop" : ""}`} />
        {saved ? t.common.saved : t.common.save}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? t.common.unsave : t.common.save}
      className={`grid size-9 place-items-center rounded-full transition active:scale-90 ${
        variant === "overlay" ? "bg-ink-950/35 text-white backdrop-blur-md hover:bg-ink-950/55" : "text-ink-500 hover:bg-sand-200"
      } ${className}`}
    >
      <Heart className={`size-[18px] ${saved ? "fill-coral-400 text-coral-400" : ""} ${pop ? "animate-pop" : ""}`} />
    </button>
  );
}
