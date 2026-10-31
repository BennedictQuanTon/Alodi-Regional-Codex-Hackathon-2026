"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { SourceNote } from "@/components/site/brand";

// C4 model of the current architecture (prep/02-technical/diagrams/alodi-architecture.png, PRD §16 and §18.8).
// Every box shows Demo (31 Oct, mock data) → Production (inside the carrier) and the flow steps that use it.

const EASE = [0.22, 1, 0.36, 1] as const;

type Kind = "person" | "system" | "container" | "external" | "store";
type Node = { name: string; kind: Kind; tech?: string; prod?: string; d: string; steps?: string };
type Rel = { from: string; to: string; label: string };

/* ---------- level 1 · system context ----------------------------------- */

const PEOPLE: Node[] = [
  { name: "Buyer", kind: "person", d: "Answers the window question, chats, takes the AI call" },
  { name: "Courier", kind: "person", d: "Delivers, taps one button, records a 10-second memo" },
  { name: "Customer service", kind: "person", d: "Handles escalations, approves labels and returns" },
  { name: "Dispatcher", kind: "person", d: "Watches the hub, reads context cards" },
];

const CARRIER: Node[] = [
  { name: "Route planner", kind: "external", tech: "4 fixed windows (JSON)", prod: "SPX routing API", d: "Feasible delivery windows", steps: "1" },
  { name: "OMS / order DB", kind: "external", tech: "Seed JSON, 4,000 orders", prod: "SPX order API", d: "Today’s orders, COD, address", steps: "1" },
  { name: "Courier app backend", kind: "external", tech: "Next.js PWA", prod: "SPX driver app", d: "Button events in, context card out", steps: "3 · 4 · 7" },
  { name: "CS ticketing + hotline", kind: "external", tech: "Ops console", prod: "Screen in SPX dashboard", d: "Escalations and call-backs", steps: "8" },
];

const SERVICES: Node[] = [
  { name: "Chat channel", kind: "external", tech: "Simulated chat", prod: "Shopee Chat API · Zalo ZNS", d: "Window question and rescue chat", steps: "2 · 5" },
  { name: "Call + TTS", kind: "external", tech: "WebRTC + OpenAI TTS", prod: "SIP brand name + Vietnamese TTS", d: "AI calls, at most two per cycle", steps: "5" },
  { name: "Speech to text", kind: "external", tech: "AssemblyAI", prod: "PhoWhisper, self-hosted", d: "Call audio and voice memos", steps: "5 · 6" },
  { name: "LLM", kind: "external", tech: "OpenAI API", prod: "gpt-oss-20b on the area server", d: "Tool calling, Structured Outputs", steps: "2 · 5 · 6" },
];

const L1_RELS: Rel[] = [
  { from: "Courier", to: "Alodi", label: "taps No answer / Rescheduled / Refused (2-minute undo)" },
  { from: "Alodi", to: "Buyer", label: "asks for ≥ 2 windows, chats, calls only 08:00–20:30" },
  { from: "Alodi", to: "Courier", label: "pushes the context card for the next attempt" },
  { from: "Alodi", to: "Customer service", label: "escalates with a reason and a suggested label" },
  { from: "Alodi", to: "Route planner · OMS", label: "reads windows and today’s orders" },
  { from: "Alodi", to: "LLM", label: "sends masked text only" },
];

/* ---------- level 2 · containers --------------------------------------- */

const CLIENTS: Node[] = [
  { name: "Courier app", kind: "container", tech: "Next.js PWA · phone", prod: "Inside the SPX driver app", d: "One tap, memo, context card", steps: "3 · 4 · 7" },
  { name: "Ops / CS console", kind: "container", tech: "Next.js · iPad", prod: "Screen in the SPX dashboard", d: "Live cases, exception queue, approvals", steps: "8" },
  { name: "Buyer channel", kind: "container", tech: "Next.js · laptop, demo only", prod: "Shopee Chat · Zalo · phone", d: "Chat with quick replies, the AI call", steps: "2 · 5" },
];

