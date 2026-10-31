"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { TechIcon } from "@/components/site/logos";

// C4 model of the production architecture (PRD §16, §16.7 OpenAI platform, §18.8 local-first deployment).
// Neutral, technical palette (white, greys, ink) with OpenAI green reserved for OpenAI-powered parts.
// Every box shows Demo (31 Oct, mock data) → Production and the flow steps that use it.

const EASE = [0.22, 1, 0.36, 1] as const;

type Kind = "person" | "core" | "container" | "external" | "store" | "openai";
type Node = { name: string; kind: Kind; tech?: string; prod?: string; d?: string; steps?: string };
type Rel = { from: string; to: string; label: string };

/* ---------- level 1 · system context ----------------------------------- */

const PEOPLE: Node[] = [
  { name: "Buyer", kind: "person", d: "Answers the window question, chats, takes the AI call" },
  { name: "Courier", kind: "person", d: "Delivers, taps one button, records a 10-second memo" },
  { name: "Customer service", kind: "person", d: "Handles escalations, approves labels and returns" },
  { name: "Dispatcher", kind: "person", d: "Watches the hub, reads context cards" },
];

const CARRIER: Node[] = [
  { name: "Route planner", kind: "external", tech: "4 fixed windows", prod: "SPX routing API", steps: "1" },
  { name: "OMS / order DB", kind: "external", tech: "Seed JSON", prod: "SPX order API", steps: "1" },
  { name: "Courier app backend", kind: "external", tech: "Next.js PWA", prod: "SPX driver app", steps: "3 · 4 · 7" },
  { name: "CS ticketing + hotline", kind: "external", tech: "Ops console", prod: "SPX dashboard", steps: "8" },
];

const SERVICES: Node[] = [
  { name: "OpenAI platform", kind: "openai", tech: "Responses API · TTS", prod: "Fallback only, masked text", steps: "2 · 5 · 6" },
  { name: "Chat channel", kind: "external", tech: "Simulated chat", prod: "Shopee Chat API · Zalo ZNS", steps: "2 · 5" },
  { name: "Telco", kind: "external", tech: "In-browser call", prod: "Viettel SIP, brand name", steps: "5" },
  { name: "Speech to text", kind: "external", tech: "AssemblyAI", prod: "PhoWhisper on the area server", steps: "5 · 6" },
];

const L1_RELS: Rel[] = [
  { from: "Courier", to: "Alodi", label: "taps No answer / Rescheduled / Refused, 2-minute undo" },
  { from: "Alodi", to: "Buyer", label: "asks for ≥ 2 windows, chats, calls only 08:00–20:30" },
  { from: "Alodi", to: "Courier", label: "pushes the context card for the next attempt" },
  { from: "Alodi", to: "Customer service", label: "escalates with a reason and a suggested label" },
  { from: "Alodi", to: "Route planner · OMS", label: "reads windows and today’s orders" },
  { from: "Alodi", to: "OpenAI", label: "masked text only, hardest ~10% of requests" },
];

/* ---------- level 2 · containers --------------------------------------- */

const CLIENTS: Node[] = [
  { name: "Courier app", kind: "container", tech: "Next.js PWA", prod: "SPX driver app", d: "One tap, memo, context card", steps: "3 · 4 · 7" },
  { name: "Ops / CS console", kind: "container", tech: "Next.js", prod: "SPX dashboard screen", d: "Live cases, exception queue, approvals", steps: "8" },
  { name: "Buyer channel", kind: "container", tech: "Next.js, demo only", prod: "Shopee Chat · Zalo · phone", d: "Quick replies, the AI call", steps: "2 · 5" },
];

const BACKEND: Node[] = [
  { name: "API + realtime hub", kind: "container", tech: "FastAPI", prod: "FastAPI behind Caddy", d: "REST + WebSocket, one state for every screen", steps: "1–8" },
  { name: "Alodi Agent", kind: "core", tech: "State machine + tool calling", prod: "OpenAI Agents SDK", d: "One run per order: tools, handoff to CS, traces", steps: "2–8" },
  { name: "Model gateway", kind: "openai", tech: "OpenAI API", prod: "gpt-oss-20b on vLLM → OpenAI fallback", d: "One endpoint; masked text out", steps: "2 · 5 · 6" },
  { name: "Policy guard", kind: "container", tech: "Plain code", prod: "Plain code + SDK guardrails", d: "Quiet hours, caps, opt-out, 0.85 threshold", steps: "4–8" },
  { name: "Scheduler", kind: "container", tech: "Fast-forward clock", prod: "Redis + Temporal", d: "2′ undo, 60′, +2 h; reloads the order first", steps: "4 · 5" },
];

