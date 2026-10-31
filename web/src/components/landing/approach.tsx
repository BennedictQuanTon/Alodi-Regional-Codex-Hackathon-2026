"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RevealText } from "./motion";

// Bento: one dark hero tile, one warm tile, one wide proof tile. Each tile carries a single idea,
// a title, one line and a figure that draws itself once when it enters the view. No pinned scroll.

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "-80px" } as const;

function Tile({ className = "", delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW}
      transition={{ delay, duration: 0.8, ease: EASE }}
      className={`relative overflow-hidden rounded-[24px] p-7 md:p-9 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Head({ k, title, line, dark = false }: { k: string; title: string; line: string; dark?: boolean }) {
  return (
    <div className="relative">
      <span className={`text-[12px] font-medium tracking-[0.08em] ${dark ? "text-orange" : "text-orange-deep"}`}>{k}</span>
      <h3 className={`t-h3 mt-4 ${dark ? "!text-parchment" : ""}`}>{title}</h3>
      <p className={`t-body-sans mt-2 max-w-[380px] text-[15px] leading-[1.45] ${dark ? "text-parchment/65" : "text-graphite"}`}>{line}</p>
    </div>
  );
}

/* ---------- 01 · inside the rules --------------------------------------- */

const BEATS = [
  { t: "Tap", s: "10:02" },
  { t: "Chat", s: "now" },
  { t: "Call 1", s: "+60′" },
  { t: "Call 2", s: "+2 h" },
  { t: "CS", s: "a person" },
];

function RulesFigure() {
  const reduce = useReducedMotion();
  const W = 620;
  const x = (i: number) => 14 + (i / (BEATS.length - 1)) * (W - 28);
  return (
    <svg viewBox={`0 0 ${W} 150`} className="w-full overflow-visible" role="img" aria-label="Tap, chat now, call after 60 minutes, call two hours later, then a person. All inside five days.">
      <defs>
        <linearGradient id="rules-line" x1="0" x2="1">
          <stop offset="0" stopColor="#f05a00" />
          <stop offset="0.75" stopColor="#f6f3f1" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f6f3f1" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <line x1={14} x2={W - 14} y1={40} y2={40} stroke="rgba(246,243,241,0.14)" />
      <motion.line x1={14} x2={W - 14} y1={40} y2={40} stroke="url(#rules-line)" strokeWidth={2} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={VIEW} transition={{ duration: 1.6, ease: EASE }} />
      {!reduce && (
        <circle r={4} cy={40} fill="#f05a00">
          <animate attributeName="cx" values={`14;${W - 14}`} dur="4.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
      )}
      {BEATS.map((b, i) => (
        <motion.g key={b.t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEW} transition={{ delay: 0.3 + i * 0.18, duration: 0.6, ease: EASE }}>
          {i === 0 && <circle cx={x(i)} cy={40} r={16} fill="#f05a00" opacity={0.18} />}
          <circle cx={x(i)} cy={40} r={i === 0 ? 7 : 5} fill={i === 0 ? "#f05a00" : i === BEATS.length - 1 ? "#121a2c" : "#f6f3f1"} stroke="#f6f3f1" strokeWidth={i === BEATS.length - 1 ? 1.5 : 0} />
          <text x={x(i)} y={78} textAnchor={i === 0 ? "start" : i === BEATS.length - 1 ? "end" : "middle"} dx={i === 0 ? -6 : i === BEATS.length - 1 ? 6 : 0} fontSize="15" fill="#f6f3f1" fontFamily="var(--font-sans)">
            {b.t}
          </text>
          <text x={x(i)} y={98} textAnchor={i === 0 ? "start" : i === BEATS.length - 1 ? "end" : "middle"} dx={i === 0 ? -6 : i === BEATS.length - 1 ? 6 : 0} fontSize="12" fill="rgba(246,243,241,0.5)" fontFamily="var(--font-sans)">
            {b.s}
          </text>
        </motion.g>
      ))}
      {/* the five-day frame Shopee allows */}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEW} transition={{ delay: 1.4, duration: 0.6 }}>
        {Array.from({ length: 6 }, (_, d) => (
          <g key={d}>
            <line x1={14 + (d / 5) * (W - 28)} x2={14 + (d / 5) * (W - 28)} y1={126} y2={134} stroke="rgba(246,243,241,0.3)" />
            <text x={14 + (d / 5) * (W - 28)} y={148} textAnchor={d === 0 ? "start" : d === 5 ? "end" : "middle"} fontSize="11" fill="rgba(246,243,241,0.4)" fontFamily="var(--font-sans)">
              day {d}
            </text>
          </g>
        ))}
        <line x1={14} x2={W - 14} y1={130} y2={130} stroke="rgba(246,243,241,0.18)" />
        <rect x={14} y={128} width={(W - 28) * 0.4} height={4} rx={2} fill="#f05a00" opacity={0.8} />
      </motion.g>
    </svg>
  );
}

/* ---------- 02 · the hard line ----------------------------------------- */

const ACTIONS = [
  { t: "Ask for a window", side: "agent" },
  { t: "Label a refusal", side: "person" },
  { t: "Call 08:00–20:30", side: "agent" },
  { t: "Return to seller", side: "person" },
  { t: "Apply context ≥ 0.85", side: "agent" },
  { t: "Settle a conflict", side: "person" },
] as const;

function LineFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEW);
  const reduce = useReducedMotion();
  const sorted = inView || reduce;
  return (
    <div ref={ref} className="relative mt-8 h-[200px]">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-orange to-transparent" />
      <motion.span
        className="absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-orange shadow-[0_0_16px_4px_rgba(240,90,0,0.45)]"
        animate={reduce ? undefined : { top: ["4%", "92%", "4%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute left-0 top-0 text-[11px] font-medium uppercase tracking-[0.08em] text-smoke">Agent</div>
      <div className="absolute right-0 top-0 text-[11px] font-medium uppercase tracking-[0.08em] text-smoke">Person</div>
      {ACTIONS.map((a, i) => {
        const row = Math.floor(i / 2);
        const agent = a.side === "agent";
        return (
          <motion.div
            key={a.t}
            className={`absolute whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] ${agent ? "bg-paper text-navy shadow-[0_0_0_1px_rgba(31,42,68,0.1)]" : "bg-navy text-parchment"}`}
            style={{ top: 30 + row * 52 + (agent ? 0 : 22) }}
            initial={false}
            animate={sorted ? { left: agent ? "0%" : "100%", x: agent ? "0%" : "-100%", opacity: 1 } : { left: "50%", x: "-50%", opacity: 0.4 }}
            transition={{ delay: sorted ? 0.25 + i * 0.1 : 0, type: "spring", stiffness: 140, damping: 20 }}
          >
            {a.t}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------- 03 · proven by evals --------------------------------------- */

const ROUNDS = [0.59, 0.68, 0.75, 0.81, 0.86, 0.88, 0.88];

function Score() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEW);
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? 0.88 : 0.59);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0.59, 0.88, { duration: 1.8, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce]);
  return (
    <span ref={ref} className="t-number text-[96px] leading-none md:text-[128px]">
      {v.toFixed(2)}
    </span>
  );
}

function EvalCurve() {
  const W = 760;
  const H = 150;
  const px = (i: number) => (i / (ROUNDS.length - 1)) * W;
  const py = (v: number) => H - ((v - 0.5) / 0.45) * H;
  const line = ROUNDS.map((v, i) => `${i ? "L" : "M"}${px(i)},${py(v)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`-8 -10 ${W + 16} ${H + 40}`} className="w-full overflow-visible" role="img" aria-label="Held-out F1 rises from 0.59 at round v0 to 0.88 at round v6">
      <defs>
        <linearGradient id="eval-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f05a00" stopOpacity="0.22" />
          <stop offset="1" stopColor="#f05a00" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.6, 0.7, 0.8, 0.9].map((g) => (
        <line key={g} x1={0} x2={W} y1={py(g)} y2={py(g)} stroke="var(--color-ash-soft)" />
      ))}
      <motion.path d={area} fill="url(#eval-area)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEW} transition={{ delay: 0.8, duration: 1 }} />
      <motion.path d={line} fill="none" stroke="#f05a00" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={VIEW} transition={{ duration: 1.8, ease: EASE }} />
      {ROUNDS.map((v, i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={VIEW} transition={{ delay: 0.25 + i * 0.25, duration: 0.4 }} style={{ transformOrigin: `${px(i)}px ${py(v)}px` }}>
          <circle cx={px(i)} cy={py(v)} r={i === ROUNDS.length - 1 ? 6 : 3.5} fill={i === ROUNDS.length - 1 ? "#f05a00" : "var(--color-parchment)"} stroke="#f05a00" strokeWidth={2} />
          <text x={px(i)} y={H + 24} textAnchor="middle" fontSize="12" fill="var(--color-smoke)" fontFamily="var(--font-sans)">
            v{i}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

/* ---------- section ------------------------------------------------------ */

export function Approach() {
  return (
    <section id="approach" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="t-eyebrow">Our approach</div>
        <RevealText text="Autonomous where the rules are clear. Human where they aren’t." className="t-h1 mt-5 max-w-[900px]" stagger={0.03} />

        <div className="mt-10 grid gap-3 lg:grid-cols-12">
          <Tile className="bg-ink text-parchment lg:col-span-7">
            <div className="wash -left-24 -top-24 h-80 w-80 opacity-40" style={{ background: "radial-gradient(circle, rgba(240,90,0,0.8), transparent 70%)" }} />
            <Head dark k="01" title="Play inside the rules" line="Shopee allows 2–3 contacts within 5 days. Alodi never steps outside." />
            <div className="relative mt-10">
              <RulesFigure />
            </div>
          </Tile>

          <Tile delay={0.08} className="bg-peach-mist lg:col-span-5">
            <Head k="02" title="Draw a hard line" line="Money and a buyer’s record always go to a person." />
            <LineFigure />
          </Tile>

          <Tile delay={0.16} className="border border-ash bg-paper lg:col-span-12">
            <div className="grid items-end gap-8 lg:grid-cols-[0.8fr_1.6fr] lg:gap-14">
              <div>
                <Head k="03" title="Prove it with evals" line="Codex changes one thing per round. The held-out set decides." />
                <div className="mt-8 flex items-baseline gap-4">
                  <Score />
                  <span className="text-[13px] leading-[1.35] text-smoke">
                    held-out F1
                    <br />
                    from 0.59
                  </span>
                </div>
              </div>
              <div>
                <EvalCurve />
                <p className="mt-2 text-right text-[12px] text-smoke">Illustrative until the eval runs on stage</p>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}