const BACKEND: Node[] = [
  { name: "API + realtime hub", kind: "container", tech: "FastAPI · REST + WebSocket", prod: "Same, behind Caddy", d: "One source of truth, fans state out to every screen", steps: "1–8" },
  { name: "Alodi Agent", kind: "system", tech: "State machine + LLM tool calling", prod: "Same", d: "Decides the next step from the order state and the latest event", steps: "2–8" },
  { name: "Policy guard", kind: "container", tech: "Plain code, not a prompt", prod: "Same", d: "Quiet hours, call caps, opt-out, consent, 0.85 threshold", steps: "4–8" },
  { name: "Scheduler", kind: "container", tech: "APScheduler + fast-forward clock", prod: "Redis + Temporal", d: "2′ undo, 60′ call 1, +2 h call 2; reloads the order first", steps: "4 · 5" },
  { name: "PII masking", kind: "container", tech: "Regex + Presidio", prod: "Model gateway, trusted zone", d: "Phones, names, addresses masked before any model", steps: "6" },
];

const STORES: Node[] = [
  { name: "Alodi DB", kind: "store", tech: "SQLite", prod: "PostgreSQL (HA)", d: "availability_reply · shipper_event · rescue_case · rescue_result", steps: "2–8" },
  { name: "Recordings vault", kind: "store", tech: "Folder on the VM", prod: "MinIO / S3, encrypted", d: "Memo and call audio, 30-day TTL", steps: "6" },
  { name: "Events log", kind: "store", tech: "Append-only table", prod: "Same", d: "Audit trail and the four key metrics", steps: "1–8" },
];

/* ---------- level 3 · agent components --------------------------------- */

const TOOLS: Node[] = [
  { name: "ask_window", kind: "container", tech: "tool", d: "≥ 2 windows from the route planner as quick replies", steps: "2" },
  { name: "send_chat", kind: "container", tech: "tool", d: "Rescue message the moment the courier taps", steps: "2 · 5" },
  { name: "ai_call", kind: "container", tech: "tool", d: "Recorded opening + TTS; ASR on the buyer; ≤ 90 s", steps: "5" },
  { name: "extract", kind: "container", tech: "tool", d: "Strict JSON: window, drop-off, alt receiver, address fix, confidence", steps: "5 · 6" },
  { name: "escalate", kind: "container", tech: "tool", d: "Opens a CS case with a reason and an optional label", steps: "8" },
];

const GUARD = [
  ["08:00–20:30", "calls only"],
  ["≤ 2", "calls per cycle"],
  ["≤ 2", "redeliveries, 5-day horizon"],
  ["≥ 0.85", "every field, or a person confirms"],
  ["Refused", "no buyer contact"],
  ["Labels", "suggested, approved by a person"],
];

/* ---------- deployment -------------------------------------------------- */

const DEPLOY = [
  {
    k: "Demo · 31 Oct",
    note: "One VM on a 4G hotspot",
    rows: [
      ["Docker Compose", "caddy · web (Next.js) · api (FastAPI + agent + scheduler)"],
      ["Data", "SQLite, recordings folder, mock data for one hub"],
      ["Models", "OpenAI API, OpenAI TTS, AssemblyAI"],
      ["Screens", "Phone /courier · iPad /ops · laptop /buyer · /control"],
    ],
  },
  {
    k: "Production · per area",
    note: "Local-first, one workstation + UPS",
    rows: [
      ["GPU 1", "gpt-oss-20b via vLLM / Ollama: decisions and extraction"],
      ["GPU 2", "PhoWhisper ASR + Piper TTS"],
      ["Data", "PostgreSQL · Redis · Temporal · MinIO, RAID 1"],
      ["Out", "Viettel SIP · Zalo ZNS · OpenAI fallback (~10%, masked) · nightly S3 backup"],
    ],
  },
  {
    k: "Many areas",
    note: "When one box is not enough",
    rows: [
      ["Compute", "Kubernetes per region, shared GPU pool"],
      ["Data", "PostgreSQL HA, Redis + Temporal, object storage"],
      ["Edge", "Model gateway in the trusted zone, SIP trunk"],
      ["Rule", "Same interfaces as the demo; only implementations swap"],
    ],
  },
];

/* ---------- flow · eight steps ----------------------------------------- */

const STEPS = [
  { n: 1, t: "Load today’s orders + windows", d: "Every morning, per area" },
  { n: 2, t: "Ask the buyer for a window", d: "≥ 2 options, or “can’t today” + reason" },
  { n: 3, t: "Window note to the courier", d: "No reply: deliver as planned" },
  { n: 4, t: "Deliver, tap the outcome", d: "A / B / Refused, 2-minute undo" },
  { n: 5, t: "Flow A · no answer", d: "Chat → 60′ call 1 → +2 h call 2 → CS" },
  { n: 6, t: "Flow B · rescheduled", d: "10 s memo → ASR → mask → JSON" },
  { n: 7, t: "Save the new appointment", d: "Context card for the next attempt" },
  { n: 8, t: "CS decides", d: "Refused, unreachable, low confidence; a person labels" },
];