const STORES: Node[] = [
  { name: "Alodi DB", kind: "store", tech: "SQLite", prod: "PostgreSQL", d: "Orders, events, rescue cases and results", steps: "2–8" },
  { name: "Recordings vault", kind: "store", tech: "Folder", prod: "MinIO, encrypted", d: "Memo and call audio, 30-day TTL", steps: "6" },
  { name: "Events + traces", kind: "store", tech: "Append-only table", prod: "+ Agents SDK traces", d: "Audit trail, four key metrics, eval input", steps: "1–8" },
];

/* ---------- level 3 · agent components --------------------------------- */

const TOOLS: Node[] = [
  { name: "ask_window", kind: "container", tech: "function tool", d: "≥ 2 windows from the route planner", steps: "2" },
  { name: "send_chat", kind: "container", tech: "function tool", d: "Rescue message the moment of the tap", steps: "2 · 5" },
  { name: "ai_call", kind: "container", tech: "function tool", d: "Recorded opening + TTS, ≤ 90 s", steps: "5" },
  { name: "extract", kind: "openai", tech: "Structured Outputs", d: "Strict JSON with confidence per field", steps: "5 · 6" },
  { name: "handoff_cs", kind: "container", tech: "handoff", d: "Opens a CS case with a reason", steps: "8" },
];

const GUARD = [
  ["08:00–20:30", "calls only"],
  ["≤ 2", "calls per cycle"],
  ["≤ 2", "redeliveries, 5 days"],
  ["≥ 0.85", "every field, or a person"],
  ["Refused", "no buyer contact"],
  ["Labels", "a person approves"],
];

/* ---------- OpenAI core (production) ------------------------------------ */

const OPENAI = [
  { name: "gpt-oss-20b", role: "Agent decisions and extraction", where: "Area server, vLLM · open weights", stage: "Production" },
  { name: "Agents SDK", role: "Per-order agent, tools, guardrails, CS handoff, tracing", where: "Alodi backend", stage: "Production" },
  { name: "Responses API", role: "Tool calling and Structured Outputs; masked fallback for the hardest ~10%", where: "OpenAI cloud · gpt-5-mini", stage: "Demo + production" },
  { name: "gpt-4o-mini-tts", role: "Dynamic voice lines inside the AI call", where: "OpenAI cloud", stage: "Demo + production" },
  { name: "gpt-4o-transcribe", role: "Second opinion when local ASR is unsure", where: "OpenAI cloud · masked audio turns", stage: "Production" },
  { name: "Evals", role: "Graders on the held-out set; gate every prompt or model change", where: "OpenAI platform", stage: "Production" },
  { name: "Codex", role: "Build, review and run the eval loop", where: "CLI · cloud · GitHub", stage: "Today" },
];

/* ---------- deployment -------------------------------------------------- */

const DEPLOY = [
  {
    k: "Demo · 31 Oct",
    note: "One VM on a 4G hotspot",
    rows: [
      ["Compose", "caddy · web · api (agent + scheduler)"],
      ["Data", "SQLite, recordings folder, mock hub"],
      ["Models", "OpenAI API, OpenAI TTS, AssemblyAI"],
      ["Screens", "Phone · iPad · laptop · control"],
    ],
  },
  {
    k: "Production · per area",
    note: "Local-first, one workstation + UPS",
    rows: [
      ["GPU 1", "gpt-oss-20b on vLLM"],
      ["GPU 2", "PhoWhisper + Piper TTS"],
      ["Data", "PostgreSQL · Redis · Temporal · MinIO"],
      ["Out", "SIP · Zalo ZNS · OpenAI fallback · S3 backup"],
    ],
  },
  {
    k: "Many areas",
    note: "When one box is not enough",
    rows: [
      ["Compute", "Kubernetes per region, GPU pool"],
      ["Data", "PostgreSQL HA, Temporal, object storage"],
      ["Edge", "Model gateway in the trusted zone"],
      ["Rule", "Same interfaces; implementations swap"],
    ],
  },
];

