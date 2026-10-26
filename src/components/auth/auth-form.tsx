"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { signInAction, signUpAction, type AuthState } from "@/lib/actions/auth";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "sign-in" ? signInAction : signUpAction, undefined);
  const error =
    state?.error === "taken"
      ? t.auth.emailTaken
      : state?.error === "rate"
        ? t.auth.rateLimited
        : state?.error === "invalid"
          ? t.auth.invalidCredentials
          : state?.error === "validation"
            ? t.auth.passwordHint
            : null;
  const input = "h-12 w-full rounded-xl border border-sand-300 bg-white px-4 text-[16px] outline-none transition focus:border-sea-400 focus:ring-2 focus:ring-sea-100";

  return (
    <form action={action} className="space-y-4" noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "sign-up" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t.auth.displayName}</span>
          <input name="displayName" required minLength={2} maxLength={40} autoComplete="name" defaultValue={state?.fields?.displayName} className={input} />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.auth.email}</span>
        <input name="email" type="email" required autoComplete="email" dir="ltr" defaultValue={state?.fields?.email} className={input} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t.auth.password}</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "sign-up" ? 8 : 1}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          dir="ltr"
          className={input}
        />
        {mode === "sign-up" && <span className="mt-1 block text-xs text-ink-500">{t.auth.passwordHint}</span>}
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm text-coral-500">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {mode === "sign-in" ? t.auth.signIn : t.auth.signUp}
      </Button>
      {mode === "sign-up" && <p className="text-xs text-ink-500">{t.auth.terms}</p>}
      <p className="text-center text-sm text-ink-600">
        {mode === "sign-in" ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link
          href={`/${locale}/auth/${mode === "sign-in" ? "sign-up" : "sign-in"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-sea-600 hover:underline"
        >
          {mode === "sign-in" ? t.auth.signUp : t.auth.signIn}
        </Link>
      </p>
    </form>
  );
}
