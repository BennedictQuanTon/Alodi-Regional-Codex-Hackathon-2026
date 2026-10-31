"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PhoneFrame } from "@/components/demo/phone";
import { useFit } from "@/components/demo/stage";
import { Mark, Wordmark } from "@/components/site/brand";
import { AGENT_STEPS, useLiveState, type LiveState, type StepStatus } from "@/lib/live/state";

// Live demo stage. The shipper's screen runs on a real phone (/live/shipper); this screen shows everything that
// happens around it: the customer's phone, the SPX dashboard and the agent's run.

const noSubscribe = () => () => {};
const wallClock = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 rounded-[18px] bg-[#ececec] px-3.5 py-1.5 text-[13px] font-medium">
      <span className={`size-2 rounded-full ${on ? "bg-[var(--ui-good)]" : "bg-[var(--ui-warn)]"}`} />
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-center text-[13px] font-medium text-[var(--ui-muted)]">{children}</div>;
}

function CustomerPhone({ state, clock }: { state: LiveState; clock: number }) {
  const calling = state.call.status !== "idle";
  return (
    <PhoneFrame clock={clock}>
      <div className="flex h-full flex-col pt-14">
        <div className="border-b border-[#eee] px-5 pb-3 text-[15px] font-medium">Delivery Assistant</div>
        {calling && (
          <div className="border-b border-[#eee] bg-[#fff1e7] px-5 py-3 text-[14px]">
            <div className="font-medium">{state.call.status === "ringing" ? "Incoming call" : "On a call with Alodi"}</div>
            <div className="mt-0.5 ui-muted">{state.call.caption}</div>
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-auto p-4">
          {state.messages.length ? (
            state.messages.map((m, i) => (
              <div key={i} className={`max-w-[80%] rounded-[18px] px-3.5 py-2 text-[14px] ${m.from === "buyer" ? "ml-auto bg-[var(--ui-ink)] text-white" : "bg-[#f1f1f1]"}`}>
                {m.text}
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center text-[14px] ui-muted">No messages yet.</div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

const DOT: Record<StepStatus, string> = {
  waiting: "border border-[#b9bfcc] bg-white",
  running: "bg-[#f05a00]",
  done: "bg-[#1f2a44]",
  person: "bg-[#c8921a]",
};

function AgentRun({ state }: { state: LiveState }) {
  const running = AGENT_STEPS.find((s) => state.steps[s.id]?.status === "running");
  return (
    <div className="ui-card flex h-full flex-col p-5">
      <div className="flex items-center gap-2 text-[17px] font-medium">
        <Mark kind="wave" size={18} className="text-[#f05a00]" />
        Agent run
      </div>
      <div className="mt-1 text-[13px] ui-muted">{running ? running.label : "Waiting for the shipper’s tap"}</div>
      <ol className="mt-4 flex-1">
        {AGENT_STEPS.map((s, i) => {
          const st = state.steps[s.id];
          return (
            <li key={s.id} className="relative flex gap-3 pb-3.5">
              {i < AGENT_STEPS.length - 1 && <span className="absolute bottom-0 left-[5px] top-4 w-px bg-[#dfe2e8]" />}
              <span className={`relative mt-1 size-[11px] shrink-0 rounded-full ${DOT[st?.status ?? "waiting"]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[14px] font-medium">
                  {s.label}
                  {st?.at && <span className="font-normal tabular-nums ui-muted">{st.at}</span>}
                </div>
                <div className="text-[12.5px] ui-muted">{st?.detail ?? s.tool}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="grid grid-cols-3 gap-2 border-t border-[#eee] pt-3">
        {(["when", "where", "who"] as const).map((k) => (
          <div key={k}>
            <div className="ui-label capitalize">{k}</div>
            <div className="mt-1 text-[13px]">{state.card?.[k] ?? "–"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The dashboard page itself, drawn at desktop size and scaled to the panel so it stays identical to /console.
const DASH_W = 1440;
const DASH_H = 1052;
const DASH_SCALE = 0.669;

export function LiveStage() {
  const { state } = useLiveState();
  const clock = useSyncExternalStore(noSubscribe, wallClock, () => 0);
  const BASE_W = 1760;
  const BASE_H = 790;
  const { ref, scale } = useFit(BASE_W, BASE_H);

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Alodi home">
            <Wordmark className="text-[24px]" />
          </Link>
          <span className="ui-badge ui-badge-outline">Live</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill on={state.shipperOnline}>{state.shipperOnline ? "Shipper phone synced" : "Waiting for shipper phone"}</Pill>
          <Pill on={state.connected}>{state.connected ? "Backend connected" : "Backend not connected"}</Pill>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/live/shipper" target="_blank" className="ui-btn ui-btn-ghost">
            Shipper screen
          </Link>
          <Link href="/start" className="ui-btn ui-btn-outline">
            Switch demo
          </Link>
        </div>
      </header>

      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 flex items-stretch gap-6 px-6"
          style={{ width: BASE_W, height: BASE_H - 20, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
        >
          <div className="shrink-0">
            <Label>Customer</Label>
            <CustomerPhone state={state} clock={clock} />
          </div>
          <div className="min-w-0 flex-1">
            <Label>SPX dashboard</Label>
            <div className="ui-card h-[704px] overflow-hidden p-0">
              <iframe
                src="/console"
                title="SPX hub dashboard"
                className="origin-top-left border-0"
                style={{ width: DASH_W, height: DASH_H, transform: `scale(${DASH_SCALE})` }}
              />
            </div>
          </div>
          <div className="w-[360px] shrink-0">
            <Label>Agent</Label>
            <div className="h-[704px]">
              <AgentRun state={state} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
