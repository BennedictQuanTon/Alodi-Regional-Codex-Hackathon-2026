"use client";

import { fmtClock } from "@/lib/demo/scenarios";

export function PhoneFrame({
  children,
  clock,
  dark = false,
  className = "",
}: {
  children: React.ReactNode;
  clock: number;
  dark?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative h-[704px] w-[340px] rounded-[52px] bg-[#0f1424] p-[9px] shadow-[0_40px_80px_-40px_rgba(18,26,44,0.55),0_0_0_1px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-[44px] bg-white">
        <div className={`absolute inset-x-0 top-0 z-30 flex h-12 items-center justify-between px-8 text-[13px] font-semibold ${dark ? "text-white" : "text-[var(--ui-ink)]"}`}>
          <span className="tabular-nums">{fmtClock(clock)}</span>
          <span className="absolute left-1/2 top-2.5 h-[28px] w-[98px] -translate-x-1/2 rounded-full bg-[#0f1424]" />
          <span className="flex items-center gap-1.5 text-[11px]">
            5G
            <span className="inline-block h-[10px] w-[20px] rounded-[3px] border border-current p-[1px]">
              <span className="block h-full w-[70%] rounded-[1px] bg-current" />
            </span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Waveform({ active = true, bars = 28, className = "" }: { active?: boolean; bars?: number; className?: string }) {
  return (
    <div className={`flex h-10 items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-current ${active ? "wave-bar" : ""}`}
          style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 7) * 0.11}s`, transform: active ? undefined : "scaleY(0.2)" }}
        />
      ))}
    </div>
  );
}

export function Conf({ value }: { value: number | null }) {
  if (value == null) return <span className="ui-muted">—</span>;
  const ok = value >= 0.85;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block h-1.5 w-14 overflow-hidden rounded-full bg-[var(--ui-canvas)]">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${value * 100}%`, background: ok ? "var(--ui-good)" : "var(--ui-warn)" }}
        />
      </span>
      <span className="w-8 text-right text-[12px] tabular-nums">{value.toFixed(2)}</span>
    </span>
  );
}
