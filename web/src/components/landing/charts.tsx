"use client";

import { useState } from "react";
import { AREA_DAY, BOM_RATES, GMV, LOSS_MODEL } from "@/lib/content";
import { useGrow } from "./motion";

const C1 = "var(--chart-1)";
const FONT = { fontFamily: "var(--font-mono)" };
const C2 = "var(--chart-2)";
const C3 = "var(--chart-3)";
const C4 = "var(--color-sky)";
const GRID = "var(--color-ash-soft)";
const AXIS = "var(--color-smoke)";

/** Position as % of the SVG box (the SVG scales with width). */
type Tip = { xPct: number; yPct: number; title: string; body: string } | null;

function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-xl border border-ash bg-paper px-3 py-2 text-[12px] shadow-[0_0_10px_rgba(0,0,0,0.08)]"
      style={{ left: `${tip.xPct}%`, top: `${tip.yPct}%` }}
    >
      <div className="text-navy">{tip.title}</div>
      <div className="text-smoke">{tip.body}</div>
    </div>
  );
}

/** Bar with a 4px rounded data end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (w <= 0) return "";
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

function colPath(x: number, base: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  const top = base - h;
  return `M${x},${base} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${base} Z`;
}

// 1 · Refusal rates: range bars (from → to)
export function BomRateChart() {
  const { ref, p } = useGrow();
  const [tip, setTip] = useState<Tip>(null);
  const W = 560;
  const L = 150;
  const R = 70;
  const rowH = 52;
  const H = BOM_RATES.length * rowH + 36;
  const x = (v: number) => L + (v / 30) * (W - L - R);
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={FONT} role="img" aria-label="Share of refused orders by context">
        {[0, 10, 20, 30].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={6} y2={H - 26} stroke={GRID} />
            <text x={x(t)} y={H - 8} fontSize="11" fill={AXIS} textAnchor="middle">
              {t}%
            </text>
          </g>
        ))}
        {BOM_RATES.map((r, i) => {
          const y = 14 + i * rowH;
          const x0 = x(r.from);
          const w = (x(r.to) - x0) * p;
          const hi = i === BOM_RATES.length - 1;
          return (
            <g
              key={r.label}
              onMouseEnter={() =>
                setTip({
                  xPct: ((x0 + w / 2) / W) * 100,
                  yPct: ((y + 4) / H) * 100,
                  title: `${r.label}: ${r.upTo ? "up to " : ""}${r.upTo ? r.to : `${r.from}–${r.to}`}%`,
                  body: r.note,
                })
              }
              onMouseLeave={() => setTip(null)}
            >
              <rect x={0} y={y - 8} width={W} height={rowH - 8} fill="transparent" />
              <text x={0} y={y + 14} fontSize="12" fill="var(--color-navy)">
                {r.label}
              </text>
              <rect x={x0} y={y + 4} width={Math.max(0, w)} height={16} rx={4} fill={hi ? C1 : C2} opacity={r.upTo ? 0.85 : 1} />
              <text x={x0 + w + 8} y={y + 16} fontSize="12" fill="var(--color-navy)" opacity={p}>
                {r.upTo ? `up to ${r.to}%` : `${r.from}–${r.to}%`}
              </text>
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

// 2 · A day in one area (20 couriers, 4,000 orders)
export function DepotDayChart() {
  const { ref, p } = useGrow();
  const W = 560;
  const H = 210;
  const full = W;
  const failW = full * 0.08 * 6; // the failed-order bar is magnified for legibility (noted below)
  const { orders, failed, rescued, returned } = AREA_DAY;
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={FONT} role="img" aria-label={`${n(orders)} orders, ${failed} failed, ${rescued} rescued and ${returned} returned`}>
      <text x={0} y={14} fontSize="12" fill={AXIS}>
        {n(orders)} deliveries in a day
      </text>
      <rect x={0} y={24} width={full * p} height={20} rx={4} fill="var(--color-navy-mist)" />
      <rect x={full * 0.92} y={24} width={full * 0.08 * p} height={20} fill={C1} />
      <text x={full * 0.92 - 8} y={62} fontSize="11" fill={AXIS} textAnchor="end">
        {failed} fail first time (8%)
      </text>

      <path d={`M${full * 0.92},46 L0,92 M${full},46 L${failW},92`} stroke="var(--color-ash)" fill="none" />

      <text x={0} y={86} fontSize="12" fill={AXIS}>
        Of the {failed} failed orders
      </text>
      <path d={barPath(0, 96, failW * 0.25 * p - 1, 34)} fill={C2} />
      <path d={barPath(failW * 0.25 * p + 1, 96, failW * 0.75 * p - 1, 34)} fill={C1} />
      <text x={10} y={118} fontSize="13" fill="var(--color-parchment)" opacity={p}>
        {rescued}
      </text>
      <text x={failW * 0.25 + 12} y={118} fontSize="13" fill="var(--color-ink)" opacity={p}>
        {returned} returned
      </text>
      <text x={0} y={156} fontSize="11" fill="var(--color-graphite)">
        {rescued} delivered on a later attempt (baseline ~25%, industry average per Shipsy)
      </text>
      <text x={0} y={178} fontSize="11" fill="var(--color-orange-deep)">
        Alodi targets the orange part: turn returns into deliveries
      </text>
      <text x={0} y={200} fontSize="10" fill={AXIS}>
        The lower bar is drawn 6× larger than the upper bar for readability.
      </text>
    </svg>
  );
}

// 3 · Monthly loss per area (million VND)
export function LossChart() {
  const { ref, p } = useGrow();
  const [tip, setTip] = useState<Tip>(null);
  const W = 560;
  const L = 52;
  const R = 56;
  const H = 170;
  const { max, ticks } = LOSS_MODEL;
  const x = (v: number) => (v / max) * (W - L - R);
  const colors = [C1, C2, C3, C4];
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={FONT} role="img" aria-label="Monthly loss per area, low 447 and high 499 million dong">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L + x(t)} x2={L + x(t)} y1={8} y2={H - 26} stroke={GRID} />
            <text x={L + x(t)} y={H - 8} fontSize="11" fill={AXIS} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {LOSS_MODEL.rows.map((r, i) => {
          const y = 20 + i * 62;
          let acc = 0;
          return (
            <g key={r.label}>
              <text x={0} y={y + 18} fontSize="12" fill="var(--color-navy)">
                {r.label}
              </text>
              {r.segs.map((v, j) => {
                const x0 = L + x(acc) * p + (j ? 1 : 0);
                const w = x(v) * p - (j ? 2 : 1);
                acc += v;
                const isLast = j === r.segs.length - 1;
                return (
                  <path
                    key={j}
                    d={isLast ? barPath(x0, y, w, 26) : `M${x0},${y} h${Math.max(0, w)} v26 h${-Math.max(0, w)} Z`}
                    fill={colors[j]}
                    onMouseEnter={() =>
                      setTip({ xPct: ((x0 + w / 2) / W) * 100, yPct: (y / H) * 100, title: LOSS_MODEL.legend[j], body: `${r.label}: ${v}M VND` })
                    }
                    onMouseLeave={() => setTip(null)}
                  />
                );
              })}
              <text x={L + x(r.total) * p + 8} y={y + 18} fontSize="13" fill="var(--color-navy)" opacity={p}>
                {r.total}
              </text>
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-graphite">
        {LOSS_MODEL.legend.map((l, i) => (
          <span key={l} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: colors[i] }} aria-hidden />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// 4 · E-commerce scale
export function GmvChart() {
  const { ref, p } = useGrow();
  const W = 300;
  const H = 240;
  const base = 210;
  const max = 480;
  const h = (v: number) => (v / max) * 180;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={FONT} role="img" aria-label="E-commerce sales on 4 marketplaces: about 318.9 trillion dong in 2024 and 429.7 trillion in 2025">
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-ash)" />
      {GMV.map((g, i) => {
        const x = 50 + i * 130;
        const hh = h(g.value) * p;
        return (
          <g key={g.year}>
            <path d={colPath(x, base, 72, hh)} fill={i === 1 ? C1 : C2} />
            <text x={x + 36} y={base - hh - 10} fontSize="15" fill="var(--color-navy)" textAnchor="middle" opacity={p}>
              {g.approx ? "~" : ""}
              {g.value}
            </text>
            <text x={x + 36} y={base + 20} fontSize="12" fill={AXIS} textAnchor="middle">
              {g.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
