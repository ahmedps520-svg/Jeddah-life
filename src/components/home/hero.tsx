"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Pause, Play } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { buttonClass } from "@/components/ui/button";

export type HeroSlide = {
  id: string;
  theme: string;
  title: string;
  subtitle: string | null;
  href: string;
  image: { url: string; author?: string | null; license?: string | null; sourceUrl?: string | null };
};

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function prefersReducedMotion() {
  return window.matchMedia(REDUCE).matches;
}

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const { t, locale, dir } = useI18n();
  const [i, setI] = useState(0);
  const [userPaused, setPaused] = useState<boolean | null>(null);
  const [hovering, setHovering] = useState(false);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  // Respect the OS setting until the visitor chooses otherwise; hovering always pauses.
  const stopped = userPaused ?? reduceMotion;
  const paused = stopped || hovering;

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const slide = slides[i];

  return (
    <section
      className="relative isolate overflow-hidden bg-ink-900 text-sand-50"
      aria-roledescription="carousel"
      aria-label={t.brand.tagline}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="relative h-[68vh] min-h-[440px] max-h-[720px]">
        {slides.length > 0 ? (
          slides.map((s, idx) => (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${idx === i ? "opacity-100" : "opacity-0"}`}
              aria-hidden={idx !== i}
            >
              <Image
                src={s.image.url}
                alt=""
                fill
                priority={idx === 0}
                sizes="100vw"
                className={`object-cover ${idx === i ? "scale-105" : "scale-100"} transition-transform duration-[8000ms] ease-out`}
              />
            </div>
          ))
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_10%,#1c3550_0%,#0b1b2b_55%,#06111c_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/35 to-ink-950/10" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-10 md:px-6 md:pb-14">
          {slide && (
            <p key={`k${slide.id}`} className="mb-3 animate-fade-up text-xs font-semibold uppercase tracking-[0.2em] text-coral-400">
              {slide.theme}
            </p>
          )}
          <h1 key={`t${slide?.id}`} className="max-w-3xl animate-fade-up font-display text-[40px] font-semibold leading-[1.05] md:text-[64px]">
            {slide?.title ?? t.brand.tagline}
          </h1>
          <p key={`s${slide?.id}`} className="mt-4 max-w-xl animate-fade-up text-[17px] text-sand-200 md:text-lg">
            {slide?.subtitle ?? t.meta.description}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={`/${locale}/explore`} className={buttonClass("primary", "lg")}>
              {t.home.heroCta}
              <Arrow className="size-5" />
            </Link>
            {slide && slide.href !== "/explore" && (
              <Link href={`/${locale}${slide.href}`} className={buttonClass("outline-light", "lg")}>
                {t.common.viewDetails}
              </Link>
            )}
          </div>

          {slides.length > 1 && (
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPaused(!stopped)}
                className="grid size-8 place-items-center rounded-full ring-1 ring-white/30 hover:bg-white/10"
                aria-label={stopped ? t.home.play : t.home.pause}
              >
                {stopped ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
              <div className="flex gap-1.5" role="tablist">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === i}
                    aria-label={s.theme}
                    onClick={() => setI(idx)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${idx === i ? "w-8 bg-sand-50" : "w-3 bg-white/40 hover:bg-white/70"}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {slide?.image.author && (
          <a
            href={slide.image.sourceUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 end-3 text-[10px] text-white/60 hover:text-white"
          >
            {t.home.photoBy.replace("{author}", slide.image.author)}
            {slide.image.license ? ` · ${slide.image.license}` : ""}
          </a>
        )}
      </div>
    </section>
  );
}
