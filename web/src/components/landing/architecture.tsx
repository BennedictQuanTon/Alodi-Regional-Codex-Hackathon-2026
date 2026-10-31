"use client";

import { motion, useReducedMotion } from "motion/react";
import { Mark } from "@/components/site/brand";
import { TechIcon } from "@/components/site/logos";

// One picture of the production architecture (PRD §16, §16.7, §18.8): carrier and buyer inputs on the left,
// the Alodi agent layer in the middle, what comes back out on the right, the models underneath.
// Node rows have a fixed height so the connector curves can be computed instead of measured.

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "-80px" } as const;

const ROW = 64;
const GAP = 12;
const COL_H = 5 * ROW + 4 * GAP; // 368
const LINK_W = 72;

type Node = { title: string; sub: string; logo?: string; mark?: "dot" | "check" | "square"; logos?: string[] };

const INPUTS: Node[] = [
  { title: "Route planner", sub: "feasible windows", logo: "/logos/couriers/spx.svg" },
  { title: "Order system", sub: "today’s orders, COD", logo: "/logos/couriers/spx.svg" },
  { title: "Courier tap", sub: "No answer · Rescheduled · Refused", mark: "dot" },
  { title: "Buyer chat", sub: "quick replies, free text", logos: ["siShopee", "siZalo"] },
  { title: "AI call", sub: "GPT-Live-1 over a branded SIP line", logo: "siAsterisk" },
];

const OUTPUTS: Node[] = [
  { title: "Context card", sub: "to the courier, next attempt", logo: "/logos/couriers/spx.svg" },
  { title: "CS queue", sub: "a person decides", mark: "check" },
  { title: "Ops dashboard", sub: "events, metrics, audit", mark: "square" },
];

const CORE = [
  { icon: "siOpenai", title: "Alodi Agent", sub: "GPT-6.1 Terra · Agents SDK, one run per order" },
  { icon: "siOpenai", title: "Triage", sub: "Decisions API on GPT-6 Luna" },
  { mark: "square" as const, title: "Policy guard", sub: "quiet hours · caps · 0.85 · masks PII" },
  { icon: "siTemporal", title: "Scheduler", sub: "60′ and +2 h timers, retries" },
];

const STORES = [
  { icon: "siPostgresql", name: "PostgreSQL" },
  { icon: "siRedis", name: "Redis" },
  { icon: "siMinio", name: "MinIO" },
];

const MODELS = [
  { icon: "siOpenai", name: "GPT-Live-1", sub: "real-time voice calls with the buyer" },
  { icon: "siOpenai", name: "Decisions API", sub: "GPT-6 Luna triages every message" },
  { icon: "siOpenai", name: "GPT-6.1 Terra", sub: "orchestrates buyer, courier and policy" },
  { icon: "siOpenai", name: "gpt-oss-20b", sub: "local fallback · PhoWhisper for memos" },
];

function Logo({ n }: { n: Node }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-parchment">
      {n.logos ? (
        <span className="flex gap-0.5">
          {n.logos.map((l) => (
            <TechIcon key={l} icon={l} size={13} />
          ))}
        </span>
      ) : n.logo ? (
        <TechIcon icon={n.logo} size={n.logo.endsWith(".svg") && n.logo.includes("spx") ? 26 : 18} />
      ) : (
        <Mark kind={n.mark ?? "dot"} size={18} className="text-orange-deep" />
      )}
    </span>
  );
}

function Card({ n, i, from }: { n: Node; i: number; from: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: from }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={VIEW}
      transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: EASE }}
      className="flex items-center gap-3 rounded-[16px] border border-ash bg-paper px-3.5"
      style={{ height: ROW }}
    >
      <Logo n={n} />
      <div className="min-w-0">
        <div className="text-[14px] font-medium leading-tight text-navy">{n.title}</div>
        <div className="truncate text-[12px] text-smoke">{n.sub}</div>
      </div>
    </motion.div>
  );
}

