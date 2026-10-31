"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Mark } from "@/components/site/brand";
import { Reveal, RevealText } from "./motion";

/* ---------- shared bits -------------------------------------------------- */

function Wash({ className, colors }: { className: string; colors: string }) {
  return <div className={`wash ${className}`} style={{ background: colors }} aria-hidden />;
}

function useTicker(count: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % count), ms);
    return () => clearInterval(t);
  }, [inView, reduce, count, ms]);
  return { ref, i };
}

/* ---------- 1 · agent block pipeline (the "blocks" card) ----------------- */

const BLOCKS = [
  { title: "Courier tap", tag: "Trigger · A", kind: "dot" as const },
  { link: "Always" },
  { title: "Rescue chat", tag: "Agent", kind: "dot" as const },
  { link: "Silent 60 min" },
  { title: "Voice call", tag: "Agent", kind: "dot" as const },
  { link: "Answered" },
  { title: "Extractor", tag: "JSON + confidence", kind: "square" as const },
];

function Block({ title, tag, kind, active }: { title: string; tag: string; kind: "dot" | "check" | "square"; active: boolean }) {
  return (
    <motion.div
      animate={{ boxShadow: active ? "0 0 0 2px rgba(240,90,0,0.9), 0 8px 24px rgba(240,90,0,0.18)" : "0 0 0 1px rgba(31,42,68,0.08)" }}
      transition={{ duration: 0.35 }}
      className="flex w-[220px] items-center gap-3 rounded-[10px] bg-white px-4 py-3"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${active ? "border-orange text-orange" : "border-ash text-navy"}`}>
        <Mark kind={kind} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-[family-name:var(--font-sans)] text-[15px] font-medium tracking-[-0.01em]">{title}</span>
        <span className="mt-1 inline-block rounded-[5px] border border-ash-soft px-1.5 py-0.5 font-[family-name:var(--font-sans)] text-[11px] text-smoke">
          {tag}
        </span>
      </span>
    </motion.div>
  );
}

function Connector({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="h-2 w-10 rounded-full bg-navy" />
      <span className="h-3 w-[3px] bg-navy" />
      <motion.span
        animate={{ backgroundColor: active ? "#fdeee4" : "#ffffff", borderColor: active ? "#f05a00" : "#9fb0dc" }}
        className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1 font-[family-name:var(--font-sans)] text-[13px] text-navy"
      >
        <span className="text-[11px] text-smoke">↳</span>
        {label}
      </motion.span>
      <span className="h-3 w-[3px] bg-navy" />
      <span className="h-2 w-10 rounded-full bg-navy" />
    </div>
  );
}

function AgentPipeline() {
  const steps = BLOCKS.length + 1; // + the OR split
  const { ref, i } = useTicker(steps + 1, 1100);
  return (
    <div ref={ref} className="relative flex flex-col items-center py-2">
      {BLOCKS.map((b, idx) => (
        <Fragment key={idx}>
          {"link" in b ? (
            <Connector label={b.link!} active={i === idx} />
          ) : (
            <Block title={b.title!} tag={b.tag!} kind={b.kind!} active={i === idx} />
          )}
        </Fragment>
      ))}
      {/* OR split */}
      <div className="flex flex-col items-center">
        <span className="h-2 w-10 rounded-full bg-navy" />
        <span className="h-3 w-[3px] bg-navy" />
        <motion.span
          animate={{ backgroundColor: i === BLOCKS.length ? "#fdeee4" : "#ffffff", borderColor: i === BLOCKS.length ? "#f05a00" : "#9fb0dc" }}
          className="rounded-[8px] border px-4 py-1 font-[family-name:var(--font-sans)] text-[13px]"
        >
          OR
        </motion.span>
      </div>
      <div className="relative mt-0 flex w-full max-w-[420px] justify-between">
        <span className="absolute left-[25%] right-[25%] top-0 h-[3px] bg-navy" />
        <span className="absolute left-[25%] top-0 h-4 w-[3px] bg-navy" />
        <span className="absolute right-[25%] top-0 h-4 w-[3px] bg-navy" />
      </div>
      <div className="mt-4 grid w-full max-w-[440px] grid-cols-2 gap-3">
        {[
          { t: "Auto-apply", s: "all fields ≥ 0.85", k: "check" as const },
          { t: "Human review", s: "low or conflicting", k: "dot" as const },
        ].map((leaf, j) => {
          const active = i === BLOCKS.length + 1 && j === 0;
          return (
            <motion.div
              key={leaf.t}
              animate={{ boxShadow: active ? "0 0 0 2px rgba(240,90,0,0.9)" : "0 0 0 1px rgba(31,42,68,0.08)" }}
              className="flex items-center gap-2.5 rounded-[10px] bg-white px-3 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ash text-navy">
                <Mark kind={leaf.k} size={16} />
              </span>
              <span className="min-w-0 font-[family-name:var(--font-sans)]">
                <span className="block text-[14px] font-medium">{leaf.t}</span>
                <span className="block text-[11px] text-smoke">{leaf.s}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 2 · in-flight extraction ------------------------------------ */

const FIELDS = [
  { k: "time_window", v: "Sun 1 Nov · 17:00–20:00", c: 0.94 },
  { k: "drop_location", v: "Security desk, Tower B", c: 0.88 },
  { k: "alt_receiver", v: "Wife · 0903 *** 214", c: 0.91 },
];

function ExtractionArt() {
  const { ref, i } = useTicker(FIELDS.length + 2, 1200);
  return (
    <div ref={ref} className="relative w-full max-w-[400px] rounded-[12px] bg-white p-4 shadow-[0_0_0_1px_rgba(31,42,68,0.08)]">
      <div className="rounded-[8px] bg-parchment p-3 font-[family-name:var(--font-sans)] text-[13px] leading-[1.45] text-graphite">
        “Tomorrow after five, please. Leave it with security in Tower B — or call my wife.”
      </div>
      <div className="my-3 flex items-center gap-2 text-[11px] uppercase text-smoke">
        <span className="h-px flex-1 bg-ash-soft" /> Extractor · strict JSON <span className="h-px flex-1 bg-ash-soft" />
      </div>
      <div className="space-y-2">
        {FIELDS.map((f, idx) => {
          const shown = i > idx;
          return (
            <div key={f.k} className="grid grid-cols-[112px_1fr_44px] items-center gap-2 text-[12px]">
              <span className="rounded-[5px] bg-parchment px-1.5 py-0.5 text-smoke">{f.k}</span>
              <motion.span animate={{ opacity: shown ? 1 : 0.15 }} className="truncate font-[family-name:var(--font-sans)] text-navy">
                {f.v}
              </motion.span>
              <span className="relative h-1.5 overflow-hidden rounded-full bg-ash-soft">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-orange"
                  animate={{ width: shown ? `${f.c * 100}%` : "0%" }}
                  transition={{ duration: 0.6 }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 3 · rules ---------------------------------------------------- */

const RULES = [
  { key: "call_hours", text: "only between", vals: ["08:00", "20:30"] },
  { key: "max_calls", text: "per cycle is", vals: ["2"] },
  { key: "confidence", text: "below", vals: ["0.85", "→ human review"] },
  { key: "trigger", text: "equals", vals: ["REFUSED", "→ CS, no contact"] },
];

function RulesArt() {
  return (
    <div className="relative w-full max-w-[440px]">
      <div className="flex justify-between">
        {["Always", "AND", "OR"].map((c) => (
          <span key={c} className="rounded-[8px] border border-[#9fb0dc] bg-white px-3 py-1 font-[family-name:var(--font-sans)] text-[13px] text-navy">
            ↳ {c}
          </span>
        ))}
      </div>
      <div className="mx-auto h-5 w-[3px] bg-ash" />
      <div className="rounded-[12px] bg-white p-4 shadow-[0_0_0_1px_rgba(31,42,68,0.08)]">
        <div className="font-[family-name:var(--font-sans)] text-[15px] font-medium">Policy guard rules</div>
        <ol className="mt-3 space-y-2">
          {RULES.map((r, idx) => (
            <li key={r.key} className="flex items-start gap-3 rounded-[8px] border border-ash-soft p-2 text-[12px]">
              <span className="pt-0.5 text-smoke">{idx + 1}</span>
              <span className="flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-sans)] text-graphite">
                key <span className="rounded-[5px] bg-parchment px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-navy">{r.key}</span>
                {r.text}
                {r.vals.map((v) => (
                  <span key={v} className="rounded-[5px] border border-ash-soft px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-navy">
                    {v}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ---------- 4 · deploy your way ----------------------------------------- */

const DEPLOY = [
  { t: "Demo", tags: ["Browser only", "Mock data", "Fast-forward clock"] },
  { t: "Pilot", tags: ["Shadow mode", "One depot", "No buyer contact"] },
  { t: "On-prem", tags: ["Regional gateway", "PII stays in", "Fine-tuned ASR"] },
];

function DeployArt() {
  return (
    <div className="relative flex h-[260px] w-full max-w-[460px] items-start">
      {DEPLOY.map((d, i) => (
        <motion.div
          key={d.t}
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: i * 26, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15, duration: 0.5 }}
          className="absolute w-[150px] rounded-[10px] bg-white p-3 shadow-[0_0_0_1px_rgba(31,42,68,0.08),0_8px_24px_rgba(31,42,68,0.06)]"
          style={{ left: i * 140 }}
        >
          <div className="flex items-start justify-between">
            <span className="grid size-10 place-items-center rounded-full border-2 border-orange text-orange">
              <Mark kind={i === 2 ? "square" : "dot"} size={18} ring="currentColor" />
            </span>
            <span className="text-good">
              <Mark kind="check" size={16} />
            </span>
          </div>
          <div className="mt-2 font-[family-name:var(--font-sans)] text-[20px] font-medium tracking-[-0.02em]">{d.t}</div>
          <div className="mt-2 space-y-1">
            {d.tags.map((t) => (
              <span key={t} className="block w-fit rounded-[5px] border border-ash-soft px-1.5 py-0.5 font-[family-name:var(--font-sans)] text-[10px] text-smoke">
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- section ------------------------------------------------------ */

function WideCard({ title, body, mark, children, wash }: { title: string; body: string; mark: "dot" | "check" | "square"; children: React.ReactNode; wash: string }) {
  return (
    <div className="relative grid min-h-[310px] items-center gap-8 overflow-hidden rounded-[16px] border border-ash p-6 md:grid-cols-[1fr_1.1fr] md:p-8">
      <Wash className="-right-10 top-1/2 h-[380px] w-[520px] -translate-y-1/2 opacity-80" colors={wash} />
      <div className="relative">
        <Mark kind={mark} size={30} className="text-navy" />
        <h3 className="t-h4 mt-6">{title}</h3>
        <p className="t-body-sans mt-4 max-w-[380px] text-[16px] leading-[1.4] text-graphite">{body}</p>
      </div>
      <div className="relative flex justify-center">{children}</div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <RevealText text="How Alodi Works" className="t-h1" />
        <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Reveal className="lg:row-span-3">
            <div className="relative h-full overflow-hidden rounded-[16px] border border-ash">
              <div className="relative p-6 md:p-8">
                <Mark kind="dot" size={30} className="text-navy" />
                <h3 className="t-h4 mt-6">One-Tap Rescue Pipeline</h3>
                <p className="t-body-sans mt-4 text-[16px] leading-[1.4] text-graphite">
                  One agent with four tools runs as a state machine per order. The courier’s tap starts it; the policy guard decides
                  when it stops.
                </p>
              </div>
              <div className="relative overflow-hidden px-4 pb-10 pt-4">
                <Wash className="left-1/2 top-[8%] h-[300px] w-[380px] -translate-x-1/2 opacity-80" colors="radial-gradient(circle, rgba(255,148,115,0.9), transparent 70%)" />
                <Wash className="bottom-[0%] left-1/2 h-[300px] w-[380px] -translate-x-1/2 opacity-80" colors="radial-gradient(circle, rgba(160,181,235,0.95), transparent 70%)" />
                <AgentPipeline />
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <WideCard
              mark="square"
              title="In-Flight Context Extraction"
              body="Turn a 74-second call into four typed fields before the courier reaches the next stop. Every field carries its own confidence."
              wash="radial-gradient(circle, rgba(167,252,205,0.9), rgba(160,181,235,0.6) 45%, transparent 70%)"
            >
              <ExtractionArt />
            </WideCard>
          </Reveal>
          <Reveal delay={0.1}>
            <WideCard
              mark="dot"
              title="Rule-Based Escalation"
              body="Quiet hours, contact caps and confidence thresholds are rules, not prompts. Anything high-stakes is routed to a person."
              wash="radial-gradient(circle, rgba(160,181,235,0.9), rgba(167,252,205,0.7) 50%, transparent 72%)"
            >
              <RulesArt />
            </WideCard>
          </Reveal>
          <Reveal delay={0.15}>
            <WideCard
              mark="check"
              title="Deploy Your Way"
              body="Browser demo today, shadow mode at one depot next, a regional on-prem gateway when the data has to stay in-house."
              wash="radial-gradient(circle, rgba(255,180,138,0.95), rgba(236,218,152,0.8) 50%, transparent 72%)"
            >
              <DeployArt />
            </WideCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