/* ---------- flow · eight steps ----------------------------------------- */

const STEPS = [
  { n: 1, t: "Load orders + windows", d: "Every morning, per area" },
  { n: 2, t: "Ask for a window", d: "≥ 2 options, or “can’t today”" },
  { n: 3, t: "Note to the courier", d: "No reply: deliver as planned" },
  { n: 4, t: "Deliver, tap the outcome", d: "A / B / Refused, 2′ undo" },
  { n: 5, t: "Flow A · no answer", d: "Chat → 60′ call → +2 h call → CS" },
  { n: 6, t: "Flow B · rescheduled", d: "Memo → ASR → mask → JSON" },
  { n: 7, t: "Save the appointment", d: "Context card for next attempt" },
  { n: 8, t: "CS decides", d: "A person labels and returns" },
];

/* ---------- pieces ------------------------------------------------------- */

function Box({ n, dense = false }: { n: Node; dense?: boolean }) {
  const core = n.kind === "core";
  const oa = n.kind === "openai";
  const ext = n.kind === "external";
  return (
    <div
      className={`relative h-full rounded-[12px] px-3.5 py-3 ${
        core ? "bg-[var(--oa-ink)] text-white" : oa ? "border border-[var(--oa-green-line)] bg-[var(--oa-green-soft)]" : ext ? "border border-dashed border-[var(--oa-line-strong)]" : "border border-[var(--oa-line)] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className={`flex items-center gap-1.5 text-[14px] font-medium tracking-[-0.01em] ${core ? "text-white" : "text-[var(--oa-ink)]"}`}>
          {oa && <TechIcon icon="siOpenai" size={13} mono className="text-[var(--oa-green)]" />}
          {n.kind === "store" && <span className="text-[var(--oa-muted)]">▤</span>}
          {n.name}
        </div>
        {n.steps && <span className={`shrink-0 whitespace-nowrap font-[family-name:var(--font-mono)] text-[10px] ${core ? "text-white/55" : "text-[var(--oa-muted)]"}`}>step {n.steps}</span>}
      </div>
      {n.tech && (
        <div className={`mt-1.5 font-[family-name:var(--font-mono)] text-[11px] leading-[1.45] ${core ? "text-white/60" : "text-[var(--oa-muted)]"}`}>
          {n.prod ? "demo  " : ""}
          {n.tech}
          {n.prod && (
            <>
              <br />
              <span className={core ? "text-white" : oa ? "text-[var(--oa-green)]" : "text-[var(--oa-ink)]"}>prod  {n.prod}</span>
            </>
          )}
        </div>
      )}
      {!dense && n.d && <div className={`mt-1.5 text-[13px] leading-[1.4] ${core ? "text-white/80" : "text-[var(--oa-text-2)]"}`}>{n.d}</div>}
    </div>
  );
}

function Boundary({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[16px] border border-[var(--oa-line)] bg-[var(--oa-subtle)] p-2.5 ${className}`}>
      <div className="px-1.5 pb-2 pt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--oa-muted)]">{label}</div>
      {children}
    </div>
  );
}

