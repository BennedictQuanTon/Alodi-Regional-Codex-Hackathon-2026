"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { DemoEngine } from "@/lib/demo/engine";
import { ORDER, fmtClock } from "@/lib/demo/scenarios";
import type { CaseStage, DemoState } from "@/lib/demo/types";
import { Conf } from "./phone";

const EASE = [0.22, 1, 0.36, 1] as const;

export const STAGE_LABEL: Record<CaseStage, string> = {
  pre: "Pre-delivery",
  delivering: "Out for delivery",
  chat: "Awaiting chat",
  call1: "AI call 1",
  call2: "AI call 2",
  extract: "Extracting",
  ready: "Card ready",
  review: "Needs review",
  cs: "With CS",
  closed: "Closed",
};

export function ttcText(s: DemoState) {
  const { triggerAt, contextAt, lastSignalAt } = s.ttc;
  if (triggerAt == null || contextAt == null) return null;
  const total = contextAt - triggerAt;
  const fromSignal = lastSignalAt != null ? Math.max(1, Math.round((contextAt - lastSignalAt) * 60)) : null;
  const totalText = total >= 1 ? `${Math.round(total)} min` : `${Math.round(total * 60)} s`;
  const signalText = fromSignal == null ? "—" : fromSignal >= 90 ? `${Math.round(fromSignal / 60)} min` : `${fromSignal} s`;
  return { totalText, signalText };
}

const STEP_OF: Record<CaseStage, number> = { pre: 0, delivering: 0, chat: 1, call1: 2, call2: 2, extract: 3, ready: 4, review: 4, cs: 4, closed: 5 };

