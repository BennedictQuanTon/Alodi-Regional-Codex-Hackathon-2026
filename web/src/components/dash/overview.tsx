"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseStage } from "@/lib/demo/types";
import type { RouteRow, QueueRow } from "@/lib/dash/hub-day";
import { useDashboard, caseStage, type DashboardData, type DashboardDay } from "@/lib/dash/live-dashboard";
import { STAGE_LABEL } from "@/components/demo/console-parts";
import { stageChip, stageProgress } from "./case-detail";
import { CountUp } from "./charts";
import { DashShell } from "./shell";

const EASE = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (a: number, b: number) => `${(b ? (a / b) * 100 : 0).toFixed(1)}%`;

const TABS: { k: string; label: string; match: (s: CaseStage) => boolean }[] = [
  { k: "all", label: "All", match: () => true },
  { k: "review", label: "Needs a person", match: (s) => s === "review" || s === "cs" },
  { k: "active", label: "Agent rescuing", match: (s) => ["chat", "call1", "call2", "extract"].includes(s) },
  { k: "ready", label: "Card ready", match: (s) => s === "ready" },
  { k: "closed", label: "Closed", match: (s) => s === "closed" },
];

const TRIGGER: Record<string, string> = { NO_ANSWER: "No answer", RESCHEDULE: "Rescheduled", REFUSED: "Refused", PRE_DELIVERY: "Pre-delivery" };

type Row = { id: string; buyer: string; district: string; trigger: string; stage: CaseStage; shipper: string; updated: string; live?: boolean };