/** Curves between a column of rows and the middle of the core card. */
function Links({ ys, side }: { ys: number[]; side: "in" | "out" }) {
  const reduce = useReducedMotion();
  const mid = COL_H / 2;
  const paths = ys.map((y) =>
    side === "in" ? `M0,${y} C${LINK_W * 0.55},${y} ${LINK_W * 0.45},${mid} ${LINK_W},${mid}` : `M0,${mid} C${LINK_W * 0.55},${mid} ${LINK_W * 0.45},${y} ${LINK_W},${y}`,
  );
  return (
    <svg width={LINK_W} height={COL_H} viewBox={`0 0 ${LINK_W} ${COL_H}`} className="hidden shrink-0 overflow-visible lg:block" aria-hidden>
      {paths.map((d, i) => (
        <g key={d}>
          <motion.path d={d} fill="none" stroke="var(--color-ash)" strokeWidth={1.2} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={VIEW} transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: EASE }} />
          {!reduce && (
            <circle r={2.6} fill="var(--color-orange)">
              <animateMotion dur={`${2.4 + (i % 3) * 0.4}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} />
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

function Core() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={VIEW}
      transition={{ duration: 0.8, ease: EASE }}
      className="relative flex flex-col overflow-hidden rounded-[24px] bg-ink p-5 text-parchment lg:h-[368px]"
    >
      <div className="wash -right-16 -top-20 h-56 w-56 opacity-50" style={{ background: "radial-gradient(circle, rgba(240,90,0,0.8), transparent 70%)" }} />
      <div className="relative flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-logo)] text-[26px] font-extrabold leading-none tracking-[-0.03em]">alodi</span>
        <span className="text-[11px] uppercase tracking-[0.08em] text-parchment/45">agent layer</span>
      </div>
      <div className="relative mt-4 grid gap-2">
        {CORE.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEW}
            transition={{ delay: 0.35 + i * 0.1, duration: 0.5, ease: EASE }}
            className={`flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 ${i === 0 ? "bg-white/[0.09] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" : "bg-white/[0.04]"}`}
          >
            {c.icon ? <TechIcon icon={c.icon} size={18} mono className="text-parchment" /> : <Mark kind={c.mark} size={18} className="text-orange" />}
            <div className="min-w-0">
              <div className="text-[14px] font-medium leading-tight">{c.title}</div>
              <div className="truncate text-[12px] text-parchment/55">{c.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="relative mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-3.5 text-[12px] text-parchment/65">
        {STORES.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <TechIcon icon={s.icon} size={14} mono className="text-parchment/70" />
            {s.name}
          </span>
        ))}
        <span className="ml-auto text-parchment/40">masked text out</span>
      </div>
    </motion.div>
  );
}

export function ArchitectureDiagram() {
  const inYs = INPUTS.map((_, i) => ROW / 2 + i * (ROW + GAP));
  const outTop = (COL_H - (OUTPUTS.length * ROW + (OUTPUTS.length - 1) * GAP)) / 2;
  const outYs = OUTPUTS.map((_, i) => outTop + ROW / 2 + i * (ROW + GAP));
  return (
    <div className="rounded-[28px] border border-ash bg-paper/60 p-4 md:p-6">
      <div className="mb-4 hidden grid-cols-[1fr_72px_1.15fr_72px_1fr] text-[11px] font-medium uppercase tracking-[0.08em] text-smoke lg:grid">
        <span>Carrier + buyer</span>
        <span />
        <span className="text-center">Alodi</span>
        <span />
        <span className="text-right">Back to the carrier</span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-0">
        <div className="grid flex-1 gap-3" style={{ gridAutoRows: ROW }}>
          {INPUTS.map((n, i) => (
            <Card key={n.title} n={n} i={i} from={-12} />
          ))}
        </div>
        <Links ys={inYs} side="in" />
        <div className="lg:flex-[1.15]">
          <Core />
        </div>
        <Links ys={outYs} side="out" />
        <div className="grid flex-1 gap-3 lg:pt-[76px]" style={{ gridAutoRows: ROW }}>
          {OUTPUTS.map((n, i) => (
            <Card key={n.title} n={n} i={i} from={12} />
          ))}
        </div>
      </div>

      <div className="mx-auto hidden h-8 w-px bg-ash lg:block" />
      <div className="mt-3 overflow-hidden rounded-[20px] border border-ash lg:mt-0">
        <div className="flex items-center justify-between border-b border-ash bg-parchment px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-smoke">
          <span>Models · OpenAI</span>
          <span className="normal-case tracking-normal">masked text to the cloud · calls after consent</span>
        </div>
        <ul className="grid bg-paper sm:grid-cols-2 xl:grid-cols-4">
          {MODELS.map((m, i) => (
            <motion.li
              key={m.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEW}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.5, ease: EASE }}
              className={`flex items-center gap-3 px-5 py-4 ${i > 0 ? "border-t border-ash sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t xl:border-t-0" : ""} ${i > 0 ? "xl:border-l" : ""}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-parchment">
                <TechIcon icon={m.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-navy">{m.name}</span>
                <span className="block truncate text-[12px] text-smoke">{m.sub}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-[12px] text-smoke">
        Source: PRD §16, §16.7, §18.8. The demo runs the same shape on the OpenAI API, SQLite and mock data.
      </p>
    </div>
  );
}