/* ---------- pieces ------------------------------------------------------- */

function Box({ n, dense = false }: { n: Node; dense?: boolean }) {
  const core = n.kind === "system";
  const ext = n.kind === "external";
  return (
    <div
      className={`relative h-full rounded-[12px] px-4 py-3.5 ${
        core ? "bg-navy text-parchment" : ext ? "border border-dashed border-ash bg-transparent" : "border border-ash bg-paper"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className={`t-body-sans text-[15px] font-medium ${core ? "text-parchment" : "text-navy"}`}>
          {n.kind === "store" && <span className="mr-1.5 text-smoke">▤</span>}
          {n.name}
        </div>
        {n.steps && <span className={`shrink-0 whitespace-nowrap text-[10px] uppercase ${core ? "text-peach" : "text-orange-deep"}`}>step {n.steps}</span>}
      </div>
      {n.tech && (
        <div className={`mt-1 text-[11px] ${core ? "text-parchment/70" : "text-smoke"}`}>
          {n.prod ? "Demo " : ""}[{n.tech}]
        </div>
      )}
      {n.prod && <div className={`text-[11px] ${core ? "text-parchment/70" : "text-smoke"}`}>Prod [{n.prod}]</div>}
      {!dense && <div className={`t-body-sans mt-1.5 text-[13px] leading-[1.4] ${core ? "text-parchment/85" : "text-graphite"}`}>{n.d}</div>}
    </div>
  );
}

function Boundary({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[16px] border border-dashed border-navy/30 p-3 pt-2 ${className}`}>
      <div className="mb-2 px-1 text-[11px] uppercase tracking-[0.04em] text-smoke">{label}</div>
      {children}
    </div>
  );
}

