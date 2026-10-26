import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/auth-form";
import { LogoMark } from "@/components/layout/logo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.auth.signIn, robots: { index: false } };
}

export default async function Page({ searchParams }: PageProps<"/[lang]/auth/sign-in">) {
  const { t, locale } = await getDictionary();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next && next.startsWith(`/${locale}/`) ? next : `/${locale}`);
  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <LogoMark className="size-12" />
      <h1 className="mt-5 font-display text-[34px] font-semibold leading-tight">{t.auth.welcomeBack}</h1>
      <p className="mt-2 text-ink-500">{t.auth.signInLede}</p>
      <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
        <AuthForm mode="sign-in" next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-500">{t.auth.browseWithout}</p>
    </div>
  );
}