/** The six-step rescue flow, drawn as a rail that fills as the case moves. */
export function FlowRail({ state: s }: { state: DemoState }) {
  const memo = s.oco.trigger === "RESCHEDULE";
  const steps = ["Tap", "Chat", memo ? "Memo" : "Call", "Extract", "Decide", "Delivered"];
  const active = s.ttc.triggerAt == null && s.stage !== "cs" ? 0 : Math.max(1, STEP_OF[s.stage]);
  const fill = (Math.min(active, steps.length - 1) / (steps.length - 1)) * 100;
  return (
    <div className="relative px-2">
      <div className="absolute left-[calc(8.33%)] right-[calc(8.33%)] top-[15px] h-[2px] rounded-full bg-[var(--ui-line)]">
        <motion.div className="h-full rounded-full bg-[var(--ui-ink)]" animate={{ width: `${fill}%` }} transition={{ duration: 0.7, ease: EASE }} />
      </div>
      <ol className="relative grid grid-cols-6">
        {steps.map((label, i) => {
          const done = i < active || (s.done && i <= active);
          const now = i === active && !s.done;
          return (
            <li key={label} className="flex flex-col items-center gap-2">
              <span className="relative grid size-8 place-items-center">
                {now && <span className="pulse-ring absolute inset-0 rounded-full bg-[var(--ui-accent)]" />}
                <motion.span
                  className="relative grid size-8 place-items-center rounded-full border-2 text-[12px] font-semibold"
                  animate={{
                    backgroundColor: done ? "#1f2a44" : now ? "#f05a00" : "#ffffff",
                    borderColor: done ? "#1f2a44" : now ? "#f05a00" : "#e5e5e5",
                    color: done || now ? "#ffffff" : "#737373",
                  }}
                  transition={{ duration: 0.35 }}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                      <path d="M4 8.4l2.5 2.5 5.5-5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </motion.span>
              </span>
              <span className={`text-[12px] ${now ? "font-semibold text-[var(--ui-ink)]" : "ui-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function nowLine(s: DemoState): { title: string; big?: string; unit?: string } {
  if (s.done && s.stage === "closed") return { title: "Delivered on attempt 2" };
  if (s.timer) return { title: s.timer.label, big: String(Math.max(0, Math.ceil(s.timer.until - s.clock))), unit: "min to go" };
  const ttc = ttcText(s);
  switch (s.stage) {
    case "pre":
      return { title: "Waiting for the route" };
    case "delivering":
      return { title: "Courier on the way" };
    case "chat":
      return { title: "Message sent to the buyer" };
    case "call1":
    case "call2":
      return { title: s.call.status === "connected" ? "AI call in progress" : "Calling the buyer" };
    case "extract":
      return { title: "Turning the answer into fields" };
    case "ready":
      return { title: "Context card sent", big: ttc?.signalText.split(" ")[0], unit: ttc ? `${ttc.signalText.split(" ")[1]} to context` : undefined };
    case "review":
      return { title: "A person needs to confirm" };
    case "cs":
      return { title: "Handed to customer service" };
    default:
      return { title: "" };
  }
}

function Approval({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const waiting = s.waitingFor?.action === "cs:approve";
  if (s.done || !waiting) return null;
  const copy =
    s.oco.trigger === "REFUSED"
      ? { t: "Label as suspected bomb?", cta: "Approve return" }
      : s.stage === "review"
        ? { t: "Two different times mentioned", cta: "Confirm 14:00–17:00" }
        : { t: "Two calls, no answer", cta: "Claim case" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 rounded-[18px] bg-[var(--ui-warn-soft)] px-4 py-3"
    >
      <span className="text-[14px] font-medium text-[var(--ui-warn)]">{copy.t}</span>
      <button onClick={() => engine.dispatch("cs:approve")} className="ui-btn ui-btn-primary relative">
        {copy.cta}
        <span className="pointer-events-none absolute -inset-[4px] animate-pulse rounded-[22px] border-2 border-[var(--ui-accent)]" />
      </button>
    </motion.div>
  );
}

/** Compact operations view used on the three-screen demo stage. */
export function ConsolePanel({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const [json, setJson] = useState(false);
  const now = nowLine(s);
  const ex = s.extraction;
  const fields = ex?.fields.filter((f) => f.value != null || f.conf != null) ?? [];
  const badge =
    s.stage === "review" || s.stage === "cs" ? "ui-badge-warn" : s.stage === "ready" || s.stage === "closed" ? "ui-badge-good" : "ui-badge-accent";

  return (
    <div className="ui ui-card flex h-full flex-col overflow-hidden !bg-white">
      <div className="flex items-center justify-between px-7 pb-5 pt-6">
        <div>
          <div className="text-[12px] ui-muted">{ORDER.tracking}</div>
          <div className="ui-h mt-1 text-[22px]">{ORDER.buyer}</div>
        </div>
        <span className={`ui-badge ${badge} !text-[13px] !px-3 !py-1`}>{STAGE_LABEL[s.stage]}</span>
      </div>

      <div className="px-5 pb-6">
        <FlowRail state={s} />
      </div>

      <div className="ui-scroll flex-1 space-y-4 overflow-y-auto border-t border-[var(--ui-line)] bg-[var(--ui-alt)] p-5">
        <Approval state={s} engine={engine} />

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="ui-card flex min-h-[188px] flex-col justify-between p-5">
            <div className="ui-label">Now</div>
            <AnimatePresence mode="wait">
              <motion.div key={now.title + (now.big ?? "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
                {now.big && (
                  <div className="flex items-baseline gap-2">
                    <span className="ui-h text-[48px] tabular-nums tracking-[-0.05em]">{now.big}</span>
                    <span className="text-[13px] ui-muted">{now.unit}</span>
                  </div>
                )}
                <div className={`${now.big ? "mt-1 text-[14px] ui-muted" : "ui-h text-[22px]"}`}>{now.title}</div>
              </motion.div>
            </AnimatePresence>
            <div className="text-[12px] tabular-nums ui-muted">{fmtClock(s.clock)}</div>
          </div>

          <div className="ui-card p-5">
            <div className="flex items-center justify-between">
              <span className="ui-label">Extracted</span>
              {ex?.decision && (
                <span className={`ui-badge ${ex.decision === "auto_applied" ? "ui-badge-good" : "ui-badge-warn"}`}>
                  {ex.decision === "auto_applied" ? "Auto-applied" : "Needs review"}
                </span>
              )}
            </div>
            {fields.length === 0 ? (
              <div className="mt-6 text-[13px] ui-muted">Waiting for the buyer’s answer.</div>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--ui-line)]">
                {fields.map((f, i) => (
                  <motion.li
                    key={f.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: i < ex!.revealed || ex!.revealed >= ex!.fields.length ? 1 : 0.15, x: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] ui-muted">{f.label}</span>
                      <span className="block truncate text-[14px] font-medium">{f.value ?? "—"}</span>
                    </span>
                    <Conf value={f.conf} />
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ui-card p-5">
          <div className="ui-label">Activity</div>
          <ul className="mt-3 space-y-2.5">
            <AnimatePresence initial={false}>
              {[...s.audit].reverse().slice(0, 4).map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex items-start gap-3 text-[13px]"
                >
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full"
                    style={{ background: a.tone === "good" ? "var(--ui-good)" : a.tone === "warn" ? "var(--ui-warn)" : a.actor === "agent" ? "var(--ui-accent)" : "#a3a3a3" }}
                  />
                  <span className="w-11 shrink-0 tabular-nums ui-muted">{fmtClock(a.at)}</span>
                  <span className="min-w-0">{a.text}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {s.audit.length === 0 && <li className="text-[13px] ui-muted">Nothing yet.</li>}
          </ul>
        </div>

        <div className="ui-card overflow-hidden">
          <button onClick={() => setJson((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5 text-[14px] font-medium">
            <span>
              Order context <span className="ui-muted">· v{s.oco.version}</span>
            </span>
            <motion.span animate={{ rotate: json ? 90 : 0 }} className="ui-muted" aria-hidden>
              ›
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {json && (
              <motion.pre
                initial={{ height: 0 }}
                animate={{ height: 220 }}
                exit={{ height: 0 }}
                className="ui-scroll overflow-auto border-t border-[var(--ui-line)] bg-[var(--ui-ink-strong)] px-5 py-4 font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.55] text-white/85"
              >
                {JSON.stringify(s.oco, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