function Rels({ rels }: { rels: Rel[] }) {
  return (
    <ul className="mt-5 grid gap-x-8 gap-y-2 border-t border-ash pt-4 md:grid-cols-2">
      {rels.map((r) => (
        <li key={r.from + r.to + r.label} className="t-body-sans flex gap-2 text-[13px] leading-[1.4] text-graphite">
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[12px] text-navy">
            {r.from} → {r.to}
          </span>
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- levels ------------------------------------------------------- */

function Context() {
  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr_1fr]">
        <Boundary label="People">
          <div className="grid gap-2">
            {PEOPLE.map((p) => (
              <Box key={p.name} n={p} />
            ))}
          </div>
        </Boundary>
        <div className="flex flex-col justify-center gap-3">
          <div className="rounded-[16px] bg-navy p-6 text-parchment">
            <div className="text-[11px] uppercase text-peach">Software system</div>
            <div className="t-h3 mt-2 !text-parchment">Alodi</div>
            <p className="t-body-sans mt-3 text-[14px] leading-[1.45] text-parchment/85">
              Rescues failed deliveries: talks to the buyer at the right time and writes structured context back to the
              carrier. Replaces nothing; fails open.
            </p>
          </div>
          <Boundary label="Carrier systems · SPX">
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
      <div className="text-center text-[11px] uppercase text-smoke">↓ HTTPS / WSS · REST + WebSocket ↓</div>
      <Boundary label="Alodi backend · one API, one agent">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {BACKEND.map((c) => (
            <Box key={c.name} n={c} />
          ))}
        </div>
      </Boundary>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Boundary label="Alodi data · PII stays in">
          <div className="grid gap-2 md:grid-cols-3">
            {STORES.map((c) => (
              <Box key={c.name} n={c} />
            ))}
          </div>
        </Boundary>
        <Boundary label="External services · masked text only">
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
    <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
      <Boundary label="Container · Alodi Agent">
        <div className="rounded-[12px] bg-navy px-4 py-3.5 text-parchment">
          <div className="t-body-sans text-[15px] font-medium">Agent loop</div>
          <div className="mt-1 text-[11px] text-parchment/70">[one state machine per order + LLM tool calling]</div>
          <div className="t-body-sans mt-1.5 text-[13px] text-parchment/85">
            pre → delivering → chat → call 1 → call 2 → extract → ready · review · cs → closed
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {TOOLS.map((t) => (
            <Box key={t.name} n={t} />
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Box n={{ name: "Order Context Object", kind: "store", tech: "versioned JSON", d: "Who changed what and when: agent, buyer, courier, CS" }} />
          <Box n={{ name: "Decision", kind: "container", tech: "auto_applied · needs_review · escalated_cs", d: "Every field ≥ 0.85 applies; anything lower is confirmed in chat or goes to CS" }} />
        </div>
      </Boundary>
      <Boundary label="Component · Policy guard (runs before every action)">
        <ul className="grid gap-2">
          {GUARD.map(([k, v]) => (
            <li key={k + v} className="flex items-baseline justify-between gap-3 rounded-[10px] border border-ash bg-paper px-4 py-2.5">
              <span className="text-[13px] text-navy">{k}</span>
              <span className="t-body-sans text-right text-[13px] text-graphite">{v}</span>
            </li>
          ))}
        </ul>
      </Boundary>
    </div>
  );
}

function Deployment() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {DEPLOY.map((d, i) => (
        <div key={d.k} className={`rounded-[16px] p-5 ${i === 1 ? "bg-navy text-parchment" : "border border-ash bg-paper"}`}>
          <div className={`text-[11px] uppercase ${i === 1 ? "text-peach" : "text-orange-deep"}`}>{d.note}</div>
          <div className={`t-h4 mt-2 ${i === 1 ? "!text-parchment" : ""}`}>{d.k}</div>
          <dl className="mt-5 grid gap-3">
            {d.rows.map(([k, v]) => (
              <div key={k} className={`grid grid-cols-[86px_1fr] gap-3 border-t pt-3 ${i === 1 ? "border-white/15" : "border-ash"}`}>
                <dt className={`text-[12px] uppercase ${i === 1 ? "text-parchment/60" : "text-smoke"}`}>{k}</dt>
                <dd className={`t-body-sans text-[13px] leading-[1.4] ${i === 1 ? "text-parchment/90" : "text-graphite"}`}>{v}</dd>
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
    <ol className="grid gap-px overflow-hidden rounded-[16px] border border-ash bg-ash sm:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((s) => (
        <li key={s.n} className={`p-5 ${s.n === 8 ? "bg-[#fdeee4]" : "bg-paper"}`}>
          <span className={`grid size-7 place-items-center rounded-full text-[12px] text-paper ${s.n === 8 ? "bg-bad" : "bg-orange"}`}>{s.n}</span>
          <div className="t-body-sans mt-4 text-[15px] font-medium text-navy">{s.t}</div>
          <div className="t-body-sans mt-1 text-[13px] leading-[1.4] text-graphite">{s.d}</div>
        </li>
      ))}
    </ol>
  );
}

const LEVELS = [
  { k: "L1", label: "System context", hint: "Who uses Alodi and what it talks to", View: Context },
  { k: "L2", label: "Containers", hint: "What runs, and on what, demo → production", View: Containers },
  { k: "L3", label: "Agent components", hint: "Inside the agent: tools and the guard", View: Components },
  { k: "D", label: "Deployment", hint: "Demo VM, one server per area, then regions", View: Deployment },
  { k: "→", label: "Flow · 8 steps", hint: "The business flow the agent runs", View: Flow },
];

export function C4Architecture() {
  const [i, setI] = useState(0);
  const L = LEVELS[i];
  return (
    <div className="rounded-[16px] border border-ash bg-paper/70 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="t-eyebrow text-smoke">C4 model · current architecture</div>
          <div className="t-body-sans mt-1 text-[13px] text-graphite">{L.hint}</div>
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] uppercase text-smoke">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-[3px] bg-navy" /> Alodi core
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-[3px] border border-ash bg-paper" /> Alodi container
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-[3px] border border-dashed border-smoke" /> External
          </span>
        </div>
      </div>

      <div role="tablist" aria-label="C4 level" className="mt-5 flex gap-1 overflow-x-auto border-b border-ash">
        {LEVELS.map((l, j) => (
          <button
            key={l.k}
            role="tab"
            aria-selected={i === j}
            onClick={() => setI(j)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] uppercase transition ${
              i === j ? "border-orange text-navy" : "border-transparent text-smoke hover:text-navy"
            }`}
          >
            <span className={i === j ? "text-orange-deep" : ""}>{l.k}</span>
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.div key={L.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
            <L.View />
          </motion.div>
        </AnimatePresence>
      </div>

      <SourceNote className="mt-5">PRD §16 System architecture and §18.8 local-first deployment; diagram prep/02-technical/diagrams/alodi-architecture.pdf</SourceNote>
    </div>
  );
}
