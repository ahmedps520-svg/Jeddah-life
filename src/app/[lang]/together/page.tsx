import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { myPlans } from "@/lib/together";
import { relativeTime } from "@/lib/i18n/format";
import { CreatePlanForm, JoinCodeForm } from "@/components/together/start-forms";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.together.title, description: t.together.lede };
}

export default async function TogetherPage() {
  const { t, locale } = await getDictionary();
  const user = await getCurrentUser();
  const plans = user ? await myPlans(user.id) : [];
  const status = { planning: t.together.statusPlanning, final: t.together.statusFinal, cancelled: t.together.statusCancelled };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-3 font-display text-[38px] font-semibold leading-tight md:text-[48px]">
          <Users className="size-9 text-sea-500" /> {t.together.title}
        </h1>
        <p className="mt-3 text-lg text-ink-600">{t.together.lede}</p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-card md:p-8" aria-labelledby="start-title">
          <h2 id="start-title" className="font-display text-2xl font-semibold">
            {t.together.start}
          </h2>
          <div className="mt-5">
            {user ? (
              <CreatePlanForm />
            ) : (
              <div className="space-y-4">
                <p className="text-ink-600">{t.together.startSignIn}</p>
                <div className="flex gap-2">
                  <ButtonLink href={`/${locale}/auth/sign-in?next=/${locale}/together`}>{t.auth.signIn}</ButtonLink>
                  <ButtonLink href={`/${locale}/auth/sign-up?next=/${locale}/together`} variant="secondary">
                    {t.auth.signUp}
                  </ButtonLink>
                </div>
              </div>
            )}
          </div>
        </section>
        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-card md:p-8" aria-labelledby="join-title">
            <h2 id="join-title" className="font-display text-2xl font-semibold">
              {t.together.join}
            </h2>
            <div className="mt-4">
              <JoinCodeForm />
            </div>
          </section>
          <section className="rounded-3xl bg-sand-200/60 p-6 md:p-8" aria-labelledby="how-title">
            <h2 id="how-title" className="font-semibold">
              {t.together.howTitle}
            </h2>
            <ol className="mt-3 space-y-2">
              {t.together.how.map((step, i) => (
                <li key={step} className="flex gap-3 text-[15px] text-ink-700">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                    {new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en").format(i + 1)}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {plans.length > 0 && (
        <section className="mt-12" aria-labelledby="mine-title">
          <h2 id="mine-title" className="font-display text-2xl font-semibold">
            {t.together.myPlans}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <li key={p.code}>
                <Link href={`/${locale}/together/${p.code}`} className="block rounded-2xl bg-white p-5 ring-1 ring-sand-200 transition hover:ring-ink-300">
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                    <span>{status[p.status]}</span>
                    {p.role === "organizer" && (
                      <span className="flex items-center gap-1 text-gold-500">
                        <Crown className="size-3.5" /> {t.together.organizer}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate font-display text-lg font-semibold" dir="auto">
                    {p.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {t.together.updated} {relativeTime(locale, p.updatedAt)} · <span className="font-mono" dir="ltr">{p.code}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