function Rels({ rels }: { rels: Rel[] }) {
  return (
    <ul className="mt-4 grid gap-x-8 gap-y-2 border-t border-[var(--oa-line)] pt-4 md:grid-cols-2">
      {rels.map((r) => (
        <li key={r.from + r.to} className="flex gap-2 text-[13px] leading-[1.4] text-[var(--oa-text-2)]">
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[12px] text-[var(--oa-ink)]">
            {r.from} → {r.to}
          </span>
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- views -------------------------------------------------------- */

function Context() {
  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr_1fr]">
        <Boundary label="People">
          <div className="grid gap-2">
            {PEOPLE.map((p) => (
              <Box key={p.name} n={p} />
            ))}
          </div>
        </Boundary>
        <div className="flex flex-col gap-3">
          <div className="rounded-[16px] bg-[var(--oa-ink)] p-6 text-white">
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-white/50">Software system</div>
            <div className="mt-3 font-[family-name:var(--font-logo)] text-[34px] font-extrabold leading-none tracking-[-0.03em]">alodi</div>
            <p className="mt-4 text-[14px] leading-[1.45] text-white/75">
              Talks to the buyer at the right time and writes structured context back to the carrier. Replaces nothing; fails open.
            </p>
          </div>
          <Boundary label="Carrier systems · SPX" className="flex-1">
            <div className="grid gap-2 sm:grid-cols-2">
              {CARRIER.map((c) => (
                <Box key={c.name} n={c} dense />
              ))}
            </div>
          </Boundary>
        </div>
        <Boundary label="External services">
          <div className="grid gap-2">
            {SERVICES.map((s) => (
              <Box key={s.name} n={s} dense />
            ))}
          </div>
        </Boundary>
      </div>
      <Rels rels={L1_RELS} />
    </div>
  );
}

function Containers() {
  return (
    <div className="grid gap-3">
      <Boundary label="Clients">
        <div className="grid gap-2 md:grid-cols-3">
          {CLIENTS.map((c) => (
            <Box key={c.name} n={c} />
          ))}
        </div>
      </Boundary>
      <div className="text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--oa-muted)]">↓ https / wss · rest + websocket</div>
      <Boundary label="Alodi backend">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {BACKEND.map((c) => (
            <Box key={c.name} n={c} />
          ))}
        </div>
      </Boundary>
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Boundary label="Alodi data · PII stays in">
          <div className="grid gap-2 md:grid-cols-3">
            {STORES.map((c) => (
              <Box key={c.name} n={c} />
            ))}
          </div>
        </Boundary>
        <Boundary label="External · masked text only">
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map((s) => (
              <Box key={s.name} n={s} dense />
            ))}
          </div>
        </Boundary>
      </div>
    </div>
  );
}

function Components() {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.75fr_1fr]">
      <Boundary label="Container · Alodi Agent (OpenAI Agents SDK)">
        <div className="rounded-[12px] bg-[var(--oa-ink)] px-4 py-3.5 text-white">
          <div className="flex items-center gap-2 text-[14px] font-medium">
            <TechIcon icon="siOpenai" size={14} mono className="text-white" /> Agent run, one per order
          </div>
          <div className="mt-1.5 font-[family-name:var(--font-mono)] text-[11px] text-white/65">pre → delivering → chat → call 1 → call 2 → extract → ready · review · cs → closed</div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {TOOLS.map((t) => (
            <Box key={t.name} n={t} />
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Box n={{ name: "Order Context Object", kind: "store", tech: "versioned JSON", d: "Who changed what and when" }} />
          <Box n={{ name: "Decision", kind: "container", tech: "auto_applied · needs_review · escalated_cs", d: "Every field ≥ 0.85 applies; lower goes to chat or CS" }} />
        </div>
      </Boundary>
      <Boundary label="Policy guard · before every action">
        <ul className="grid gap-2">
          {GUARD.map(([k, v]) => (
            <li key={k + v} className="flex items-baseline justify-between gap-3 rounded-[10px] border border-[var(--oa-line)] bg-white px-3.5 py-2.5">
              <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--oa-ink)]">{k}</span>
              <span className="text-right text-[13px] text-[var(--oa-text-2)]">{v}</span>
            </li>
          ))}
        </ul>
      </Boundary>
    </div>
  );
}

function OpenAICore() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--oa-line)]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--oa-ink)] px-5 py-4 text-white">
        <span className="flex items-center gap-2.5 text-[15px] font-medium">
          <TechIcon icon="siOpenai" size={18} mono className="text-white" /> OpenAI at the core
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/60">production design · demo runs a subset</span>
      </div>
      <ul className="divide-y divide-[var(--oa-line)] bg-white">
        {OPENAI.map((o, i) => (
          <motion.li
            key={o.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
            className="grid gap-1 px-5 py-3.5 md:grid-cols-[200px_1fr_220px_130px] md:items-center md:gap-6"
          >
            <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--oa-ink)]">
              <span className="size-1.5 rounded-full bg-[var(--oa-green)]" />
              {o.name}
            </span>
            <span className="text-[13px] leading-[1.4] text-[var(--oa-text-2)]">{o.role}</span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-muted)]">{o.where}</span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-green)] md:text-right">{o.stage}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Deployment() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {DEPLOY.map((d, i) => (
        <div key={d.k} className={`rounded-[16px] p-5 ${i === 1 ? "bg-[var(--oa-ink)] text-white" : "border border-[var(--oa-line)] bg-white"}`}>
          <div className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] ${i === 1 ? "text-white/50" : "text-[var(--oa-muted)]"}`}>{d.note}</div>
          <div className={`mt-2 text-[18px] font-medium tracking-[-0.01em] ${i === 1 ? "text-white" : "text-[var(--oa-ink)]"}`}>{d.k}</div>
          <dl className="mt-4 grid gap-2.5">
            {d.rows.map(([k, v]) => (
              <div key={k} className={`grid grid-cols-[74px_1fr] gap-3 border-t pt-2.5 ${i === 1 ? "border-white/12" : "border-[var(--oa-line)]"}`}>
                <dt className={`font-[family-name:var(--font-mono)] text-[11px] uppercase ${i === 1 ? "text-white/50" : "text-[var(--oa-muted)]"}`}>{k}</dt>
                <dd className={`text-[13px] leading-[1.4] ${i === 1 ? "text-white/85" : "text-[var(--oa-text-2)]"}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Flow() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[16px] border border-[var(--oa-line)] bg-[var(--oa-line)] sm:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((s) => (
        <li key={s.n} className="bg-white p-5">
          <span className={`font-[family-name:var(--font-mono)] text-[12px] ${s.n === 8 ? "text-[var(--oa-ink)]" : "text-[var(--oa-muted)]"}`}>0{s.n}</span>
          <div className="mt-3 text-[14px] font-medium text-[var(--oa-ink)]">{s.t}</div>
          <div className="mt-1 text-[13px] leading-[1.4] text-[var(--oa-text-2)]">{s.d}</div>
        </li>
      ))}
    </ol>
  );
}

