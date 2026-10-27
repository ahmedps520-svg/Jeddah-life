"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button, buttonClass } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <AlertTriangle className="mx-auto size-12 text-coral-500" />
      <h1 className="mt-5 font-display text-[34px] font-semibold leading-tight">{t.errors.serverTitle}</h1>
      <p className="mt-3 text-ink-600">{t.errors.serverLede}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>{t.common.retry}</Button>
        <Link href={`/${locale}`} className={buttonClass("secondary")}>
          {t.errors.goHome}
        </Link>
      </div>
    </div>
  );
}
