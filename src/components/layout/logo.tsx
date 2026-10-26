export function LogoMark({ className = "size-8" }: { className?: string }) {
  // A low sun on the Red Sea horizon: one disc, one horizon line, two swells.
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <clipPath id="jl-sun">
          <rect x="0" y="0" width="40" height="22" />
        </clipPath>
      </defs>
      <circle cx="20" cy="22" r="11" fill="#E8957A" clipPath="url(#jl-sun)" />
      <path d="M5 22.5h30" stroke="#F9F5EE" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 27.5c3.2-2 6.6-2 9.8 0s6.6 2 9.8 0" fill="none" stroke="#63BDB9" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 32.5c2.4-1.5 5-1.5 7.4 0s5 1.5 7.4 0" fill="none" stroke="#63BDB9" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({ locale, className = "" }: { locale: "en" | "ar"; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="size-8 shrink-0" />
      {locale === "ar" ? (
        <span className="font-display text-[22px] font-bold leading-none">جدة لايف</span>
      ) : (
        <span className="font-display text-[19px] font-semibold leading-none tracking-[0.14em]">
          JEDDAH<span className="ms-1.5 font-normal text-coral-400">LIFE</span>
        </span>
      )}
    </span>
  );
}
