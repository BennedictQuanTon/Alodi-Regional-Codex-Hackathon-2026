"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useDemo } from "@/lib/demo/engine";
import { BASELINE, KPIS, MOCK_CASES, REASONS, RESCUE_DAILY, RESCUE_WEEKLY, type MockCase } from "@/lib/demo/mock-cases";
import { ORDER, fmtClock } from "@/lib/demo/scenarios";
import type { CaseStage, DemoState } from "@/lib/demo/types";
import { STAGE_LABEL } from "@/components/demo/console-parts";
import { LiveCaseDetail, MockCaseDetail, stageChip, stageProgress } from "./case-detail";
import { CountUp, Donut, Legend, LegendRows, RescueLine, SparkBars } from "./charts";
import { DashShell } from "./shell";

const TABS: { k: string; label: string; match: (s: CaseStage) => boolean }[] = [
  { k: "all", label: "All", match: () => true },
  { k: "review", label: "Needs a person", match: (s) => s === "review" || s === "cs" },
  { k: "active", label: "Agent rescuing", match: (s) => ["chat", "call1", "call2", "extract"].includes(s) },
  { k: "ready", label: "Card ready", match: (s) => s === "ready" },
  { k: "closed", label: "Closed", match: (s) => s === "closed" },
];

const TRIGGER: Record<string, string> = { NO_ANSWER: "No answer", RESCHEDULE: "Rescheduled", REFUSED: "Refused", PRE_DELIVERY: "Pre-delivery" };

type Row = { id: string; buyer: string; district: string; trigger: string; stage: CaseStage; courier: string; updated: string; live?: boolean };

const DAILY_LABELS = Array.from({ length: 14 }, (_, i) => `${18 + i} Oct`);
const WEEKLY_LABELS = ["W38", "W39", "W40", "W41", "W42", "W43", "W44"];

function initials(n: string) {
  const p = n.split(" ");
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase();
}

function liveRow(s: DemoState): Row {
  return {
    id: ORDER.tracking,
    buyer: ORDER.buyer,
    district: "Binh Thanh",
    trigger: s.oco.trigger,
    stage: s.stage,
    courier: ORDER.shipper,
    updated: fmtClock(s.clock),
    live: true,
  };
}

