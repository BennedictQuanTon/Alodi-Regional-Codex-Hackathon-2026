"use client";

import { Wordmark } from "@/components/site/brand";
import { useLiveState, type Outcome } from "@/lib/live/state";

const OUTCOMES: { id: Outcome; label: string; hint: string }[] = [
  { id: "A", label: "No answer", hint: "Alodi chats, then calls" },
  { id: "B", label: "Rescheduled", hint: "Record what the buyer said" },
  { id: "C", label: "Refused", hint: "Goes to a person" },
];

// The real phone in the shipper's hand: no device frame, the phone is the frame.
export function LiveShipper() {
  const { state, sendOutcome } = useLiveState();
  const o = state.order;
  return (
    <main className="ui flex min-h-dvh flex-col bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Wordmark className="text-[24px]" />
        <span className="ui-badge ui-badge-outline flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${state.connected ? "bg-[var(--ui-good)]" : "bg-[var(--ui-warn)]"}`} />
          {state.connected ? "Synced" : "Not connected"}
        </span>
      </header>

      <section className="mt-5 flex-1">
        <div className="ui-label">Current stop</div>
        {o ? (
          <div className="ui-card mt-2 p-5">
            <div className="text-[22px] font-medium">{o.buyer}</div>
            <div className="mt-1 text-[15px] ui-muted">{o.address}</div>
            <div className="mt-3 text-[15px]">
              {o.item} · COD {o.cod}
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-[24px] border border-[#e6e6e6] px-6 py-16 text-center text-[16px] ui-muted">No stop assigned yet.</div>
        )}
        {state.card && (
          <div className="ui-card mt-3 p-5 text-[15px]">
            <div className="ui-label">Context card</div>
            <div className="mt-2 font-medium">{state.card.when}</div>
            <div>{state.card.where}</div>
            <div>{state.card.who}</div>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-2.5">
        {OUTCOMES.map((x) => (
          <button
            key={x.id}
            disabled={!o}
            onClick={() => sendOutcome(x.id)}
            className="flex min-h-[68px] flex-col items-start justify-center rounded-[20px] border border-[#dcdcdc] bg-white px-5 text-left disabled:opacity-60"
          >
            <span className="text-[17px] font-medium">{x.label}</span>
            <span className="text-[13px] ui-muted">{x.hint}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
