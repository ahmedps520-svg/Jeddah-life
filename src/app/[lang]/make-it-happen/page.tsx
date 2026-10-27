import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { MakeItHappen } from "@/components/planner/make-it-happen";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.mih.title, description: t.mih.lede };
}

export default async function MakeItHappenPage() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-[40px] font-semibold leading-tight md:text-[52px]">{t.mih.title}</h1>
        <p className="mt-3 text-lg text-ink-600">{t.mih.lede}</p>
      </header>
      <MakeItHappen />
    </div>
  );
}
