"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const C1 = "var(--d-chart-1)";
const C2 = "var(--d-chart-2)";
const C3 = "var(--d-chart-3)";
const GRID = "var(--d-border)";
const MUTED = "var(--d-muted)";
const TEXT = "var(--d-text)";

/** KPI mini bars: 7 days, today highlighted. */
export function SparkBars({ data }: { data: readonly number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.82;
  return (
    <div className="flex h-9 items-end gap-[5px]" aria-hidden>
      {data.map((v, i) => {
        const h = 22 + ((v - min) / (max - min || 1)) * 78;
        const last = i === data.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: i * 0.04, duration: 0.5 }}
            className="flex-1 rounded-t-[3px]"
            style={{ background: C1, opacity: last ? 1 : 0.25 + (i / data.length) * 0.45 }}
          />
        );
      })}
    </div>
  );
}

function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Rescue rate line with area wash, a baseline line and a hover crosshair. */
export function RescueLine({ data, baseline, labels }: { data: number[]; baseline: number; labels: string[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 720;
  const H = 240;
  const L = 36;
  const R = 16;
  const T = 12;
  const B = 28;
  const lo = 15;
  const hiV = 40;
  const x = (i: number) => L + (i / (data.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hiV - lo)) * (H - T - B);
  const pts = data.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Rescue rate over time, latest ${data.at(-1)}% vs ${baseline}% baseline`}
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHi(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
        }}
      >
        {[20, 30, 40].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={0} y={y(t) + 4} fontSize="11" fill={MUTED}>
              {t}%
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(baseline)} y2={y(baseline)} stroke={C2} strokeWidth={2} />
        <text x={W - R} y={y(baseline) + 16} fontSize="11" fill={MUTED} textAnchor="end">
          Industry baseline {baseline}%
        </text>
        <path d={area} fill={C1} opacity={0.1} />
        <motion.path
          key={data.join()}
          d={line}
          fill="none"
          stroke={C1}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={5} fill={C1} stroke="var(--d-surface)" strokeWidth={2} />
        <text x={pts.at(-1)![0] - 8} y={pts.at(-1)![1] - 12} fontSize="12" fill={TEXT} textAnchor="end">
          {data.at(-1)}%
        </text>
        {labels.map((lb, i) =>
          i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} fontSize="11" fill={MUTED} textAnchor="middle">
              {lb}
            </text>
          ) : null,
        )}
        {hi != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke={GRID} />
            <circle cx={x(hi)} cy={y(data[hi])} r={5} fill={C1} stroke="var(--d-surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hi != null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-[var(--d-border)] bg-[var(--d-surface)] px-3 py-2 text-[12px] shadow-[var(--d-shadow)]"
          style={{ left: `${(x(hi) / W) * 100}%` }}
        >
          <div className="font-semibold">{labels[hi]}</div>
          <div className="d-text2">
            Rescued {data[hi]}% · baseline {baseline}%
          </div>
        </div>
      )}
    </div>
  );
}

/** Donut with 2px gaps between segments and a centre figure. */
export function Donut({ parts, center, sub }: { parts: { label: string; value: number }[]; center: string; sub: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const colors = [C1, C2, C3];
  const R = 78;
  const SW = 22;
  const C = 2 * Math.PI * R;
  const total = parts.reduce((a, p) => a + p.value, 0);
  const lens = parts.map((p) => (p.value / total) * C);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="relative mx-auto w-[210px]">
      <svg viewBox="0 0 200 200" className="w-full -rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}%`).join(", ")}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--d-chart-track)" strokeWidth={SW} />
        {parts.map((p, i) => (
            <motion.circle
              key={p.label}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={colors[i]}
              strokeWidth={hi === i ? SW + 4 : SW}
              strokeDasharray={`${Math.max(0, lens[i] - 3)} ${C}`}
              strokeDashoffset={-offsets[i]}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.12 }}
              onMouseEnter={() => setHi(i)}
              onMouseLeave={() => setHi(null)}
            />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="d-num text-[34px] leading-none">{hi != null ? `${parts[hi].value}%` : center}</div>
        <div className="mt-1.5 d-overline">{hi != null ? parts[hi].label : sub}</div>
      </div>
    </div>
  );
}

export function LegendRows({ parts }: { parts: { label: string; value: number }[] }) {
  const colors = [C1, C2, C3];
  return (
    <ul className="space-y-2.5 text-[14px]">
      {parts.map((p, i) => (
        <li key={p.label} className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full" style={{ background: colors[i] }} aria-hidden />
            {p.label}
          </span>
          <span className="font-semibold tabular-nums">{p.value}%</span>
        </li>
      ))}
    </ul>
  );
}

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
