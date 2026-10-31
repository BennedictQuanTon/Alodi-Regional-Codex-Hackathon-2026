"use client";

import { useEffect, useState } from "react";
import type { DAY, HUB, RouteRow, QueueRow } from "./hub-day";
import type { CaseStage } from "../demo/types";
import { DEMO_ORDER, LiveOrderMonitor, type MonitorState } from "../ai/live-demo";
import { errorMessage, request } from "../ai/protocol";
import { liveApiBase } from "../live/session";

type Widen<T> = { [K in keyof T]: T[K] extends number ? number : T[K] extends string ? string : T[K] extends readonly string[] ? string[] : T[K] extends object ? Widen<T[K]> : T[K] };
export type DashboardDay = Omit<Widen<typeof DAY>, "memo_seconds"> & { memo_seconds: number | null };
export type DashboardCase = { id: string; buyer: string; district: string; trigger: string | null; state: string; status: string; shipper: string; updated: string; context_version: number; generation_id: string };
export type DashboardData = {
  generation_id: string; business_time: string; data_source: string; data_label: string;
  hub: Widen<typeof HUB>; day: DashboardDay; routes: RouteRow[];
  fails_by_hour: { h: string; a: number; b: number; refused: number }[];
  cs_queue: QueueRow[]; cases: DashboardCase[]; selected_order: Record<string, unknown> | null;
  policy_guard: { calls_outside_window: number | null; cycles_over_two_calls: number | null; labels_without_human: number | null; opt_out_contact_violations: number | null; call_minutes_answered: number | null; memo_seconds: number | null };
};

export const EMPTY_DASHBOARD: DashboardData = {
  generation_id: "", business_time: "", data_source: "", data_label: "Waiting for backend",
  hub: { id: "—", name: "Hub dashboard", date: "", shippers: 0, wards: [], morningRun: "—", cutoff: "—", callHours: "—" },
  day: { orders: 0, window_questions_sent: 0, morning: { windows: 0, cannot_today: 0, no_reply: 0 }, attempted_today: 0, delivered_first_attempt: 0, failed_first_attempt: { A: 0, B: 0, C: 0, total: 0 }, flow_a: { chat_sent: 0, replied_in_chat: 0, call_1: 0, call_1_answered: 0, call_2: 0, call_2_answered: 0, unreachable_to_cs: 0, calls_moved_to_next_morning: 0 }, flow_b: { memos: 0 }, extraction: { auto_applied: 0, confirmed_in_chat: 0, cs_review: 0 }, opt_out: 0, cs_queue: { refused: 0, unreachable: 0, low_confidence: 0, total: 0 }, rescheduled_with_card: 0, messages_sent: 0, call_minutes_answered: 0, memo_seconds: null, calls_placed: 0, scripted_demo_orders: 0 },
  routes: [], fails_by_hour: [], cs_queue: [], cases: [], selected_order: null,
  policy_guard: { calls_outside_window: null, cycles_over_two_calls: null, labels_without_human: null, opt_out_contact_violations: null, call_minutes_answered: null, memo_seconds: null },
};

export function caseStage(row: DashboardCase): CaseStage {
  const stages: Record<string, CaseStage> = { morning: "pre", out_for_delivery: "delivering", chat_pending: "chat", call_1_due: "chat", call_2_due: "call2", calling: "call1", confirm_in_chat: "extract", needs_review: "review", with_cs: "cs", rescheduled: "ready", moved: "ready", delivered: "closed", labelled: "closed", cancelled: "closed", returned: "closed" };
  return stages[row.state] || stages[row.status] || "pre";
}

/** Read-only dashboard and observation polling. This iframe owns no pairing or audio. */
export function useDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [observed, setObserved] = useState<MonitorState>({ records: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    const base = liveApiBase(window.location);
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const monitor = new LiveOrderMonitor(base, DEMO_ORDER, true);
    const stop = monitor.subscribe(() => setObserved(monitor.snapshot()));
    monitor.start();
    const poll = async () => {
      try {
        const next = await request<DashboardData>("/demo/dashboard", { signal: abort.signal }, base);
        if (!abort.signal.aborted) { setData(next); setError(""); }
      } catch (error) { if (!abort.signal.aborted) setError(errorMessage(error)); }
      if (!abort.signal.aborted) timer = setTimeout(poll, 1000);
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); stop(); monitor.stop(); };
  }, []);
  const current = observed.generation === data.generation_id ? observed : { records: [] };
  return { data, observed: current as MonitorState, error };
}
