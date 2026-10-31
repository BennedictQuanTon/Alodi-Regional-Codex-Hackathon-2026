import Link from "next/link";

/** The three sound bars inside the ring — brand mark C (“one call”). */
function Waves({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <rect x="8.55" y="10.25" width="1.5" height="3.5" rx="0.75" />
      <rect x="11.25" y="8.9" width="1.5" height="6.2" rx="0.75" />
      <rect x="13.95" y="10.25" width="1.5" height="3.5" rx="0.75" />
    </g>
  );
}

/** Orange ring of the "o" — Alodi brand mark C: sound bars = a call. */
export function DropRing({
  size = 24,
  dot = "var(--color-navy)",
  className = "",
}: {
  size?: number;
  dot?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="var(--color-orange)" strokeWidth="5.2" />
      <Waves fill={dot} />
    </svg>
  );
}

/**
 * The only glyph language allowed: the three brand marks from the branding sheet.
 * dot = landing point, check = done, square = parcel, wave = a call.
 */
export function Mark({
  kind = "dot",
  size = 14,
  ring = "currentColor",
  className = "",
}: {
  kind?: "dot" | "check" | "square" | "wave";
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke={ring} strokeWidth="1.6" />
      {kind === "dot" && <circle cx="8" cy="8" r="2" fill={ring} />}
      {kind === "square" && <rect x="6" y="6" width="4" height="4" rx="0.8" fill={ring} />}
      {kind === "wave" && (
        <g fill={ring}>
          <rect x="5.4" y="6.9" width="1.3" height="2.2" rx="0.65" />
          <rect x="7.35" y="5.9" width="1.3" height="4.2" rx="0.65" />
          <rect x="9.3" y="6.9" width="1.3" height="2.2" rx="0.65" />
        </g>
      )}
      {kind === "check" && (
        <path d="M5.4 8.2l1.8 1.8 3.4-3.6" fill="none" stroke={ring} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function Wordmark({ className = "", tone = "navy" }: { className?: string; tone?: "navy" | "light" }) {
  const color = tone === "navy" ? "var(--color-navy)" : "#ffffff";
  return (
    <span
      className={`inline-flex items-baseline font-[family-name:var(--font-logo)] font-extrabold leading-none tracking-[-0.045em] ${className}`}
      style={{ color }}
      aria-label="alodi"
    >
      al
      <span className="relative mx-[0.02em] inline-block w-[0.66em] self-center translate-y-[0.07em]" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-auto w-full">
          <circle cx="12" cy="12" r="8.6" fill="none" stroke="var(--color-orange)" strokeWidth="5.4" />
          <Waves fill={color} />
        </svg>
      </span>
      di
    </span>
  );
}

export function LogoLink({ tone = "navy", size = "text-[32px]" }: { tone?: "navy" | "light"; size?: string }) {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Alodi home">
      <Wordmark className={size} tone={tone} />
    </Link>
  );
}

/** Plain-text attribution. Never numbered markers. */
export function SourceNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[12px] leading-[1.45] text-smoke ${className}`}>Source: {children}</p>;
}

/** Monad eyebrow: plain uppercase mono line above a heading. */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`t-eyebrow text-navy ${className}`}>{children}</div>;
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" className={`shrink-0 ${className}`} aria-hidden>
      <path d="M2.5 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
