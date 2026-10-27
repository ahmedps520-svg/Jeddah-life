import Link from "next/link";
import { Compass } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { buttonClass } from "@/components/ui/button";

export default async function NotFound() {
  const { t, locale } = await getDictionary();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <Compass className="mx-auto size-12 text-sea-500" />
      <h1 className="mt-5 font-display text-[34px] font-semibold leading-tight">{t.errors.notFoundTitle}</h1>
      <p className="mt-3 text-ink-600">{t.errors.notFoundLede}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href={`/${locale}`} className={buttonClass("primary")}>
          {t.errors.goHome}
        </Link>
        <Link href={`/${locale}/explore`} className={buttonClass("secondary")}>
          {t.nav.explore}
        </Link>
      </div>
    </div>
  );
}
