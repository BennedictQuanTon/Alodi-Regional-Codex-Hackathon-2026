"use client";

import Image from "next/image";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PHOTOS } from "@/lib/content";
import { RevealText } from "./motion";

// Three principles, three cards. Each card: an open-licence photo carrying the title, one line,
// and a small figure that draws itself once in view. No pinned scroll.

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "-80px" } as const;

/* ---------- 01 · inside the rules --------------------------------------- */

const BEATS = [
  { t: "Tap", s: "10:02" },
  { t: "Chat", s: "now" },
  { t: "Call", s: "+60′" },
  { t: "Call", s: "+2 h" },
  { t: "CS", s: "person" },
];

function RulesFigure() {
  const reduce = useReducedMotion();
  const W = 320;
  const x = (i: number) => 10 + (i / (BEATS.length - 1)) * (W - 20);
  return (
    <svg viewBox={`0 0 ${W} 120`} className="w-full overflow-visible" role="img" aria-label="Tap, chat now, call after 60 minutes, call two hours later, then a person, all inside five days">
      <line x1={10} x2={W - 10} y1={24} y2={24} stroke="var(--color-ash)" />
      <motion.line x1={10} x2={W - 10} y1={24} y2={24} stroke="var(--color-navy)" strokeWidth={1.5} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={VIEW} transition={{ duration: 1.4, ease: EASE }} />
      {!reduce && (
        <circle r={3.5} cy={24} fill="var(--color-orange)">
          <animate attributeName="cx" values={`10;${W - 10}`} dur="4s" repeatCount="indefinite" />
        </circle>
      )}
      {BEATS.map((b, i) => (
        <motion.g key={i} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEW} transition={{ delay: 0.3 + i * 0.15, duration: 0.5, ease: EASE }}>
          <circle cx={x(i)} cy={24} r={i === 0 ? 6 : 4.5} fill={i === 0 ? "var(--color-orange)" : i === BEATS.length - 1 ? "var(--color-paper)" : "var(--color-navy)"} stroke="var(--color-navy)" strokeWidth={i === BEATS.length - 1 ? 1.5 : 0} />
          <text x={x(i)} y={52} textAnchor={i === 0 ? "start" : i === BEATS.length - 1 ? "end" : "middle"} dx={i === 0 ? -6 : i === BEATS.length - 1 ? 6 : 0} fontSize="13" fill="var(--color-navy)" fontFamily="var(--font-sans)">
            {b.t}
          </text>
          <text x={x(i)} y={68} textAnchor={i === 0 ? "start" : i === BEATS.length - 1 ? "end" : "middle"} dx={i === 0 ? -6 : i === BEATS.length - 1 ? 6 : 0} fontSize="11" fill="var(--color-smoke)" fontFamily="var(--font-sans)">
            {b.s}
          </text>
        </motion.g>
      ))}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEW} transition={{ delay: 1.2, duration: 0.6 }}>
        <line x1={10} x2={W - 10} y1={98} y2={98} stroke="var(--color-ash)" />
        <rect x={10} y={96} width={(W - 20) * 0.4} height={4} rx={2} fill="var(--color-orange)" />
        <text x={10} y={116} fontSize="11" fill="var(--color-smoke)" fontFamily="var(--font-sans)">
          day 0
        </text>
        <text x={W - 10} y={116} textAnchor="end" fontSize="11" fill="var(--color-smoke)" fontFamily="var(--font-sans)">
          day 5 · Shopee’s limit
        </text>
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
  { t: "Apply ≥ 0.85", side: "agent" },
  { t: "Settle a conflict", side: "person" },
] as const;

function LineFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEW);
  const reduce = useReducedMotion();
  const sorted = inView || reduce;
  return (
    <div ref={ref} className="relative h-[120px]">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-orange to-transparent" />
      <motion.span
        className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-orange shadow-[0_0_12px_3px_rgba(240,90,0,0.45)]"
        animate={reduce ? undefined : { top: ["4%", "92%", "4%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {ACTIONS.map((a, i) => {
        const row = Math.floor(i / 2);
        const agent = a.side === "agent";
        return (
          <motion.div
            key={a.t}
            className={`absolute whitespace-nowrap rounded-full px-3 py-1 text-[12px] ${agent ? "bg-parchment text-navy shadow-[0_0_0_1px_rgba(31,42,68,0.12)]" : "bg-navy text-parchment"}`}
            style={{ top: row * 40 + (agent ? 0 : 14) }}
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

function EvalFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, VIEW);
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? 0.88 : 0.59);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0.59, 0.88, { duration: 1.8, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce]);
  const W = 200;
  const H = 70;
  const px = (i: number) => (i / (ROUNDS.length - 1)) * W;
  const py = (r: number) => H - ((r - 0.5) / 0.45) * H;
  const line = ROUNDS.map((r, i) => `${i ? "L" : "M"}${px(i)},${py(r)}`).join(" ");
  return (
    <div ref={ref} className="flex h-[120px] items-end gap-5">
      <div>
        <div className="t-number text-[56px] leading-none">{v.toFixed(2)}</div>
        <div className="mt-2 whitespace-nowrap text-[12px] text-smoke">held-out F1</div>
      </div>
      <svg viewBox={`-6 -8 ${W + 12} ${H + 14}`} className="mb-1 min-w-0 flex-1" aria-hidden>
        <defs>
          <linearGradient id="eval-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f05a00" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f05a00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#eval-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEW} transition={{ delay: 0.8, duration: 0.8 }} />
        <motion.path d={line} fill="none" stroke="#f05a00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={VIEW} transition={{ duration: 1.8, ease: EASE }} />
        <circle cx={px(ROUNDS.length - 1)} cy={py(0.88)} r={4} fill="#f05a00" />
      </svg>
    </div>
  );
}

/* ---------- section ------------------------------------------------------ */

const PRINCIPLES = [
  { k: "01", title: "Play inside the rules", line: "Shopee allows 2–3 contacts within 5 days. Alodi never steps outside.", photo: PHOTOS.street, pos: "50% 80%", Figure: RulesFigure },
  { k: "02", title: "Draw a hard line", line: "The agent asks and calls. Money and a buyer’s record go to a person.", photo: PHOTOS.phone, pos: "50% 45%", Figure: LineFigure },
  { k: "03", title: "Prove it with evals", line: "Codex changes one thing per round. The held-out set decides.", photo: PHOTOS.laptop, pos: "50% 50%", Figure: EvalFigure },
];

export function Approach() {
  return (
    <section id="approach" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="t-eyebrow">Our approach</div>
        <RevealText text="Autonomous where the rules are clear. Human where they aren’t." className="t-h1 mt-5 max-w-[900px]" stagger={0.03} />

        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <motion.article
              key={p.k}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEW}
              transition={{ delay: i * 0.1, duration: 0.8, ease: EASE }}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-ash bg-paper"
            >
              <div className="relative h-[240px] overflow-hidden">
                <Image
                  src={p.photo.src}
                  alt={p.photo.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="photo-tone object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                  style={{ objectPosition: p.pos }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className="text-[12px] font-medium tracking-[0.08em] text-orange">{p.k}</span>
                  <h3 className="t-h3 mt-2 !text-parchment">{p.title}</h3>
                </div>
                <span className="absolute right-4 top-4 rounded-full bg-ink/40 px-2.5 py-1 text-[10px] text-parchment/70 backdrop-blur-sm">{p.photo.credit}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="t-body-sans text-[15px] leading-[1.45] text-graphite">{p.line}</p>
                <div className="mt-auto pt-8">
                  <p.Figure />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
