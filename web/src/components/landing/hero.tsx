"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Mark } from "@/components/site/brand";
import { SHIPPER_LOGOS, LIVE_DEMO_URL } from "@/lib/content";
import { Reveal, RevealText } from "./motion";

const W = 1440;
const H = 500;
const HUB = { x: 720, y: 236 };
const CH = 9.1; // Geist Mono advance at 15px

const INPUTS: { label: string; kind: "dot" | "check" | "square"; chip: string }[] = [
  { label: "Any order", kind: "square", chip: "EVENT" },
  { label: "No answer", kind: "dot", chip: "TAP A" },
  { label: "Rescheduled", kind: "dot", chip: "TAP B" },
  { label: "Refused", kind: "dot", chip: "REFUSED" },
  { label: "Route planner", kind: "square", chip: "SLOTS" },
  { label: "Voice memo", kind: "dot", chip: "MEMO" },
  { label: "Carrier OMS", kind: "square", chip: "EVENT" },
];
const OUTPUTS = ["Shipper card", "Dispatcher", "CS queue", "Order context", "Metrics log"];

const IN_Y = INPUTS.map((_, i) => 44 + i * 64);
const OUT_Y = OUTPUTS.map((_, i) => 56 + i * 90);

const PETALS = [
  { label: "CHAT", dx: -86, dy: 0 },
  { label: "CALL", dx: 0, dy: -70 },
  { label: "EXTRACT", dx: 86, dy: 0 },
  { label: "GUARD", dx: 0, dy: 70 },
];

function inPath(i: number) {
  const y = IN_Y[i];
  const ey = HUB.y - 18 + i * 6;
  return `M276,${y} L320,${y} C470,${y} 450,${ey} 560,${ey} L600,${ey}`;
}
function outPath(i: number) {
  const y = OUT_Y[i];
  return `M846,${HUB.y} L880,${HUB.y} C1010,${HUB.y} 1000,${y} 1120,${y} L1160,${y}`;
}

