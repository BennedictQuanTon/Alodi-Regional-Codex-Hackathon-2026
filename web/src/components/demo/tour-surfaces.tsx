"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mark } from "@/components/site/brand";
import { DAY, HUB } from "@/lib/dash/hub-day";
import { ORDER, fmtClock } from "@/lib/demo/scenarios";
import type { CaseStage, DemoState } from "@/lib/demo/types";
import { FlowRail, STAGE_LABEL, ttcText } from "./console-parts";

// The two desktop surfaces of the narrated demo: the carrier's dashboard and the agent's run.

const fmt = (n: number) => n.toLocaleString("en-US");
const STAGES: CaseStage[] = ["pre", "delivering", "chat", "call1", "call2", "extract", "review", "ready", "cs", "closed"];
// The second drop puts the stage back to "delivering", but the card means the rescue already ran.
const reached = (s: DemoState, stage: CaseStage) => !!s.card || STAGES.indexOf(s.stage) >= STAGES.indexOf(stage);

/** SPX hub screen: the day's numbers, this order in the queue, and what just happened. */
export function TourDashboard({ state: s }: { state: DemoState }) {
  const kpis = [
    { k: "Orders today", v: fmt(DAY.orders) },
    { k: "Failed first time", v: fmt(DAY.failed_first_attempt.total) },
    { k: "Rescued, card sent", v: fmt(DAY.rescheduled_with_card), hot: true },
  ];
  const ttc = ttcText(s);
  return (
    <div className="ui-card flex h-full flex-col overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-5">
        <div className="text-[19px] font-semibold tracking-tight">{HUB.name}</div>
        <span className="text-[12px] ui-muted">Mock data · simulated day</span>
      </div>
      <div className="mx-5 mt-4 grid grid-cols-3 divide-x divide-[var(--ui-line)] rounded-[18px] border border-[var(--ui-line)]">
        {kpis.map((x) => (
          <div key={x.k} className="px-4 py-3">
            <div className="text-[12px] ui-muted">{x.k}</div>
            <div className={`mt-1 text-[24px] font-medium tabular-nums tracking-tight ${x.hot ? "text-[var(--ui-accent)]" : ""}`}>{x.v}</div>
          </div>
        ))}
      </div>
      <div className="mx-5 mt-4 flex items-center justify-between rounded-[18px] bg-[var(--ui-alt)] px-4 py-3">
        <div className="min-w-0">
          <div className="ui-label">Exception queue</div>
          <div className="mt-1 truncate text-[15px] font-medium">{ORDER.buyer} · {ORDER.item}</div>
          <div className="mt-0.5 truncate text-[12.5px] tabular-nums ui-muted">{ORDER.tracking} · COD {ORDER.cod} · {ORDER.route} · Attempt {s.oco.delivery_attempt}</div>
        </div>
        <span className="ui-badge ui-badge-accent shrink-0">{STAGE_LABEL[s.stage]}</span>
      </div>
      <div className="mt-4 px-3">
        <FlowRail state={s} />
      </div>
      {ttc && <div className="mt-3 text-center text-[13px] ui-muted">Context card ready {ttc.signalText} after the call</div>}
      <div className="mt-3 min-h-0 flex-1 overflow-hidden border-t border-[var(--ui-line)] p-5">
        <div className="ui-label">Activity</div>
        <ul className="mt-3 space-y-2.5">
          <AnimatePresence initial={false}>
            {[...s.audit].reverse().slice(0, 6).map((a) => (
              <motion.li key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3 text-[13px]">
                <span className="w-11 shrink-0 tabular-nums ui-muted">{fmtClock(a.at)}</span>
                <span className="min-w-0">{a.text}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {s.audit.length === 0 && <li className="text-[13px] ui-muted">The route hasn’t started.</li>}
        </ul>
      </div>
    </div>
  );
}

type Status = "waiting" | "running" | "done";

function agentSteps(s: DemoState): { label: string; tool: string; status: Status }[] {
  const calling = s.stage === "call1" || s.stage === "call2";
  const step = (running: boolean, done: boolean): Status => (done ? "done" : running ? "running" : "waiting");
  return [
    { label: "Shipper tap", tool: "Shipper event", status: step(s.shipper.screen === "choose", reached(s, "chat")) },
    { label: "Policy check", tool: "Hours, contact limits", status: step(false, reached(s, "chat")) },
    { label: "Chat to buyer", tool: "Workflow message", status: step(s.stage === "chat", reached(s, "call1")) },
    { label: "Call the buyer", tool: "GPT-Live-1", status: step(calling, reached(s, "extract")) },
    { label: "Extract fields", tool: "GPT-6.1 Terra", status: step(s.stage === "extract", reached(s, "review")) },
    { label: "Apply or hand to a person", tool: "Confidence ≥ 0.85", status: step(s.stage === "review", reached(s, "ready")) },
    { label: "Context card to the shipper", tool: "Order context", status: step(false, reached(s, "ready")) },
  ];
}

const DOT: Record<Status, string> = {
  waiting: "border border-[#b9bfcc] bg-white",
  running: "bg-[#f05a00] shadow-[0_0_0_4px_rgba(240,90,0,0.18)]",
  done: "bg-[#1f2a44]",
};

/** What the agent is doing, in plain steps, and what it has understood so far. */
export function TourAgent({ state: s }: { state: DemoState }) {
  const steps = agentSteps(s);
  const now = steps.find((x) => x.status === "running");
  const found = s.extraction?.fields.slice(0, s.extraction.revealed) ?? [];
  const fields = [
    { k: "When", f: found.find((x) => x.key === "time_window") },
    { k: "Where", f: found.find((x) => x.key === "drop_location") },
    { k: "Who", f: found.find((x) => x.key === "alt_receiver") },
  ];
  const heard = s.call.lines.slice(-2);
  return (
    <div className="ui-card flex h-full flex-col p-5">
      <div className="flex items-center gap-2 text-[17px] font-medium">
        <Mark kind="wave" size={18} className="text-[#f05a00]" />
        Agent run
      </div>
      <div className="mt-1 min-h-[18px] text-[13px] ui-muted">{now ? now.label : s.card ? "Card delivered to the shipper" : "Waiting for the shipper’s tap"}</div>
      <ol className="mt-4 flex-1">
        {steps.map((x, i) => (
          <li key={x.label} className="relative flex gap-3 pb-4">
            {i < steps.length - 1 && <span className="absolute bottom-0 left-[5px] top-4 w-px bg-[#dfe2e8]" />}
            <span className={`relative mt-1 size-[11px] shrink-0 rounded-full transition-colors duration-300 ${DOT[x.status]}`} />
            <div className="min-w-0">
              <div className={`text-[14px] font-medium ${x.status === "waiting" ? "ui-muted" : ""}`}>{x.label}</div>
              <div className="text-[12.5px] ui-muted">{x.tool}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="min-h-[132px] border-t border-[var(--ui-line)] py-3">
        <div className="ui-label">Call transcript</div>
        {heard.length === 0 && <div className="mt-2 text-[13px] ui-muted">No call yet.</div>}
        {heard.map((l) => (
          <p key={l.id} className="mt-2 line-clamp-2 text-[13px] leading-snug">
            <span className="font-medium">{l.who === "buyer" ? "Buyer" : "Alodi"}:</span> {l.text}
          </p>
        ))}
      </div>
      <div className="space-y-2.5 border-t border-[var(--ui-line)] pt-3">
        {fields.map((f) => (
          <div key={f.k} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="ui-muted">{f.k}</span>
            <span className="min-w-0 truncate text-right font-medium">
              {f.f?.value ?? "–"}
              {f.f?.conf != null && <span className="ml-2 font-normal tabular-nums ui-muted">{f.f.conf.toFixed(2)}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
