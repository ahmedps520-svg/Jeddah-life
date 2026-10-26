import { categoryDef } from "@/lib/taxonomy";

/**
 * Designed cover for places without a licensed photo. It is deliberately
 * abstract (colour field + geometric motif) so it can never be mistaken
 * for a photo of the place.
 */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r} ${g} ${b})`;
}

function Motif({ kind, seed }: { kind: string; seed: number }) {
  const o = (seed % 7) * 6;
  const stroke = { fill: "none", stroke: "rgb(255 255 255 / 0.22)", strokeWidth: 1.4 } as const;
  switch (kind) {
    case "waves":
      return (
        <g {...stroke}>
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M-20 ${30 + i * 14 + o / 3} q 25 -12 50 0 t 50 0 t 50 0 t 50 0 t 50 0`} />
          ))}
        </g>
      );
    case "steam":
      return (
        <g {...stroke}>
          {Array.from({ length: 5 }, (_, i) => (
            <path key={i} d={`M${40 + i * 30 + o} 160 c -14 -22 14 -34 0 -56 s 14 -34 0 -56`} />
          ))}
          <circle cx={160 - o} cy="40" r="22" />
        </g>
      );
    case "rings":
      return (
        <g {...stroke}>
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} cx={150 - o} cy={50 + o / 2} r={14 + i * 16} />
          ))}
        </g>
      );
    case "grid":
      return (
        <g {...stroke}>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`v${i}`} d={`M${i * 28 + (o % 28)} 0 V200`} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`h${i}`} d={`M0 ${i * 28 + (o % 28)} H200`} />
          ))}
        </g>
      );
    case "dots":
      return (
        <g fill="rgb(255 255 255 / 0.22)">
          {Array.from({ length: 64 }, (_, i) => (
            <circle key={i} cx={(i % 8) * 26 + 12 + (Math.floor(i / 8) % 2) * 13} cy={Math.floor(i / 8) * 26 + 12} r={(i + seed) % 5 === 0 ? 4 : 2} />
          ))}
        </g>
      );
    case "peaks":
      return (
        <g {...stroke}>
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M-10 ${180 - i * 18} L ${40 + o} ${110 - i * 18} L ${90 + o} ${150 - i * 18} L ${140 + o} ${90 - i * 18} L 210 ${160 - i * 18}`} />
          ))}
        </g>
      );
    case "stripes":
      return (
        <g {...stroke}>
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${i * 18 - 60 + o} 200 L ${i * 18 + 60 + o} 0`} />
          ))}
        </g>
      );
    case "lattice":
      // Inspired by the geometry of carved wooden window screens, kept abstract.
      return (
        <g {...stroke}>
          {Array.from({ length: 7 }, (_, r) =>
            Array.from({ length: 7 }, (_, c) => (
              <path
                key={`${r}-${c}`}
                d={`M${c * 30 + 15} ${r * 30} l15 15 l-15 15 l-15 -15 z`}
                transform={`translate(${(o % 30) - 15} 0)`}
              />
            )),
          )}
        </g>
      );
    case "moon":
      return (
        <g>
          <circle cx={145 - o} cy="55" r="26" fill="rgb(255 255 255 / 0.25)" />
          <circle cx={156 - o} cy="48" r="24" fill="currentColor" />
          <g fill="rgb(255 255 255 / 0.35)">
            {Array.from({ length: 18 }, (_, i) => (
              <circle key={i} cx={(i * 47 + seed) % 200} cy={(i * 31 + seed) % 120 + 70} r={i % 4 === 0 ? 1.6 : 0.9} />
            ))}
          </g>
        </g>
      );
    case "stars":
      return (
        <g fill="rgb(255 255 255 / 0.25)">
          {Array.from({ length: 22 }, (_, i) => {
            const x = (i * 53 + seed) % 200;
            const y = (i * 37 + seed * 3) % 200;
            const s = i % 3 === 0 ? 6 : 3;
            return <path key={i} d={`M${x} ${y - s} L${x + s / 3} ${y} L${x} ${y + s} L${x - s / 3} ${y} Z M${x - s} ${y} L${x} ${y + s / 3} L${x + s} ${y} L${x} ${y - s / 3} Z`} />;
          })}
        </g>
      );
    case "leaf":
      return (
        <g {...stroke}>
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${20 + i * 32} 190 C ${i * 32 - 10} ${120 - o} ${50 + i * 32} ${80 - o} ${20 + i * 32} 20`} />
          ))}
        </g>
      );
    default:
      return (
        <g {...stroke}>
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M-20 ${200 - i * 8} A ${120 + i * 16} ${120 + i * 16} 0 0 1 ${220} ${200 - i * 8}`} />
          ))}
        </g>
      );
  }
}

export function CoverArt({
  seed,
  category,
  initial,
  className = "",
}: {
  seed: string;
  category: string;
  /** Large faint initial so neighbouring covers don't look identical */
  initial?: string | null;
  className?: string;
}) {
  const def = categoryDef(category);
  const h = hash(seed);
  const tint = ((h >> 3) % 25) - 12;
  const from = shade(def.color, 18 + tint);
  const to = shade(def.color, -28 + tint);
  const angle = (h % 4) * 90;
  const id = `g${h.toString(36)}`;
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className={className} style={{ color: def.color }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id})`} />
      <g transform={`rotate(${angle} 100 100)`}>
        <Motif kind={def.motif} seed={h % 97} />
      </g>
      {initial && (
        <text
          x="186"
          y="186"
          textAnchor="end"
          fontSize="120"
          fontFamily="var(--font-display)"
          fontWeight="600"
          fill="rgb(255 255 255 / 0.14)"
        >
          {[...initial.trim()][0]?.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