const LEVELS = [
  { k: "L1", label: "Context", hint: "Who uses Alodi and what it talks to", View: Context },
  { k: "L2", label: "Containers", hint: "What runs where, demo → production", View: Containers },
  { k: "L3", label: "Agent", hint: "Inside the agent: tools, handoff, guard", View: Components },
  { k: "AI", label: "OpenAI core", hint: "The OpenAI parts of the production design", View: OpenAICore },
  { k: "D", label: "Deployment", hint: "Demo VM, one server per area, then regions", View: Deployment },
  { k: "→", label: "Flow", hint: "The eight business steps the agent runs", View: Flow },
];

export function C4Architecture() {
  const [i, setI] = useState(0);
  const L = LEVELS[i];
  return (
    <div className="oa-panel rounded-[24px] border border-[var(--oa-line)] bg-white p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1">
        <div role="tablist" aria-label="C4 level" className="flex gap-0.5 overflow-x-auto rounded-full bg-[var(--oa-subtle)] p-1">
          {LEVELS.map((l, j) => (
            <button
              key={l.k}
              role="tab"
              aria-selected={i === j}
              onClick={() => setI(j)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${i === j ? "text-[var(--oa-ink)]" : "text-[var(--oa-muted)] hover:text-[var(--oa-ink)]"}`}
            >
              {i === j && <motion.span layoutId="c4-tab" className="absolute inset-0 rounded-full bg-white shadow-[0_0_0_1px_var(--oa-line),0_1px_2px_rgba(0,0,0,0.06)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <span className="relative">
                <span className="mr-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-muted)]">{l.k}</span>
                {l.label}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.04em] text-[var(--oa-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-[var(--oa-ink)]" /> core
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-[var(--oa-green-line)] bg-[var(--oa-green-soft)]" /> openai
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-[var(--oa-line)] bg-white" /> alodi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-dashed border-[var(--oa-line-strong)]" /> external
          </span>
        </div>
      </div>
      <p className="px-2 pt-3 text-[13px] text-[var(--oa-text-2)]">{L.hint}</p>

      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.div key={L.k} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(4px)" }} transition={{ duration: 0.35, ease: EASE }}>
            <L.View />
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="px-2 pb-1 pt-4 font-[family-name:var(--font-mono)] text-[11px] text-[var(--oa-muted)]">Source: PRD §16 architecture, §16.7 OpenAI platform, §18.8 local-first deployment</p>
    </div>
  );
}