function Diamond({ cx, cy, size, fill, stroke, children }: { cx: number; cy: number; size: number; fill: string; stroke: string; children?: React.ReactNode }) {
  return (
    <g>
      <rect
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        rx={14}
        transform={`rotate(45 ${cx} ${cy})`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

function Chip({ label, path, dur, begin, kind, tone }: { label: string; path: string; dur: number; begin: number; kind: "dot" | "check" | "square"; tone: string }) {
  const w = 30 + label.length * 6.2;
  return (
    <g opacity={0}>
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="var(--color-paper)" stroke="var(--color-ash)" />
      <g transform={`translate(${-w / 2 + 7},-6)`} color={tone}>
        <svg width="12" height="12" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          {kind === "dot" && <circle cx="8" cy="8" r="2.2" fill="currentColor" />}
          {kind === "square" && <rect x="5.8" y="5.8" width="4.4" height="4.4" rx="0.8" fill="currentColor" />}
          {kind === "check" && <path d="M5.2 8.2l1.9 1.9 3.6-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
      </g>
      <text x={-w / 2 + 24} y={3.5} fontSize="9" fill="var(--color-smoke)" letterSpacing="0.04em">
        {label}
      </text>
      <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.8;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
    </g>
  );
}

export function PipelineDiagram() {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="hidden w-full md:block"
        role="img"
        aria-label="Failed-delivery events flow into the Alodi agent and its tools and come out as structured context"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <defs>
          <radialGradient id="hubGlow">
            <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ffc999" stopOpacity="0.35" />
            <stop offset="75%" stopColor="#ecda98" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ecda98" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd9bf" />
            <stop offset="100%" stopColor="#ffb48a" />
          </linearGradient>
        </defs>

        <circle cx={HUB.x} cy={HUB.y} r={230} fill="url(#hubGlow)" className={reduce ? "" : "glow-breathe"} />

        {/* input lines */}
        {INPUTS.map((_, i) => (
          <g key={`in${i}`}>
            <path d={inPath(i)} fill="none" stroke="var(--color-ash)" strokeWidth={1.4} />
            <path d={inPath(i)} fill="none" stroke="var(--color-orange)" strokeWidth={1.6} pathLength={100} strokeDasharray="14 100" strokeDashoffset={-84} opacity={0.8} />
          </g>
        ))}
        {/* output lines */}
        {OUTPUTS.map((_, i) => (
          <g key={`out${i}`}>
            <path d={outPath(i)} fill="none" stroke="var(--color-ash)" strokeWidth={1.4} />
            <path d={outPath(i)} fill="none" stroke="var(--color-navy)" strokeWidth={2} pathLength={100} strokeDasharray="12 100" strokeDashoffset={-86} />
          </g>
        ))}

        {/* moving event chips */}
        {!reduce &&
          INPUTS.map((n, i) => (
            <Chip key={`ci${i}`} label={n.chip} path={inPath(i)} dur={4.6 + (i % 3) * 0.6} begin={i * 0.75} kind={n.kind} tone="var(--color-orange)" />
          ))}
        {!reduce &&
          OUTPUTS.map((_, i) => (
            <Chip key={`co${i}`} label="CONTEXT" path={outPath(i)} dur={3.8 + (i % 2) * 0.7} begin={1.2 + i * 0.9} kind="check" tone="var(--color-navy)" />
          ))}

        {/* hub: four agent blocks around the Alodi mark */}
        {PETALS.map((p, i) => (
          <Diamond key={p.label} cx={HUB.x + p.dx} cy={HUB.y + p.dy} size={78} fill="url(#petal)" stroke="rgba(255,255,255,0.9)">
            {!reduce && (
              <animate attributeName="fill-opacity" values="0.55;1;0.55" dur="4s" begin={`${i}s`} repeatCount="indefinite" />
            )}
          </Diamond>
        ))}
        {PETALS.map((p, i) => (
          <g key={`pl${p.label}`}>
            <rect
              x={HUB.x + p.dx - 39}
              y={HUB.y + p.dy - 39}
              width={78}
              height={78}
              rx={14}
              transform={`rotate(45 ${HUB.x + p.dx} ${HUB.y + p.dy})`}
              fill="#fff"
              opacity={0}
            >
              {!reduce && <animate attributeName="opacity" values="0;0.45;0" dur="4s" begin={`${i}s`} repeatCount="indefinite" />}
            </rect>
            <text x={HUB.x + p.dx} y={HUB.y + p.dy + 4} textAnchor="middle" fontSize="11" fill="var(--color-navy)" letterSpacing="0.04em">
              {p.label}
            </text>
          </g>
        ))}
        <Diamond cx={HUB.x} cy={HUB.y} size={80} fill="var(--color-paper)" stroke="#ffd2b0" />
        <g>
          <circle cx={HUB.x} cy={HUB.y} r={24} fill="none" stroke="var(--color-navy)" strokeWidth={2.4} strokeDasharray="0.1 7.4" strokeLinecap="round" className={reduce ? "" : "ring-spin"} />
          <circle cx={HUB.x} cy={HUB.y} r={13} fill="none" stroke="var(--color-orange)" strokeWidth={6} />
          <g fill="var(--color-navy)">
            <rect x={HUB.x - 5.4} y={HUB.y - 2.6} width={2.6} height={5.2} rx={1.3} />
            <rect x={HUB.x - 1.3} y={HUB.y - 5} width={2.6} height={10} rx={1.3} />
            <rect x={HUB.x + 2.8} y={HUB.y - 2.6} width={2.6} height={5.2} rx={1.3} />
          </g>
        </g>

        {/* input nodes */}
        {INPUTS.map((n, i) => {
          const w = 64 + n.label.length * CH;
          const x = 276 - w;
          const y = IN_Y[i];
          return (
            <g key={n.label}>
              <rect x={x} y={y - 20} width={w} height={40} rx={20} fill="var(--color-parchment)" stroke="var(--color-navy)" />
              <g transform={`translate(${x + 20},${y - 7})`} color="var(--color-navy)">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  {n.kind === "dot" ? <circle cx="8" cy="8" r="2" fill="currentColor" /> : <rect x="6" y="6" width="4" height="4" rx="0.8" fill="currentColor" />}
                </svg>
              </g>
              <text x={x + 44} y={y + 5} fontSize="15" fill="var(--color-navy)" letterSpacing="0.02em">
                {n.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* output nodes */}
        {OUTPUTS.map((label, i) => {
          const w = 44 + label.length * CH;
          const y = OUT_Y[i];
          return (
            <g key={label}>
              <rect x={1160} y={y - 20} width={w} height={40} rx={20} fill="#fdeee4" stroke="var(--color-navy)" />
              <text x={1160 + 22} y={y + 5} fontSize="15" fill="var(--color-navy)" letterSpacing="0.02em">
                {label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Mobile: stacked version */}
      <div className="grid gap-3 md:hidden">
        <div className="flex flex-wrap gap-2">
          {INPUTS.slice(1, 6).map((n) => (
            <span key={n.label} className="pill !px-4 !py-1.5 !text-[12px]">
              <Mark kind={n.kind} size={12} />
              {n.label}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-[16px] border border-ash bg-paper p-5">
          <div className="wash -right-10 -top-10 h-40 w-40 opacity-70" style={{ background: "radial-gradient(circle, #ff8a3d, transparent 70%)" }} />
          <div className="relative grid grid-cols-2 gap-2">
            {PETALS.map((p) => (
              <span key={p.label} className="rounded-[10px] bg-[#ffd9bf] px-3 py-2 text-center text-[12px]">
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {OUTPUTS.map((o) => (
            <span key={o} className="pill !bg-[#fdeee4] !px-4 !py-1.5 !text-[12px]">
              {o}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const textO = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const diagramScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const diagramY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  return (
    <section ref={ref} className="relative pb-10 pt-16 md:pt-24">
      <div className="container-page relative">
        <motion.div className="mx-auto max-w-[900px] text-center" style={reduce ? undefined : { y: textY, opacity: textO }}>
          <RevealText as="h1" text="Failed Deliveries, Rescued in One Tap" className="t-display text-balance" stagger={0.06} />
          <Reveal delay={0.08}>
            <p className="mx-auto mt-8 max-w-[580px] text-[18px] leading-[1.35] text-graphite md:text-[20px]">
              Alodi messages and calls the buyer the moment a delivery fails, then hands the next shipper structured
              context — so the second drop lands.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
              <a href={LIVE_DEMO_URL} className="btn btn-dark">
                Watch the demo
              </a>
              <Link href="/console" className="btn btn-ghost">
                See the dashboard
              </Link>
            </div>
          </Reveal>
        </motion.div>

        <Reveal delay={0.2} y={30} className="mt-16">
          <motion.div style={reduce ? undefined : { scale: diagramScale, y: diagramY }}>
            <PipelineDiagram />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

/** Logo strip: shippers whose riders we interviewed. Greyscale at rest, brand colour on hover (DESIGN.md logo strip). */
export function SourceStrip() {
  return (
    <section className="py-10">
      <div className="container-page">
        <div className="grid items-center gap-8 border-y border-ash py-10 md:grid-cols-[200px_1fr] md:gap-12">
          <div className="t-eyebrow text-smoke">
            Shippers we
            <br className="hidden md:block" /> interviewed
          </div>
          <ul className="flex flex-wrap items-center justify-between gap-x-10 gap-y-8">
            {SHIPPER_LOGOS.map((l, i) => (
              <motion.li
                key={l.name}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <a href={l.url} target="_blank" rel="noreferrer" title={l.name} className="shipper-logo block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.src} alt={l.name} style={{ height: 30, width: 30 * l.ratio }} className="object-contain" />
                </a>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