function Card({ title, sub, right, children, className = "", id }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <motion.section
      id={id}
      className={`d-card scroll-mt-6 p-5 md:p-6 ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="d-title text-[17px]">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] d-muted">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

/* ---------- KPI strip ---------------------------------------------------- */

function KpiStrip({ day: DAY }: { day: DashboardDay }) {
const failed = DAY.failed_first_attempt.total;
const KPI = [
  { label: "Orders today", value: fmt(DAY.orders), note: `${fmt(DAY.attempted_today)} attempted · ${fmt(DAY.morning.cannot_today)} moved to tomorrow` },
  { label: "Delivered first time", value: fmt(DAY.delivered_first_attempt), note: `${pct(DAY.delivered_first_attempt, DAY.attempted_today)} of attempts` },
  { label: "Failed first time", value: fmt(failed), note: `${pct(failed, DAY.attempted_today)} · No answer ${DAY.failed_first_attempt.A} · Resched. ${DAY.failed_first_attempt.B} · Refused ${DAY.failed_first_attempt.C}` },
  { label: "Rescued, card sent", value: fmt(DAY.rescheduled_with_card), note: `${pct(DAY.rescheduled_with_card, failed)} of failed`, primary: true },
  { label: "With customer service", value: fmt(DAY.cs_queue.total), note: `Refused ${DAY.cs_queue.refused} · unreachable ${DAY.cs_queue.unreachable} · low conf. ${DAY.cs_queue.low_confidence}` },
];
  return (
    <div className="d-card grid overflow-hidden sm:grid-cols-2 xl:grid-cols-5">
      {KPI.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.05, duration: 0.5, ease: EASE }}
          className={`border-[var(--d-border)] p-5 ${i > 0 ? "border-t sm:border-t-0 xl:border-l" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t xl:border-t-0" : ""}`}
        >
          <div className="text-[13px] d-text2">{k.label}</div>
          <div className={`d-num mt-2 text-[32px] leading-none ${k.primary ? "text-[var(--d-primary)]" : ""}`}>
            <CountUp value={k.value} />
          </div>
          <div className="mt-2 text-[12px] leading-[1.4] d-muted">{k.note}</div>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- rescue pipeline (the eight business steps) ------------------ */

type Seg = { label: string; n: number; tone?: "primary" | "good" | "warn" | "muted" };
function pipelineStages(DAY: DashboardDay) {
const result: { step: string; title: string; total: number; segs: Seg[] }[] = [
  {
    step: "1–3",
    title: "Morning window question",
    total: DAY.window_questions_sent,
    segs: [
      { label: "Picked windows", n: DAY.morning.windows, tone: "good" },
      { label: "Can’t today", n: DAY.morning.cannot_today, tone: "warn" },
      { label: "No reply", n: DAY.morning.no_reply, tone: "muted" },
    ],
  },
  {
    step: "4",
    title: "Shipper taps after a failed attempt",
    total: DAY.failed_first_attempt.total,
    segs: [
      { label: "A · No answer", n: DAY.failed_first_attempt.A, tone: "primary" },
      { label: "B · Rescheduled", n: DAY.failed_first_attempt.B, tone: "good" },
      { label: "Refused", n: DAY.failed_first_attempt.C, tone: "warn" },
    ],
  },
  {
    step: "5",
    title: "Flow A · chat, then call if silent",
    total: DAY.flow_a.chat_sent,
    segs: [
      { label: "Replied in chat", n: DAY.flow_a.replied_in_chat, tone: "good" },
      { label: "Answered call 1", n: DAY.flow_a.call_1_answered, tone: "good" },
      { label: "Answered call 2", n: DAY.flow_a.call_2_answered, tone: "good" },
      { label: "Opted out", n: DAY.opt_out, tone: "muted" },
      { label: "Unreachable → CS", n: DAY.flow_a.unreachable_to_cs, tone: "warn" },
    ],
  },
  {
    step: "6–7",
    title: "Extraction and decision",
    total: DAY.extraction.auto_applied + DAY.extraction.confirmed_in_chat + DAY.extraction.cs_review,
    segs: [
      { label: "Auto-applied ≥ 0.85", n: DAY.extraction.auto_applied, tone: "good" },
      { label: "Confirmed in chat", n: DAY.extraction.confirmed_in_chat, tone: "primary" },
      { label: "CS review", n: DAY.extraction.cs_review, tone: "warn" },
    ],
  },
  {
    step: "8",
    title: "Customer service queue",
    total: DAY.cs_queue.total,
    segs: [
      { label: "Refused at door", n: DAY.cs_queue.refused, tone: "warn" },
      { label: "Unreachable", n: DAY.cs_queue.unreachable, tone: "warn" },
      { label: "Low confidence", n: DAY.cs_queue.low_confidence, tone: "muted" },
    ],
  },
];

return result;
}

const TONE: Record<NonNullable<Seg["tone"]>, string> = {
  primary: "var(--d-primary)",
  good: "var(--d-text)",
  warn: "var(--d-chart-3)",
  muted: "var(--d-chart-track)",
};

function Pipeline({ day }: { day: DashboardDay }) {
  const STAGES = pipelineStages(day);
  return (
    <div className="divide-y divide-[var(--d-border)]">
      {STAGES.map((s, si) => (
        <div key={s.step} className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[220px_1fr] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--d-primary)]">Step {s.step}</div>
            <div className="mt-0.5 text-[14px] font-medium">{s.title}</div>
            <div className="text-[12px] d-muted tabular-nums">{fmt(s.total)} orders</div>
          </div>
          <div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {s.segs.map((g, gi) => (
                <motion.div
                  key={g.label}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ background: TONE[g.tone ?? "muted"] }}
                  initial={{ flexGrow: 0 }}
                  animate={{ flexGrow: g.n }}
                  transition={{ delay: 0.2 + si * 0.08 + gi * 0.04, duration: 0.8, ease: EASE }}
                  title={`${g.label}: ${fmt(g.n)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              {s.segs.map((g) => (
                <span key={g.label} className="flex items-center gap-1.5 d-text2">
                  <span className="size-2 rounded-full" style={{ background: TONE[g.tone ?? "muted"] }} />
                  {g.label} <span className="tabular-nums font-semibold text-[var(--d-text)]">{fmt(g.n)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- failures by hour + guard ------------------------------------ */

function FailsByHour({ rows: FAILS_BY_HOUR }: { rows: DashboardData["fails_by_hour"] }) {
  const max = Math.max(1, ...FAILS_BY_HOUR.map((h) => h.a + h.b + h.refused));
  const keys = [
    { k: "a", label: "No answer", c: "var(--d-primary)" },
    { k: "b", label: "Rescheduled", c: "var(--d-text)" },
    { k: "refused", label: "Refused", c: "var(--d-chart-3)" },
  ] as const;
  return (
    <div>
      <div className="flex h-[150px] items-end gap-1.5">
        {FAILS_BY_HOUR.map((h, i) => {
          const tot = h.a + h.b + h.refused;
          return (
            <div key={h.h} className="group flex h-full flex-1 flex-col justify-end" title={`${h.h}:00 · No answer ${h.a} · Rescheduled ${h.b} · Refused ${h.refused}`}>
              <div className="mb-1 text-center text-[10px] tabular-nums opacity-0 transition group-hover:opacity-100 d-muted">{tot}</div>
              <motion.div
                className="flex flex-col-reverse overflow-hidden rounded-t-[4px]"
                initial={{ height: 0 }}
                animate={{ height: `${(tot / max) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.03, duration: 0.7, ease: EASE }}
              >
                {keys.map((k) => (
                  <div key={k.k} style={{ background: k.c, flexGrow: h[k.k] }} />
                ))}
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-[var(--d-border)] pt-2">
        {FAILS_BY_HOUR.map((h) => (
          <div key={h.h} className="flex-1 text-center text-[10px] tabular-nums d-muted">
            {h.h}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] d-text2">
        {keys.map((k) => (
          <span key={k.k} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: k.c }} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Guard({ day: DAY, policy }: { day: DashboardDay; policy: DashboardData["policy_guard"] }) {
  const measured = (value: number | null) => value === null ? "Not measured" : String(value);
const GUARD = [
  { k: "Calls outside 08:00–20:30", v: measured(policy.calls_outside_window), ok: policy.calls_outside_window === 0 },
  { k: "Cycles over 2 calls", v: measured(policy.cycles_over_two_calls), ok: policy.cycles_over_two_calls === 0 },
  { k: "Labels applied without a person", v: measured(policy.labels_without_human), ok: policy.labels_without_human === 0 },
  { k: "Buyers who opted out (contact stopped)", v: String(DAY.opt_out), ok: true },
  { k: "AI calls placed", v: fmt(DAY.calls_placed) },
  { k: "Answered call minutes", v: `${DAY.call_minutes_answered}` },
  { k: "Messages sent", v: fmt(DAY.messages_sent) },
  { k: "Shipper memo audio", v: DAY.memo_seconds === null ? "Not measured" : `${Math.round(DAY.memo_seconds / 60)} min` },
];
  return (
    <ul className="divide-y divide-[var(--d-border)]">
      {GUARD.map((g) => (
        <li key={g.k} className="flex items-center justify-between gap-4 py-2.5 text-[13px] first:pt-0 last:pb-0">
          <span className="d-text2">{g.k}</span>
          <span className={`tabular-nums font-semibold ${g.ok ? "text-[var(--d-good)]" : ""}`}>{g.v}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- routes ------------------------------------------------------ */

type SortKey = "route" | "failed" | "rate";
const routeFailed = (r: RouteRow) => r.a + r.b + r.refused;
const routeRate = (r: RouteRow) => routeFailed(r) / Math.max(1, r.delivered + routeFailed(r));

function Routes({ rows: ROUTES }: { rows: RouteRow[] }) {
  const [sort, setSort] = useState<SortKey>("failed");
  const rows = useMemo(() => {
    const out = [...ROUTES];
    if (sort === "failed") out.sort((a, b) => routeFailed(b) - routeFailed(a));
    if (sort === "rate") out.sort((a, b) => routeRate(b) - routeRate(a));
    return out;
  }, [sort, ROUTES]);
  const worst = Math.max(0.001, ...ROUTES.map(routeRate));
  return (
    <>
      <div className="-mt-1 mb-3 flex gap-1">
        {(
          [
            ["failed", "Most failed"],
            ["rate", "Highest fail rate"],
            ["route", "Route"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`d-chip ${sort === k ? "d-chip-primary" : "d-muted hover:bg-[var(--d-raised)]"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="d-scroll -mx-5 max-h-[420px] overflow-auto md:-mx-6">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="sticky top-0 bg-[var(--d-surface)]">
            <tr className="border-b border-[var(--d-border)]">
              {["Route", "Shipper", "Ward", "Orders", "Delivered", "No ans.", "Resched.", "Refused", "Rescued", "CS", "Fail rate"].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 d-overline first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${i >= 3 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => {
              const rate = routeRate(r);
              return (
                <tr key={r.route} className="border-b border-[var(--d-border)] last:border-0 hover:bg-[var(--d-raised)]">
                  <td className="px-3 py-2.5 pl-5 font-medium md:pl-6">{r.route.replace("HCM-BTH-", "")}</td>
                  <td className="px-3 py-2.5">{r.shipper}</td>
                  <td className="px-3 py-2.5 d-text2">{r.ward}</td>
                  <td className="px-3 py-2.5 text-right">{r.orders}</td>
                  <td className="px-3 py-2.5 text-right">{r.delivered}</td>
                  <td className="px-3 py-2.5 text-right">{r.a}</td>
                  <td className="px-3 py-2.5 text-right">{r.b}</td>
                  <td className="px-3 py-2.5 text-right">{r.refused}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[var(--d-primary)]">{r.rescued}</td>
                  <td className="px-3 py-2.5 text-right">{r.cs}</td>
                  <td className="px-3 py-2.5 pr-5 md:pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1 w-14 overflow-hidden rounded-full bg-[var(--d-chart-track)]">
                        <div className="h-full rounded-full" style={{ width: `${(rate / worst) * 100}%`, background: rate === worst ? "var(--d-warn)" : "var(--d-text-2)" }} />
                      </div>
                      <span className="w-11 text-right">{(rate * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- CS backlog from the mock day -------------------------------- */

const REASONS = ["All", "Refused at door", "Unreachable after 2 calls", "Low confidence"] as const;

function CsBacklog({ rows: CS_QUEUE }: { rows: QueueRow[] }) {
  const [r, setR] = useState<(typeof REASONS)[number]>("All");
  const [all, setAll] = useState(false);
  const list = CS_QUEUE.filter((q) => r === "All" || q.reason === r);
  const shown = all ? list : list.slice(0, 10);
  return (
    <>
      <div className="-mt-1 mb-3 flex flex-wrap gap-1">
        {REASONS.map((x) => (
          <button key={x} onClick={() => setR(x)} className={`d-chip ${r === x ? "d-chip-primary" : "d-muted hover:bg-[var(--d-raised)]"}`}>
            {x} <span className="tabular-nums opacity-70">{x === "All" ? CS_QUEUE.length : CS_QUEUE.filter((q) => q.reason === x).length}</span>
          </button>
        ))}
      </div>
      <div className="d-scroll -mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--d-border)]">
              {["Tracking ID", "Buyer", "Item", "COD", "Shipper", "Tap", "Reason", "At"].map((h) => (
                <th key={h} className="px-3 py-2.5 d-overline first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((q) => (
              <tr key={q.id} className="border-b border-[var(--d-border)] last:border-0 hover:bg-[var(--d-raised)]">
                <td className="px-3 py-2.5 pl-5 tabular-nums md:pl-6">{q.id}</td>
                <td className="px-3 py-2.5">
                  {q.buyer}
                  <div className="text-[11px] d-muted">{q.ward}</div>
                </td>
                <td className="px-3 py-2.5 d-text2">{q.item}</td>
                <td className="px-3 py-2.5 tabular-nums">{fmt(q.cod)}</td>
                <td className="px-3 py-2.5 d-text2">{q.shipper}</td>
                <td className="px-3 py-2.5 d-text2">{q.tap}</td>
                <td className="px-3 py-2.5">
                  <span className={`d-chip ${q.reason === "Low confidence" ? "d-chip-neutral" : "d-chip-warn"}`}>{q.reason}</span>
                </td>
                <td className="px-3 py-2.5 pr-5 tabular-nums d-muted md:pr-6">{q.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > 10 && (
        <button onClick={() => setAll(!all)} className="d-btn d-btn-secondary d-btn-sm mt-4">
          {all ? "Show fewer" : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}

/* ---------- page -------------------------------------------------------- */

export function Overview() {
  const { data, observed, error } = useDashboard();
  const { day: DAY, hub: HUB, routes: ROUTES, cs_queue: CS_QUEUE } = data;
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  const all: Row[] = useMemo(() => data.cases.map((row) => ({ id: row.id, buyer: row.buyer, district: row.district, trigger: row.trigger || "", stage: caseStage(row), shipper: row.shipper, updated: row.updated, live: row.id === data.selected_order?.tracking_id })), [data.cases, data.selected_order]);
  const t = TABS.find((x) => x.k === tab)!;
  const rows = all.filter((r) => t.match(r.stage));
  const selectedCase = data.cases.find((row) => row.id === open);
  const actualResult = [...observed.records].reverse().find((record) => record.type === "result")?.payload;
  const actualProposal = [...observed.records].reverse().find((record) => record.type === "proposal")?.payload;
  const selectedJson = { order: data.selected_order, result: actualResult, proposal: actualProposal };
  const jsonDetails = useRef<HTMLDetailsElement>(null);
  const openedGeneration = useRef<string | undefined>(undefined);
  const hasSavedResult = !!actualResult || !!data.selected_order?.context_card;
  useEffect(() => {
    if (hasSavedResult && data.generation_id && openedGeneration.current !== data.generation_id && jsonDetails.current) {
      jsonDetails.current.open = true;
      openedGeneration.current = data.generation_id;
    }
  }, [hasSavedResult, data.generation_id]);

  return (
    <DashShell>
      <div className="mx-auto max-w-[1280px] px-5 py-7 md:px-8 md:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] d-muted">
              {HUB.id} · {HUB.date || "Waiting for backend"}
            </div>
            <h1 className="d-title mt-1 text-[28px] leading-[1.15] md:text-[32px]">{HUB.name}</h1>
            <p className="mt-1 text-[14px] d-text2">
              {HUB.shippers} shippers · {HUB.wards.join(", ")} · morning run {HUB.morningRun}, route cut-off {HUB.cutoff} · calls {HUB.callHours}
            </p>
          </div>
          <span className="d-chip d-chip-neutral">{error ? "Backend updates unavailable" : data.data_label}</span>
        </div>

        <div className="mt-6">
          <KpiStrip day={DAY} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <Card title="Rescue pipeline" sub="Every failed delivery, step by step through the agent’s flow" right={<details ref={jsonDetails} className="min-w-0 text-[12px] d-muted"><summary>Selected order JSON</summary><pre className="mt-2 max-h-60 max-w-[520px] overflow-auto whitespace-pre-wrap break-words font-sans">{JSON.stringify(selectedJson, null, 2)}</pre></details>}>
            <Pipeline day={DAY} />
          </Card>
          <div className="grid gap-4">
            <Card title="Failures by hour" sub="First-attempt failures, by shipper tap">
              <FailsByHour rows={data.fails_by_hour} />
            </Card>
            <Card title="Policy guard" sub="Hard rules, checked before every action">
              <Guard day={DAY} policy={data.policy_guard} />
            </Card>
          </div>
        </div>

        {/* Live exception queue: the scripted demo case plus hand-written cases with full detail */}
        <motion.section
          id="queue"
          className="d-card mt-4 scroll-mt-6 overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 md:px-6 md:pt-6">
            <div>
              <h2 className="d-title text-[17px]">Live exception queue</h2>
              <p className="mt-0.5 text-[13px] d-muted">Open a case for its transcript, extracted fields and the decision</p>
            </div>
            <Link href="/live" target="_top" className="d-btn d-btn-primary d-btn-sm">
              Run the demo case
            </Link>
          </div>
          <div className="d-scroll mt-4 flex gap-1 overflow-x-auto border-b border-[var(--d-border)] px-5 md:px-6">
            {TABS.map((x) => {
              const n = all.filter((r) => x.match(r.stage)).length;
              return (
                <button
                  key={x.k}
                  onClick={() => setTab(x.k)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition ${
                    tab === x.k ? "border-[var(--d-primary)] font-semibold text-[var(--d-text)]" : "border-transparent d-muted hover:text-[var(--d-text)]"
                  }`}
                >
                  {x.label} <span className="ml-1 tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="d-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--d-border)]">
                  {["Tracking ID", "Buyer", "Reason", "Status", "Shipper", "Updated", "Progress"].map((h) => (
                    <th key={h} className="px-5 py-2.5 d-overline md:px-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = stageProgress(r.stage);
                  const sel = open === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setOpen(r.id)}
                      className={`cursor-pointer border-b border-[var(--d-border)] transition-colors last:border-0 hover:bg-[var(--d-raised)] ${sel ? "bg-[var(--d-raised)]" : ""}`}
                      style={{ boxShadow: sel ? "inset 2px 0 0 var(--d-primary)" : undefined }}
                    >
                      <td className="px-5 py-3 md:px-6">
                        <div className="flex items-center gap-2 tabular-nums">
                          {r.live && <span className="blink size-1.5 rounded-full bg-[var(--d-primary)]" aria-hidden />}
                          {r.id}
                        </div>
                        {r.live && <div className="text-[11px] font-semibold text-[var(--d-primary)]">Live demo case</div>}
                      </td>
                      <td className="px-5 py-3 md:px-6">
                        <div className="font-medium">{r.buyer}</div>
                        <div className="text-[11px] d-muted">{r.district}</div>
                      </td>
                      <td className="px-5 py-3 d-text2 md:px-6">{TRIGGER[r.trigger]}</td>
                      <td className="px-5 py-3 md:px-6">
                        <span className={`d-chip ${stageChip(r.stage)}`}>{STAGE_LABEL[r.stage]}</span>
                      </td>
                      <td className="px-5 py-3 d-text2 md:px-6">{r.shipper}</td>
                      <td className="px-5 py-3 tabular-nums d-muted md:px-6">{r.updated}</td>
                      <td className="px-5 py-3 md:px-6">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-[var(--d-chart-track)]">
                            <motion.div className="h-full rounded-full bg-[var(--d-primary)]" initial={false} animate={{ width: `${p}%` }} transition={{ duration: 0.3 }} />
                          </div>
                          <span className="text-[12px] tabular-nums d-muted">{p}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-10 text-center text-[13px] d-muted">Nothing in this view.</p>}
          </div>
        </motion.section>

        <div className="mt-4 grid gap-4 2xl:grid-cols-2">
          <Card id="routes" title="Routes" sub={`${ROUTES.length} routes from the current backend generation`}>
            <Routes rows={ROUTES} />
          </Card>
          <Card id="cs" title="Customer service queue" sub={`${CS_QUEUE.length} cases from the current backend, newest first`}>
            <CsBacklog rows={CS_QUEUE} />
          </Card>
        </div>

        <p className="mt-4 text-[12px] d-muted">
          {error || "Current-generation backend records. Synthetic demo orders; no live carrier integration. Unavailable measurements are labelled."}
        </p>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
            <motion.aside
              className="d-scroll fixed inset-y-0 right-0 z-50 w-full max-w-[460px] overflow-y-auto border-l border-[var(--d-border)] bg-[var(--d-bg)] p-7 shadow-[0_24px_48px_rgba(18,26,44,0.18)]"
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              aria-label="Case detail"
            >
              <button onClick={() => setOpen(null)} className="d-btn d-btn-secondary d-btn-sm mb-6">
                Close
              </button>
              <div className="d-card p-5"><h2 className="d-title text-[20px]">{selectedCase?.buyer || "Selected delivery"}</h2><p className="mt-1 text-[13px] d-muted">{open}</p><p className="mt-4 text-[14px]">{selectedCase?.state || selectedCase?.status}</p><details open className="mt-4 text-[13px]"><summary>Actual backend state and outcome</summary><pre className="mt-3 overflow-auto whitespace-pre-wrap break-words font-sans text-[12px]">{JSON.stringify(open === data.selected_order?.tracking_id ? selectedJson : selectedCase, null, 2)}</pre></details>{open === data.selected_order?.tracking_id && <div className="mt-5 space-y-3 text-[13px]">{(observed.transcripts || []).map((record) => <p key={`${record.call_id}:${record.payload.speaker}:${record.payload.utterance_id ?? record.payload.turn_id}`}><strong>{String(record.payload.speaker)}</strong> {String(record.payload.text || "")}</p>)}</div>}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </DashShell>
  );
}
