import type { Metadata } from "next";
import { Gem } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GemSubmitForm } from "@/components/gems/gem-submit-form";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.gems.submitTitle, robots: { index: false } };
}

export default async function SubmitGemPage() {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
      <header>
        <h1 className="flex items-center gap-3 font-display text-[34px] font-semibold leading-tight md:text-[42px]">
          <Gem className="size-8 text-sea-500" /> {t.gems.submitTitle}
        </h1>
        <p className="mt-3 text-ink-600">{t.gems.submitLede}</p>
        <p className="mt-2 text-sm text-ink-500">{t.gems.notHiddenGemRule}</p>
      </header>
      <div className="mt-8">
        {user ? (
          <GemSubmitForm />
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center shadow-card">
            <p className="text-ink-700">{t.gems.signIn}</p>
            <div className="mt-5 flex justify-center gap-3">
              <ButtonLink href={`/${locale}/auth/sign-in?next=/${locale}/hidden-gems/submit`}>{t.auth.signIn}</ButtonLink>
              <ButtonLink href={`/${locale}/auth/sign-up?next=/${locale}/hidden-gems/submit`} variant="secondary">
                {t.auth.signUp}
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
