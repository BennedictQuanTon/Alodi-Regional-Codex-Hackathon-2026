"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { DemoEngine } from "@/lib/demo/engine";
import type { MockCase } from "@/lib/demo/mock-cases";
import { ORDER, fmtClock } from "@/lib/demo/scenarios";
import type { AuditEntry, CaseStage, DemoState, OrderContext } from "@/lib/demo/types";
import { STAGE_LABEL, ttcText } from "@/components/demo/console-parts";

const STEPS: { k: CaseStage[]; label: string }[] = [
  { k: ["pre", "delivering"], label: "Deliver" },
  { k: ["chat"], label: "Chat" },
  { k: ["call1"], label: "Call 1" },
  { k: ["call2"], label: "Call 2" },
  { k: ["extract"], label: "Extract" },
  { k: ["ready", "review", "cs"], label: "Decide" },
  { k: ["closed"], label: "Close" },
];

export function stageChip(stage: CaseStage) {
  if (stage === "review" || stage === "cs") return "d-chip-warn";
  if (stage === "ready" || stage === "closed") return "d-chip-good";
  if (stage === "pre" || stage === "delivering") return "d-chip-neutral";
  return "d-chip-primary";
}

export function stageProgress(stage: CaseStage) {
  const idx = STEPS.findIndex((s) => s.k.includes(stage));
  return Math.round(((idx + 1) / STEPS.length) * 100);
}

