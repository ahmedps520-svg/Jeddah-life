import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { planParticipants } from "@/lib/db/schema";
import { getCatalog } from "@/lib/places/catalog";
import { fmt, formatNumber } from "@/lib/i18n/format";
import {
  currentParticipant,
  normalizeCode,
  planByCode,
  planState,
} from "@/lib/together";
import { JoinPlan } from "@/components/together/start-forms";
import { PlanRoom } from "@/components/together/plan-room";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  // Plans are private to the people with the code.
  return { title: t.together.title, robots: { index: false, follow: false } };
}

export default async function PlanTogetherRoom({
  params,
}: PageProps<"/[lang]/together/[code]">) {
  const { t, locale } = await getDictionary();
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  if (!code) notFound();
  if (code !== raw) redirect(`/${locale}/together/${code}`);
  const plan = await planByCode(code);
  if (!plan) notFound();
  const user = await getCurrentUser();
  const me = await currentParticipant(plan, user);

  if (me) {
    const state = await planState(await getCatalog(), plan, me);
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <PlanRoom initial={state} />
      </div>
    );
  }

  const count = (
    await db
      .select({ id: planParticipants.id })
      .from(planParticipants)
      .where(eq(planParticipants.planId, plan.id))
  ).length;
  return (
    <div className="mx-auto max-w-lg px-4 py-12 md:py-16">
      <div className="rounded-3xl bg-white p-6 text-center shadow-card md:p-8">
        <Users className="mx-auto size-10 text-sea-500" />
        <h1
          className="mt-4 font-display text-[28px] font-semibold leading-tight"
          dir="auto"
        >
          {fmt(t.together.joinTitle, { title: plan.title })}
        </h1>
        {plan.status === "cancelled" ? (
          <p className="mt-3 text-ink-600">{t.together.cancelledNote}</p>
        ) : (
          <>
            <p className="mt-3 text-ink-600">
              {fmt(t.together.joinLede, { n: formatNumber(locale, count) })}
            </p>
            <div className="mt-6 text-start">
              <JoinPlan code={plan.code} />
            </div>
            {!user && (
              <p className="mt-5 text-sm text-ink-500">
                <Link
                  href={`/${locale}/auth/sign-in?next=/${locale}/together/${plan.code}`}
                  className="text-sea-600 hover:underline"
                >
                  {t.together.orSignIn}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
