"use client";

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { SourceNote } from "@/components/site/brand";
import { RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const CHAPTERS = [
  {
    k: "01",
    title: "The rules already exist",
    body: "Shopee’s redelivery process fixes the frame: 2–3 contacts, reschedule within 5 days. Alodi plays entirely inside it.",
  },
  {
    k: "02",
    title: "A hard autonomy boundary",
    body: "The agent messages, calls and applies confident context. Anything that touches money or a buyer’s record goes to a person.",
  },
  {
    k: "03",
    title: "Evals, not vibes",
    body: "Codex changes one thing per round against a held-out set. The curve is the proof, scored next to safe autonomy.",
  },
];

/* ---------- chapter 1: the redelivery frame ---------------------------- */

type Mark = { at: number; label: string; sub: string; tone: "orange" | "navy" | "warn" | "ink" };

const DAY0: Mark[] = [
  { at: 0.04, label: "Courier tap", sub: "10:02", tone: "orange" },
  { at: 0.3, label: "Chat sent", sub: "10:02", tone: "navy" },
  { at: 0.62, label: "AI call 1", sub: "11:02", tone: "navy" },
  { at: 0.96, label: "AI call 2", sub: "13:02", tone: "navy" },
];
const LATER: Mark[] = [
  { at: 0.04, label: "Cycle 2", sub: "day 1", tone: "navy" },
  { at: 0.5, label: "Hand to CS", sub: "after cycle 2", tone: "warn" },
  { at: 0.96, label: "Hard limit", sub: "day 5", tone: "ink" },
];

function Track({ title, ticks, marks, p, offset }: { title: string; ticks: string[]; marks: Mark[]; p: number; offset: number }) {
  const local = Math.max(0, Math.min(1, (p - offset) / 0.5));
  const shown = Math.floor(local * (marks.length + 0.6));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] uppercase text-navy">{title}</span>
        <span className="text-[11px] text-smoke">{ticks.join(" · ")}</span>
      </div>
      <div className="relative mt-5 h-[110px] md:h-[86px]">
        <div className="absolute inset-x-0 top-[7px] h-[3px] rounded-full bg-ash-soft">
          <motion.div className="h-full rounded-full bg-navy" animate={{ width: `${local * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
        {marks.map((m, i) => {
          const edge = i === 0 ? "left-[-6px] text-left" : i === marks.length - 1 ? "right-[-6px] text-right" : "left-1/2 -translate-x-1/2 text-center";
          return (
            <motion.div
              key={m.label}
              className="absolute top-0 w-0"
              style={{ left: `${m.at * 100}%` }}
              initial={false}
              animate={{ opacity: i < shown ? 1 : 0, y: i < shown ? 0 : 10 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <span
                className={`block size-[17px] -translate-x-1/2 rounded-full border-[3px] border-paper ${
                  m.tone === "orange" ? "bg-orange" : m.tone === "warn" ? "bg-warn" : m.tone === "ink" ? "bg-ink" : "bg-navy"
                }`}
              />
              <span className={`absolute block w-max ${i % 2 ? "top-[52px] md:top-7" : "top-7"} ${edge}`}>
                <span className="block whitespace-nowrap text-[12px] md:text-[13px]">{m.label}</span>
                <span className="block whitespace-nowrap text-[11px] text-smoke">{m.sub}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function FrameVisual({ p }: { p: number }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["2–3", "contacts per order"],
          ["5", "days to reschedule"],
          ["40K", "VND lost per failure"],
        ].map(([n, l], i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, ease: EASE }} className="rounded-[12px] bg-parchment p-4">
            <div className="t-number text-[44px]">{n}</div>
            <div className="mt-2 text-[12px] uppercase text-smoke">{l}</div>
          </motion.div>
        ))}
      </div>
      <div className="space-y-8 px-3">
        <Track title="Day 0 · rescue cycle 1" ticks={["10:00", "14:00"]} marks={DAY0} p={p} offset={0} />
        <Track title="Days 1–5 · still inside Shopee’s window" ticks={["day 1", "day 5"]} marks={LATER} p={p} offset={0.45} />
      </div>
      <SourceNote>Shopee Help Center, article 79569 · Return & Refund Policy §7.1</SourceNote>
    </div>
  );
}

/* ---------- chapter 2: the boundary ------------------------------------ */

const ACTIONS = [
  { t: "Ask for a delivery window", who: "agent" },
  { t: "Label a refusal “suspected bomb”", who: "human" },
  { t: "Call between 08:00 and 20:30", who: "agent" },
  { t: "Return to seller", who: "human" },
  { t: "Apply context ≥ 0.85", who: "agent" },
  { t: "Resolve conflicting answers", who: "human" },
];

function Lane({ items, side, shown }: { items: typeof ACTIONS; side: "agent" | "human"; shown: number }) {
  const isShown = (a: (typeof ACTIONS)[number]) => ACTIONS.indexOf(a) < shown;
  return (
    <div className={`flex flex-col gap-3 rounded-[14px] p-4 ${side === "agent" ? "bg-[#fdeee4]" : "bg-navy text-parchment"}`}>
      <div className="flex items-center justify-between text-[12px] uppercase">
        <span>{side === "agent" ? "Agent acts" : "Human decides"}</span>
        <span className={side === "agent" ? "text-orange-deep" : "text-peach"}>{items.filter(isShown).length}/3</span>
      </div>
      {items.map((a) => (
        <motion.div
          key={a.t}
          initial={false}
          animate={isShown(a) ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: side === "agent" ? 60 : -60, scale: 0.94 }}
          transition={{ duration: 0.55, ease: EASE }}
          className={`rounded-[10px] px-3.5 py-3 text-[14px] ${side === "agent" ? "bg-paper shadow-[0_0_0_1px_rgba(240,90,0,0.35)]" : "bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"}`}
        >
          {a.t}
        </motion.div>
      ))}
    </div>
  );
}

function BoundaryVisual({ p }: { p: number }) {
  const shown = Math.floor(p * (ACTIONS.length + 1.2));
  const agent = ACTIONS.filter((a) => a.who === "agent");
  const human = ACTIONS.filter((a) => a.who === "human");
  return (
    <div className="flex h-full flex-col">
      <div className="relative grid flex-1 grid-cols-2 gap-6">
        <Lane items={agent} side="agent" shown={shown} />
        <Lane items={human} side="human" shown={shown} />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-orange to-transparent" />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-0 size-3 -translate-x-1/2 rounded-full bg-orange shadow-[0_0_18px_4px_rgba(240,90,0,0.6)]"
          animate={{ top: ["0%", "96%", "0%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="mt-5 text-[13px] text-smoke">The line in the middle is enforced by the policy guard, not by the prompt.</p>
    </div>
  );
}

/* ---------- chapter 3: the eval loop ----------------------------------- */

const ROUNDS = [0.59, 0.68, 0.75, 0.81, 0.86, 0.88, 0.88];
const STEPS = ["Held-out set", "Codex edit", "Per-field F1", "Keep best"];

function LoopVisual({ p }: { p: number }) {
  const reduce = useReducedMotion();
  const idx = Math.min(ROUNDS.length - 1, Math.floor(p * ROUNDS.length));
  const f1 = ROUNDS[idx];
  const R = 128;
  const W = 300;
  const pts = ROUNDS.slice(0, idx + 1).map((v, i) => `${(i / (ROUNDS.length - 1)) * 220},${70 - ((v - 0.5) / 0.45) * 64}`);
  return (
    <div className="grid h-full items-center gap-6 md:grid-cols-[1fr_0.9fr]">
      <div className="relative mx-auto" style={{ width: W, height: W }}>
        <svg viewBox={`0 0 ${W} ${W}`} className="absolute inset-0" aria-hidden>
          <circle cx={W / 2} cy={W / 2} r={R} fill="none" stroke="var(--color-ash)" strokeDasharray="3 6" />
          <motion.circle
            cx={W / 2}
            cy={W / 2}
            r={R}
            fill="none"
            stroke="var(--color-orange)"
            strokeWidth={3}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: (p * ROUNDS.length) % 1 || (p > 0.98 ? 1 : 0.02) }}
            transform={`rotate(-90 ${W / 2} ${W / 2})`}
          />
          {!reduce && (
            <circle r={6} fill="var(--color-orange)">
              <animateMotion dur="3.2s" repeatCount="indefinite" path={`M${W / 2},${W / 2 - R} a${R},${R} 0 1,1 -0.01,0`} />
            </circle>
          )}
        </svg>
        {STEPS.map((s, i) => {
          const a = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={s}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper px-3 py-1.5 text-[12px] uppercase shadow-[0_0_0_1px_rgba(31,42,68,0.15)]"
              style={{ left: W / 2 + Math.cos(a) * R, top: W / 2 + Math.sin(a) * R }}
            >
              {s}
            </div>
          );
        })}
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[12px] uppercase text-smoke">Held-out F1</div>
            <motion.div key={f1} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="t-number text-[64px]">
              {f1.toFixed(2)}
            </motion.div>
            <div className="text-[13px] text-orange-deep">round v{idx}</div>
          </div>
        </div>
      </div>
      <div>
        <svg viewBox="-6 -6 236 86" className="w-full" aria-label={`F1 rises from 0.59 to ${f1.toFixed(2)}`}>
          <line x1="0" x2="220" y1="70" y2="70" stroke="var(--color-ash)" />
          <polyline points={pts.join(" ")} fill="none" stroke="var(--color-orange)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.length > 0 && <circle cx={pts.at(-1)!.split(",")[0]} cy={pts.at(-1)!.split(",")[1]} r="4.5" fill="var(--color-orange)" stroke="var(--color-paper)" strokeWidth="2" />}
        </svg>
        <div className="mt-2 flex justify-between text-[11px] text-smoke">
          <span>v0</span>
          <span>v6</span>
        </div>
        <p className="mt-6 text-[13px] leading-[1.5] text-graphite">One prompt or schema change per round. Stop when held-out F1 stops rising. Illustrative curve until the real eval runs.</p>
      </div>
    </div>
  );
}

/* ---------- section ------------------------------------------------------ */

function Visual({ chapter, p }: { chapter: number; p: number }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[18px] border border-ash bg-paper p-6 md:p-8">
      <div className="wash -right-24 -top-24 h-72 w-72 opacity-60" style={{ background: "radial-gradient(circle, rgba(255,148,115,0.7), transparent 70%)" }} />
      <AnimatePresence mode="wait">
        <motion.div
          key={chapter}
          className="relative h-full"
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {chapter === 0 && <FrameVisual p={p} />}
          {chapter === 1 && <BoundaryVisual p={p} />}
          {chapter === 2 && <LoopVisual p={p} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Approach() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [state, setState] = useState({ chapter: 0, p: 0 });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const scaled = Math.min(2.999, Math.max(0, v * 3));
    const chapter = Math.floor(scaled);
    const p = Math.round((scaled - chapter) * 50) / 50;
    setState((prev) => (prev.chapter === chapter && prev.p === p ? prev : { chapter, p }));
  });

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.05) / 3), behavior: "smooth" });
  };

  return (
    <section id="approach" ref={ref} className="relative scroll-mt-28 lg:h-[340vh]">
      <div className="lg:sticky lg:top-[84px] lg:flex lg:h-[calc(100dvh-84px)] lg:items-center">
        <div className="container-page grid gap-10 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-0">
          <div className="flex flex-col justify-center">
            <div className="t-eyebrow">Our approach</div>
            <RevealText text="Autonomous where the rules are clear. Human where they aren’t." className="t-h2 mt-6 max-w-[620px]" />
            <ol className="mt-10 space-y-2">
              {CHAPTERS.map((c, i) => {
                const active = state.chapter === i;
                return (
                  <li key={c.k}>
                    <button
                      onClick={() => jump(i)}
                      className={`w-full rounded-[14px] p-5 text-left transition-[background-color,opacity] duration-500 ${active ? "bg-paper shadow-[0_0_0_1px_rgba(31,42,68,0.1)]" : "opacity-45 hover:opacity-75"}`}
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="text-[13px] text-orange-deep">{c.k}</span>
                        <span className="t-h4">{c.title}</span>
                      </div>
                      <div className="grid transition-[grid-template-rows] duration-500" style={{ gridTemplateRows: active ? "1fr" : "0fr" }}>
                        <p className="t-body-sans overflow-hidden pl-9 text-[15px] leading-[1.45] text-graphite">
                          <span className="block pt-2">{c.body}</span>
                        </p>
                      </div>
                      <div className="ml-9 mt-4 h-[2px] overflow-hidden rounded-full bg-ash-soft">
                        <div
                          className="h-full origin-left bg-orange transition-transform duration-200"
                          style={{ transform: `scaleX(${state.chapter > i ? 1 : active ? state.p : 0})` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          {/* desktop: one pinned stage that morphs; mobile: stacked visuals */}
          <div className="hidden h-[620px] lg:block">
            <Visual chapter={state.chapter} p={state.p} />
          </div>
          <div className="space-y-4 lg:hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[560px]">
                <Visual chapter={i} p={1} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
