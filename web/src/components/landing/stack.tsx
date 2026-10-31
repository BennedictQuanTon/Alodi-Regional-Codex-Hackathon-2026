"use client";

import { motion, useReducedMotion } from "motion/react";
import { siOpenai } from "simple-icons";
import { TECH_DEMO, TECH_PROD, type Tech } from "@/lib/content";
import { TechIcon } from "@/components/site/logos";
import { Reveal, RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- OpenAI at the core: one orchestrator, specialist workers ------ */

type Worker = { x: number; y: number; name: string; tool: string; model: string };
const W = 1100;
const H = 440;
const HUB = { x: W / 2, y: H / 2, w: 300, h: 92 };
const WORKERS: Worker[] = [
  { x: 170, y: 70, name: "Window", tool: "ask_window", model: "gpt-oss-20b" },
  { x: 550, y: 52, name: "Rescue chat", tool: "send_chat", model: "gpt-oss-20b" },
  { x: 930, y: 70, name: "Voice", tool: "ai_call", model: "gpt-4o-mini-tts" },
  { x: 170, y: 370, name: "Extractor", tool: "extract", model: "Structured Outputs · strict JSON" },
  { x: 550, y: 388, name: "Fallback", tool: "responses", model: "gpt-5-mini · masked text" },
  { x: 930, y: 370, name: "Guardrails", tool: "guard", model: "code + SDK guardrails" },
];
const NODE = { w: 232, h: 70 };

function link(w: Worker) {
  const top = w.y < HUB.y;
  const sy = top ? w.y + NODE.h / 2 : w.y - NODE.h / 2;
  const ey = top ? HUB.y - HUB.h / 2 : HUB.y + HUB.h / 2;
  const ex = HUB.x + (w.x - HUB.x) * 0.32;
  const my = (sy + ey) / 2;
  return `M${w.x},${sy} C${w.x},${my} ${ex},${my} ${ex},${ey}`;
}

function OpenAIGlyph({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${size / 24})`}>
      <path d={siOpenai.path} fill={color} />
    </g>
  );
}

function AgentMesh() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="One Alodi agent built on the OpenAI Agents SDK hands work to six specialist workers">
      {WORKERS.map((w, i) => (
        <g key={w.name}>
          <motion.path
            d={link(w)}
            fill="none"
            stroke="#d4d4d4"
            strokeWidth={1.2}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.2 + i * 0.08, duration: 1, ease: EASE }}
          />
          {!reduce && (
            <circle r={3} fill="#0e8a6c">
              <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" path={link(w)} keyPoints={w.y < HUB.y ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear" />
            </circle>
          )}
        </g>
      ))}

      {WORKERS.map((w, i) => (
        <motion.g
          key={w.name}
          initial={{ opacity: 0, y: w.y < HUB.y ? -10 : 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.35 + i * 0.08, duration: 0.6, ease: EASE }}
        >
          <rect x={w.x - NODE.w / 2} y={w.y - NODE.h / 2} width={NODE.w} height={NODE.h} rx={16} fill="#ffffff" stroke="#e5e5e5" />
          <OpenAIGlyph x={w.x - NODE.w / 2 + 16} y={w.y - 22} size={14} color="#0e8a6c" />
          <text x={w.x - NODE.w / 2 + 38} y={w.y - 10} fontSize="15" fontWeight={500} fill="#0d0d0d" fontFamily="var(--font-sans)">
            {w.name}
          </text>
          <text x={w.x + NODE.w / 2 - 16} y={w.y - 10} fontSize="11" fill="#8f8f8f" textAnchor="end" fontFamily="var(--font-mono)">
            {w.tool}
          </text>
          <text x={w.x - NODE.w / 2 + 16} y={w.y + 18} fontSize="12" fill="#5d5d5d" fontFamily="var(--font-mono)">
            {w.model}
          </text>
        </motion.g>
      ))}

      <motion.g initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, ease: EASE }} style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
        <rect x={HUB.x - HUB.w / 2} y={HUB.y - HUB.h / 2} width={HUB.w} height={HUB.h} rx={HUB.h / 2} fill="#0d0d0d" />
        <OpenAIGlyph x={HUB.x - HUB.w / 2 + 30} y={HUB.y - 14} size={28} color="#ffffff" />
        <text x={HUB.x - HUB.w / 2 + 74} y={HUB.y - 4} fontSize="17" fontWeight={500} fill="#ffffff" fontFamily="var(--font-sans)">
          Alodi Agent
        </text>
        <text x={HUB.x - HUB.w / 2 + 74} y={HUB.y + 18} fontSize="12" fill="rgba(255,255,255,0.6)" fontFamily="var(--font-mono)">
          Agents SDK · gpt-oss-20b
        </text>
      </motion.g>
    </svg>
  );
}

const MESH_FOOT = [
  ["Distributed", "each worker is a task on a Temporal queue; the agent survives restarts"],
  ["Local-first", "gpt-oss-20b on the area server; the cloud sees masked text only"],
  ["Gated", "OpenAI Evals on the held-out set before any prompt or model change"],
];

function OpenAICore() {
  return (
    <div className="oa-panel overflow-hidden rounded-[24px] border border-[var(--oa-line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--oa-line)] px-6 py-4">
        <span className="flex items-center gap-2.5 text-[15px] font-medium">
          <TechIcon icon="siOpenai" size={18} mono /> OpenAI at the core
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-muted)]">production design · the demo runs the OpenAI API</span>
      </div>
      <div className="hidden px-6 py-8 md:block">
        <AgentMesh />
      </div>
      <ul className="grid gap-2 p-4 md:hidden">
        <li className="flex items-center gap-2 rounded-[14px] bg-[var(--oa-ink)] px-4 py-3 text-white">
          <TechIcon icon="siOpenai" size={16} mono /> Alodi Agent · Agents SDK · gpt-oss-20b
        </li>
        {WORKERS.map((w) => (
          <li key={w.name} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--oa-line)] px-4 py-3 text-[14px]">
            <span className="flex items-center gap-2">
              <TechIcon icon="siOpenai" size={12} mono className="text-[var(--oa-green)]" />
              {w.name}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-muted)]">{w.model}</span>
          </li>
        ))}
      </ul>
      <dl className="grid border-t border-[var(--oa-line)] md:grid-cols-3">
        {MESH_FOOT.map(([k, v], i) => (
          <div key={k} className={`px-6 py-5 ${i > 0 ? "border-t border-[var(--oa-line)] md:border-l md:border-t-0" : ""}`}>
            <dt className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.04em] text-[var(--oa-green)]">{k}</dt>
            <dd className="mt-1.5 text-[13px] leading-[1.45] text-[var(--oa-text-2)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------- marquees ------------------------------------------------------ */

function Chip({ t }: { t: Tech }) {
  return (
    <li className="mq-chip" title={t.note}>
      {t.icon ? (
        <TechIcon icon={t.icon} size={24} mono />
      ) : (
        <span className="mq-mono" aria-hidden>
          {t.mono}
        </span>
      )}
      <span>{t.name}</span>
    </li>
  );
}

/** Infinite loop: the list is rendered twice and shifted by exactly one copy. Never pauses. */
function Marquee({ items, reverse = false, seconds }: { items: Tech[]; reverse?: boolean; seconds: number }) {
  return (
    <div className="mq">
      <div className={`mq-track ${reverse ? "mq-reverse" : ""}`} style={{ animationDuration: `${seconds}s` }}>
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined}>
            {items.map((t) => (
              <Chip key={t.name} t={t} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function Stack() {
  return (
    <section id="tech" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <div className="t-eyebrow">Tech stack</div>
            </Reveal>
            <RevealText text="One agent, six workers, OpenAI at the core." className="t-h1 mt-6 max-w-[760px]" stagger={0.035} />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[440px] text-[18px] leading-[1.4] text-graphite lg:ml-auto">
              Cloud APIs on demo day. One server per area in production, with the same interfaces.
            </p>
          </Reveal>
        </div>
        <Reveal className="mt-10">
          <OpenAICore />
        </Reveal>
      </div>
      <Reveal className="mt-12 grid gap-2">
        <div className="container-page text-[12px] uppercase text-smoke">Demo · 31 Oct</div>
        <Marquee items={TECH_DEMO} seconds={50} />
        <div className="container-page mt-6 text-[12px] uppercase text-smoke">Production · per area</div>
        <Marquee items={TECH_PROD} seconds={56} reverse />
      </Reveal>
    </section>
  );
}
