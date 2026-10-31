"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { PhoneFrame } from "@/components/demo/phone";
import { Enter, useFit } from "@/components/demo/stage";
import { Wordmark } from "@/components/site/brand";

// Live demo: the interface only. Nothing here is scripted or simulated; it shows empty states until a backend fills
// LiveState. To connect: load the state from the API (see web/src/lib/ai/integrated.ts for the existing client),
// call setState with it, and send the shipper's tap from onOutcome.

type Outcome = "A" | "B" | "C";

export type LiveState = {
  connected: boolean;
  clock: number | null; // minutes since midnight, business time
  order: { id: string; buyer: string; item: string; cod: string } | null;
  messages: { from: "agent" | "buyer"; text: string }[];
  card: { when: string; where: string; who: string; confidence: number } | null;
  events: { at: string; text: string }[];
};

const EMPTY: LiveState = { connected: false, clock: null, order: null, messages: [], card: null, events: [] };

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: "A", label: "No answer" },
  { id: "B", label: "Rescheduled" },
  { id: "C", label: "Refused" },
];

const noSubscribe = () => () => {};
const wallClock = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center px-8 text-center text-[14px] ui-muted">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 text-center text-[13px] font-medium text-[var(--ui-muted)]">{children}</div>;
}

export function LiveStage() {
  const [state] = useState<LiveState>(EMPTY);
  const clock = useSyncExternalStore(noSubscribe, wallClock, () => 0);
  const onOutcome = (outcome: Outcome) => void outcome;
  const BASE_W = 1720;
  const BASE_H = 880;
  const { ref, scale } = useFit(BASE_W, BASE_H);
  const shown = state.clock ?? clock;

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Alodi home">
            <Wordmark className="text-[24px]" />
          </Link>
          <span className="ui-badge ui-badge-outline">Live</span>
        </div>
        <div className="flex items-center gap-2 rounded-[18px] bg-[#ececec] px-4 py-2 text-[13px] font-medium">
          <span className={`size-2 rounded-full ${state.connected ? "bg-[var(--ui-good)]" : "bg-[var(--ui-warn)]"}`} />
          {state.connected ? "Backend connected" : "Backend not connected"}
        </div>
        <Link href="/start" className="ui-btn ui-btn-outline">
          Switch demo
        </Link>
      </header>

      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 flex items-start gap-10 px-14"
          style={{ width: BASE_W, height: BASE_H - 60, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
        >
          <Enter i={0}>
            <Label>Shipper</Label>
            <PhoneFrame clock={shown}>
              <div className="flex h-full flex-col px-5 pb-6 pt-16">
                <div className="flex-1">
                  {state.order ? (
                    <div className="ui-card p-4">
                      <div className="text-[15px] font-medium">{state.order.buyer}</div>
                      <div className="mt-1 text-[13px] ui-muted">{state.order.item} · COD {state.order.cod}</div>
                    </div>
                  ) : (
                    <Empty>No stop assigned yet.</Empty>
                  )}
                </div>
                <div className="grid gap-2">
                  {OUTCOMES.map((o) => (
                    <button key={o.id} className="ui-btn ui-btn-outline w-full disabled:opacity-60" disabled={!state.order} onClick={() => onOutcome(o.id)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </PhoneFrame>
          </Enter>

          <Enter i={1}>
            <Label>Buyer</Label>
            <PhoneFrame clock={shown}>
              <div className="flex h-full flex-col pt-14">
                <div className="flex items-center gap-3 border-b border-[var(--ui-hairline,#eee)] px-5 pb-3">
                  <span className="text-[15px] font-medium">Delivery Assistant</span>
                </div>
                <div className="flex-1 space-y-2 overflow-auto p-4">
                  {state.messages.length ? (
                    state.messages.map((m, i) => (
                      <div key={i} className={`max-w-[80%] rounded-[18px] px-3.5 py-2 text-[14px] ${m.from === "buyer" ? "ml-auto bg-[var(--ui-ink)] text-white" : "bg-[#f1f1f1]"}`}>
                        {m.text}
                      </div>
                    ))
                  ) : (
                    <Empty>No messages yet.</Empty>
                  )}
                </div>
              </div>
            </PhoneFrame>
          </Enter>

          <Enter i={2} className="flex h-full flex-1 flex-col">
            <Label>Operations</Label>
            <div className="ui-card flex h-[704px] flex-col gap-4 p-6">
              <div>
                <div className="ui-label">Order</div>
                <div className="mt-1 text-[24px] font-medium">{state.order?.id ?? "No order selected"}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["when", "where", "who"] as const).map((k) => (
                  <div key={k} className="rounded-[18px] border border-[#e6e6e6] p-4">
                    <div className="ui-label capitalize">{k}</div>
                    <div className="mt-2 text-[16px]">{state.card?.[k] ?? "–"}</div>
                  </div>
                ))}
              </div>
              <div className="min-h-0 flex-1 rounded-[18px] border border-[#e6e6e6] p-4">
                <div className="ui-label">Activity</div>
                {state.events.length ? (
                  <ul className="mt-3 space-y-2 text-[14px]">
                    {state.events.map((ev, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="tabular-nums ui-muted">{ev.at}</span>
                        {ev.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-[85%]">
                    <Empty>Events from the backend appear here.</Empty>
                  </div>
                )}
              </div>
            </div>
          </Enter>
        </div>
      </div>
    </div>
  );
}
