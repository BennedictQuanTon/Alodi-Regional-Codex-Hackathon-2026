"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const C1 = "var(--d-chart-1)";
const C2 = "var(--d-chart-2)";
const C3 = "var(--d-chart-3)";
const GRID = "var(--d-border)";
const MUTED = "var(--d-muted)";
const TEXT = "var(--d-text)";

/** Paired horizontal bars (baseline vs current) per field. */
export function PairedBars({ rows }: { rows: { k: string; a: number; b: number }[] }) {
  return (
    <div className="space-y-5">
      {rows.map((r, i) => (
        <div key={r.k} className="grid grid-cols-[120px_1fr] items-center gap-4">
          <span className="text-[14px]">{r.k}</span>
          <div className="space-y-1.5">
            {[
              { v: r.a, c: C2 },
              { v: r.b, c: C1 },
            ].map((bar, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--d-chart-track)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: bar.c }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${bar.v * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + j * 0.1, duration: 0.7 }}
                  />
                </div>
                <span className={`w-10 text-right text-[13px] tabular-nums ${j ? "font-semibold" : "d-muted"}`}>{bar.v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Two-series line over eval iterations. */
export function IterLine({ rows }: { rows: { v: string; dev: number; held: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 560;
  const H = 230;
  const L = 36;
  const B = 26;
  const x = (i: number) => L + (i / (rows.length - 1)) * (W - L - 44);
  const y = (v: number) => H - B - ((v - 0.5) / 0.5) * (H - B - 12);
  const path = (k: "dev" | "held") => rows.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[k])}`).join(" ");
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Mean F1 across optimisation rounds"
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHi(Math.max(0, Math.min(rows.length - 1, Math.round(((px - L) / (W - L - 44)) * (rows.length - 1)))));
        }}
      >
        {[0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 30} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={0} y={y(t) + 4} fontSize="11" fill={MUTED}>
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {rows.map((p, i) => (
          <text key={p.v} x={x(i)} y={H - 6} fontSize="11" fill={MUTED} textAnchor="middle">
            {p.v}
          </text>
        ))}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={8} y2={H - B} stroke={GRID} />}
        <path d={path("dev")} fill="none" stroke={C2} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("held")} fill="none" stroke={C1} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(rows.length - 1)} cy={y(rows.at(-1)!.held)} r={5} fill={C1} stroke="var(--d-surface)" strokeWidth={2} />
        <text x={x(rows.length - 1) + 8} y={y(rows.at(-1)!.held) + 16} fontSize="12" fill={TEXT}>
          {rows.at(-1)!.held.toFixed(2)}
        </text>
        {hi != null && (
          <>
            <circle cx={x(hi)} cy={y(rows[hi].dev)} r={4.5} fill={C2} stroke="var(--d-surface)" strokeWidth={2} />
            <circle cx={x(hi)} cy={y(rows[hi].held)} r={4.5} fill={C1} stroke="var(--d-surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hi != null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)] px-3 py-2 text-[12px] shadow-[var(--d-shadow)]"
          style={{ left: `${(x(hi) / W) * 100}%` }}
        >
          <div className="font-semibold">{rows[hi].v}</div>
          <div className="d-text2">
            dev {rows[hi].dev.toFixed(2)} · held-out {rows[hi].held.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: "c1" | "c2" | "c3" }[] }) {
  const map = { c1: C1, c2: C2, c3: C3 };
  return (
    <div className="flex flex-wrap gap-4 text-[12px] d-text2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-2">
          <span className="h-[3px] w-4 rounded-full" style={{ background: map[it.color] }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Counts every number inside a value string ("812", "61%", "0.88", "4 s") up from zero on mount. */
export function CountUp({ value }: { value: string }) {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, 1, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setP });
    return () => c.stop();
  }, [reduce, value]);
  const prog = reduce ? 1 : p;
  return (
    <span aria-label={value}>
      {value.replace(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g, (m) => {
        const dec = m.includes(".") ? m.split(".")[1].length : 0;
        const n = parseFloat(m.replace(/,/g, "")) * prog;
        return m.includes(",") ? Math.round(n).toLocaleString("en-US") : dec ? n.toFixed(dec) : String(Math.round(n));
      })}
    </span>
  );
}