function Steps({ stage }: { stage: CaseStage }) {
  const idx = STEPS.findIndex((s) => s.k.includes(stage));
  return (
    <div className="flex gap-1">
      {STEPS.map((s, i) => (
        <div key={s.label} className="flex-1">
          <div
            className="h-1 rounded-full transition-colors duration-500"
            style={{ background: i < idx ? "var(--d-text)" : i === idx ? "var(--d-primary)" : "var(--d-chart-track)" }}
          />
          <div className={`mt-1.5 text-[11px] ${i === idx ? "font-semibold" : "d-muted"}`}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function ConfBar({ v }: { v: number | null }) {
  if (v == null) return <span className="d-muted">—</span>;
  const ok = v >= 0.85;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-1 w-14 overflow-hidden rounded-full bg-[var(--d-chart-track)]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v * 100}%`, background: ok ? "var(--d-good)" : "var(--d-warn)" }} />
      </span>
      <span className="tabular-nums text-[13px]">{v.toFixed(2)}</span>
    </span>
  );
}

function Json({ oco, prev }: { oco: OrderContext; prev: OrderContext | null }) {
  const keys = Object.keys(oco) as (keyof OrderContext)[];
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-changed='1']:not([data-key='version'])");
    if (el && ref.current) ref.current.scrollTo({ top: el.offsetTop - 30, behavior: "smooth" });
  }, [oco.version]);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--d-border)] bg-[#0f1526] text-[#e8e4de]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[12px]">
        <span className="font-semibold">Order Context Object</span>
        <span className="opacity-70">
          v{oco.version} · {oco.updated_by}
        </span>
      </div>
      <pre ref={ref} className="relative max-h-[240px] overflow-auto px-4 py-3 font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.55]">
        {"{\n"}
        {keys.map((k, i) => {
          const changed = prev ? JSON.stringify(prev[k]) !== JSON.stringify(oco[k]) : false;
          return (
            <span key={k + oco.version} data-changed={changed ? "1" : "0"} data-key={k} className={`block whitespace-pre ${changed ? "bg-[#f05a00]/25 text-white" : "opacity-75"}`}>
              {`  "${k}": ${JSON.stringify(oco[k], null, 2).replace(/\n/g, "\n  ")}${i < keys.length - 1 ? "," : ""}`}
            </span>
          );
        })}
        {"}"}
      </pre>
    </div>
  );
}

const ACTOR: Record<AuditEntry["actor"], string> = { agent: "Agent", buyer: "Buyer", shipper: "Courier", cs: "CS", system: "System" };

function Audit({ items }: { items: AuditEntry[] }) {
  const list = [...items].reverse().slice(0, 10);
  if (!list.length) return <p className="text-[13px] d-muted">No events yet.</p>;
  return (
    <ul className="space-y-0">
      <AnimatePresence initial={false}>
        {list.map((a) => (
          <motion.li
            key={a.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-[44px_58px_1fr] gap-2 border-b border-[var(--d-border)] py-2 text-[12.5px] last:border-0"
          >
            <span className="tabular-nums d-muted">{fmtClock(a.at)}</span>
            <span className="font-semibold d-text2">{ACTOR[a.actor]}</span>
            <span style={{ color: a.tone === "good" ? "var(--d-good)" : a.tone === "warn" ? "var(--d-warn)" : a.tone === "bad" ? "var(--d-bad)" : undefined }}>{a.text}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="d-overline mb-2.5">{title}</h4>
      {children}
    </section>
  );
}

export function LiveCaseDetail({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const waiting = s.waitingFor?.action === "cs:approve";
  const ttc = ttcText(s);
  const inHours = s.clock % 1440 >= 480 && s.clock % 1440 <= 1230;
  const approve =
    s.oco.trigger === "REFUSED"
      ? { t: "Suggested label: “suspected bomb”", b: "Refused at the door. The label counts toward the buyer’s COD lock, so a person approves.", cta: "Approve return" }
      : s.stage === "review"
        ? { t: "Low confidence · confirm first", b: "Two different times were mentioned. Call back, then apply.", cta: "Called · apply 14:00–17:00" }
        : { t: "Two unanswered AI calls", b: "Call-backs now route to the hotline. Claim the case to handle it.", cta: "Claim case" };

  return (
    <div className="space-y-6">
      <div>
        <span className="d-chip d-chip-primary">
          <span className="blink size-1.5 rounded-full bg-[var(--d-primary)]" aria-hidden /> Live demo case
        </span>
        <h3 className="d-title mt-3 text-[28px]">{ORDER.buyer}</h3>
        <p className="mt-1 text-[13px] d-muted">
          {ORDER.tracking} · COD {ORDER.cod} · {ORDER.item}
        </p>
      </div>
      <Steps stage={s.stage} />
      <div className="flex flex-wrap gap-1.5">
        <span className={`d-chip ${inHours ? "d-chip-good" : "d-chip-neutral"}`}>Call hours {inHours ? "open" : "closed"}</span>
        <span className="d-chip d-chip-neutral">Calls {s.guard.calls}/2</span>
        <span className={`d-chip ${s.guard.consent ? "d-chip-good" : "d-chip-neutral"}`}>Recording {s.guard.consent == null ? "not asked" : s.guard.consent ? "consented" : "declined"}</span>
        <span className="d-chip d-chip-neutral">Cycle {s.oco.rescue_cycle}/2</span>
      </div>

      {!s.done && (waiting || s.stage === "review" || s.stage === "cs") && (
        <div className="rounded-xl border border-[var(--d-warn)]/40 bg-[var(--d-warn-soft)] p-4">
          <div className="text-[15px] font-semibold">{approve.t}</div>
          <p className="mt-1 text-[13px] d-text2">{approve.b}</p>
          <button onClick={() => engine.dispatch("cs:approve")} disabled={!waiting} className="d-btn d-btn-primary d-btn-sm mt-3 disabled:opacity-40">
            {approve.cta}
          </button>
        </div>
      )}

      {s.card && (
        <div className="relative overflow-hidden rounded-xl border border-[var(--d-border)] bg-[var(--d-surface)] p-4 pl-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-[var(--d-primary)]" />
          <div className="d-overline">Context card sent to courier</div>
          <div className="d-num mt-1.5 text-[22px]">{s.card.window}</div>
          <div className="text-[14px] d-text2">{s.card.drop}</div>
          {s.card.alt && <div className="text-[14px] d-text2">{s.card.alt}</div>}
        </div>
      )}

      {ttc && (
        <div className="grid grid-cols-2 gap-3">
          <div className="d-tint p-4">
            <div className="d-overline">Time-to-context</div>
            <div className="d-num mt-1 text-[30px]">{ttc.signalText}</div>
          </div>
          <div className="d-tint p-4">
            <div className="d-overline">Tap → card</div>
            <div className="d-num mt-1 text-[30px]">{ttc.totalText}</div>
          </div>
        </div>
      )}

      <Section title="Extraction">
        {s.extraction ? (
          <table className="w-full text-[13px]">
            <tbody>
              {s.extraction.fields.map((f) => (
                <tr key={f.key} className="border-b border-[var(--d-border)] last:border-0">
                  <td className="py-2 d-muted">{f.label}</td>
                  <td className="py-2">{f.value ?? <span className="d-muted">null</span>}</td>
                  <td className="py-2 text-right">
                    <ConfBar v={f.conf} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] d-muted">Runs on a chat reply, call transcript or voice memo.</p>
        )}
      </Section>

      <Json oco={s.oco} prev={s.prevOco} />

      <Section title="Audit log">
        <Audit items={s.audit} />
      </Section>

      {!s.playing && s.step === 0 && (
        <p className="d-tint p-4 text-[13px] d-text2">This case follows the demo stage. Open /demo in another tab and press Play; it updates here live.</p>
      )}
    </div>
  );
}

const TRIGGER: Record<MockCase["trigger"], string> = {
  NO_ANSWER: "No answer",
  RESCHEDULE: "Rescheduled",
  REFUSED: "Refused",
  PRE_DELIVERY: "Pre-delivery",
};

export function MockCaseDetail({ c, resolved, onResolve }: { c: MockCase; resolved?: string; onResolve: (v: string) => void }) {
  const stage: CaseStage = resolved ? "closed" : c.stage;
  const needsHuman = !resolved && (c.stage === "review" || c.stage === "cs");
  return (
    <div className="space-y-6">
      <div>
        <span className={`d-chip ${stageChip(stage)}`}>{STAGE_LABEL[stage]}</span>
        <h3 className="d-title mt-3 text-[28px]">{c.buyer}</h3>
        <p className="mt-1 text-[13px] d-muted">
          {c.id} · {c.district} · {c.cod ? `₫${c.cod.toLocaleString("en-US")}` : "Prepaid"} · courier {c.courier}
        </p>
      </div>
      <Steps stage={stage} />
      <div className="flex flex-wrap gap-1.5">
        <span className="d-chip d-chip-neutral">{TRIGGER[c.trigger]}</span>
        <span className="d-chip d-chip-neutral">Cycle {c.cycle}/2</span>
        <span className="d-chip d-chip-neutral">{c.channel}</span>
      </div>
      {c.context && (
        <div className="relative overflow-hidden rounded-xl border border-[var(--d-border)] p-4 pl-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-[var(--d-primary)]" />
          <div className="d-overline">Context card</div>
          <div className="mt-1.5 text-[16px]">{c.context}</div>
        </div>
      )}
      {c.note && <div className="d-tint p-4 text-[14px]">{c.note}</div>}
      {c.transcript && (
        <Section title="Excerpt">
          <ul className="space-y-1.5 text-[14px] d-text2">
            {c.transcript.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>
      )}
      {needsHuman && (
        <div className="rounded-xl border border-[var(--d-warn)]/40 bg-[var(--d-warn-soft)] p-4">
          <div className="text-[15px] font-semibold">{c.suggestion ?? "Needs a person"}</div>
          <p className="mt-1 text-[13px] d-text2">The agent only suggests. The decision is logged with the reviewer’s name.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onResolve("approved")} className="d-btn d-btn-primary d-btn-sm">
              Approve
            </button>
            <button onClick={() => onResolve("called the buyer")} className="d-btn d-btn-secondary d-btn-sm">
              Call buyer
            </button>
          </div>
        </div>
      )}
      {resolved && <p className="text-[14px]" style={{ color: "var(--d-good)" }}>Resolved: {resolved}</p>}
      <p className="text-[13px] d-muted">Updated {c.updated}</p>
    </div>
  );
}