export function Overview() {
  const { state, engine } = useDemo();
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const all: Row[] = useMemo(
    () => [
      liveRow(state),
      ...MOCK_CASES.map((c: MockCase) => ({
        id: c.id,
        buyer: c.buyer,
        district: c.district,
        trigger: c.trigger,
        stage: (resolved[c.id] ? "closed" : c.stage) as CaseStage,
        courier: c.courier,
        updated: c.updated,
      })),
    ],
    [state, resolved],
  );
  const t = TABS.find((x) => x.k === tab)!;
  const rows = all.filter((r) => t.match(r.stage));
  const openMock = open && open !== ORDER.tracking ? MOCK_CASES.find((c) => c.id === open) : null;
  const reviewCount = 19 + all.filter((r) => r.stage === "review" || r.stage === "cs").length;

  return (
    <DashShell reviewCount={reviewCount}>
      <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-8 md:py-10">
        <h1 className="d-title text-[40px] leading-[1.1] md:text-[52px]">Depot Overview</h1>
        <p className="mt-2 text-[16px] d-text2">Binh Thanh depot · Saturday 31 October · the live demo case is pinned to the queue.</p>

        {/* KPI cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.08 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="d-tint d-card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[14px] d-text2">{k.label}</span>
                <span className={`d-chip ${k.tone === "good" ? "d-chip-good" : k.tone === "warn" ? "d-chip-warn" : k.tone === "primary" ? "d-chip-primary" : "d-chip-neutral"}`}>
                  {k.badge}
                </span>
              </div>
              <div className="d-num mt-2 text-[40px] leading-none">
                <CountUp value={k.value} />
              </div>
              <div className="mt-5">
                <SparkBars data={k.spark} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <motion.div className="d-card p-6" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="d-title text-[26px]">Rescue Rate Over Time</h2>
                <p className="mt-1 text-[14px] d-muted">Share of failed orders delivered on a later attempt</p>
              </div>
              <div className="flex gap-1">
                {(["daily", "weekly"] as const).map((r) => (
                  <button key={r} onClick={() => setRange(r)} className={`d-chip capitalize ${range === r ? "d-chip-primary" : "text-[var(--d-muted)] hover:bg-[var(--d-raised)]"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Legend items={[{ label: "With Alodi (mock)", color: "c1" }, { label: "Industry baseline", color: "c2" }]} />
            </div>
            <div className="mt-3">
              <RescueLine data={range === "daily" ? RESCUE_DAILY : RESCUE_WEEKLY} baseline={BASELINE} labels={range === "daily" ? DAILY_LABELS : WEEKLY_LABELS} />
            </div>
          </motion.div>
          <motion.div className="d-tint flex flex-col p-6" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <h2 className="d-title text-center text-[24px]">Failure Reasons</h2>
            <div className="mt-5 flex-1">
              <Donut parts={REASONS} center="812" sub="Failed today" />
            </div>
            <div className="mt-6">
              <LegendRows parts={REASONS} />
            </div>
          </motion.div>
        </div>

        {/* Queue */}
        <motion.div id="queue" className="d-card mt-6 scroll-mt-6 overflow-hidden" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
            <h2 className="d-title text-[26px]">Live Exception Queue</h2>
            <Link href="/demo" className="text-[14px] font-semibold text-[var(--d-primary)] hover:underline">
              Run the demo case →
            </Link>
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[var(--d-border)] px-6 d-scroll">
            {TABS.map((x) => {
              const n = all.filter((r) => x.match(r.stage)).length;
              return (
                <button
                  key={x.k}
                  onClick={() => setTab(x.k)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] transition ${
                    tab === x.k ? "border-[var(--d-primary)] font-semibold text-[var(--d-primary)]" : "border-transparent d-muted hover:bg-[var(--d-raised)]"
                  }`}
                >
                  {x.label} <span className="ml-1 tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto d-scroll">
            <table className="w-full min-w-[920px] text-left text-[14px]">
              <thead>
                <tr className="bg-[var(--d-tint)]">
                  {["Tracking ID", "Buyer", "Reason", "Status", "Courier", "Updated", "Progress"].map((h) => (
                    <th key={h} className="px-6 py-3 d-overline">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => {
                  const p = stageProgress(r.stage);
                  const sel = open === r.id;
                  return (
                    <motion.tr
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + ri * 0.035, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => setOpen(r.id)}
                      className={`cursor-pointer border-b border-[var(--d-border)] transition-colors last:border-0 hover:bg-[var(--d-raised)] ${sel ? "bg-[var(--d-raised)]" : ""}`}
                      style={{ boxShadow: sel ? "inset 2px 0 0 var(--d-primary)" : undefined }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 tabular-nums">
                          {r.live && <span className="blink size-1.5 rounded-full bg-[var(--d-primary)]" aria-hidden />}
                          {r.id}
                        </div>
                        {r.live && <div className="text-[11px] font-semibold text-[var(--d-primary)]">Live demo case</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="d-num text-[17px]">{r.buyer}</div>
                        <div className="text-[12px] d-muted">{r.district}</div>
                      </td>
                      <td className="px-6 py-4 d-text2">{TRIGGER[r.trigger]}</td>
                      <td className="px-6 py-4">
                        <span className={`d-chip ${stageChip(r.stage)}`}>{STAGE_LABEL[r.stage]}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-full border-2 border-[var(--d-surface)] bg-[var(--d-raised)] text-[11px] font-semibold">{initials(r.courier)}</span>
                          {r.courier}
                        </span>
                      </td>
                      <td className="px-6 py-4 italic d-text2">{r.updated}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--d-chart-track)]">
                            <motion.div className="h-full rounded-full bg-[var(--d-primary)]" initial={false} animate={{ width: `${p}%` }} transition={{ duration: 0.3 }} />
                          </div>
                          <span className="text-[12px] tabular-nums d-muted">{p}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-10 text-center text-[14px] d-muted">Nothing in this view.</p>}
          </div>
        </motion.div>
        <p className="mt-4 text-[12px] d-muted">All figures on this page are mock data for the demo.</p>
      </div>

      {/* Slide-over detail */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(null)}
            />
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
              {openMock ? (
                <MockCaseDetail c={openMock} resolved={resolved[openMock.id]} onResolve={(v) => setResolved({ ...resolved, [openMock.id]: v })} />
              ) : (
                <LiveCaseDetail state={state} engine={engine} />
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Link
        href="/demo"
        className="fixed bottom-6 right-6 z-30 grid size-14 place-items-center rounded-full bg-[var(--d-primary)] text-[20px] text-white shadow-[0_8px_24px_rgba(209,78,0,0.35)] transition hover:scale-105"
        aria-label="Open live demo"
        title="Open live demo"
      >
        ▸
      </Link>
    </DashShell>
  );
}
