"use client";

import { Mark, Wordmark } from "@/components/site/brand";
import { useLiveState } from "@/lib/live/state";

// The real phone in the shipper's hand: no device frame, the phone is the frame.
export function LiveShipper() {
  const { state, sendOutcome, connect, enableSound, answer, end, setMuted, reset } = useLiveState("phone");
  const connection = state.connection;
  const active = !state.finishing && ["answering", "connected"].includes(connection.status);
  const muted = !!connection.voice?.muted;
  const paired = !["disconnected", "error"].includes(connection.status);
  const o = state.order;
  return (
    <main className="ui flex min-h-dvh flex-col bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      {!state.finishing && connection.canAnswer && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#121a2c] px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(56px,env(safe-area-inset-top))] text-center text-white" role="alertdialog" aria-label="Incoming call from Alodi">
          <div>
            <div className="text-[15px] text-white/70">Incoming call</div>
            <div className="mt-2 text-[34px] font-medium leading-tight">Alodi</div>
            <div className="mt-1 text-[16px] text-white/70">AI delivery assistant</div>
          </div>
          <div className="relative flex size-36 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#f05a00]/30 motion-safe:animate-ping" />
            <span className="relative flex size-28 items-center justify-center rounded-full bg-[#f05a00]">
              <Mark kind="wave" size={72} ring="#fff" className="text-white" />
            </span>
          </div>
          <div className="w-full">
            <p className="mb-4 text-[13px] text-white/70">Accepting turns on this phone’s microphone.</p>
            <button className="ui-btn ui-btn-accent min-h-[76px] w-full !rounded-full text-[20px] font-medium" onClick={() => void answer()} disabled={state.resetting || state.mode !== "live"}>Accept call</button>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between">
        <Wordmark className="text-[24px]" />
        <span className="ui-badge ui-badge-outline flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${state.shipperOnline ? "bg-[var(--ui-good)]" : "bg-[var(--ui-warn)]"}`} />
          {state.shipperOnline ? "Synced" : "Not connected"}
        </span>
      </header>

      <section className="mt-5 flex-1">
        <div className="ui-label">{state.dataSource === "synthetic" ? "Synthetic demo stop" : "Current stop"}</div>
        {o ? (
          <div className="ui-card mt-2 p-5">
            <div className="text-[22px] font-medium">{o.buyer}</div>
            <div className="mt-1 text-[15px] ui-muted">{o.address}</div>
            <div className="mt-3 text-[15px]">
              {o.item}{o.cod !== "—" && <> · COD {o.cod}</>}
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

      {(state.error || (!active && state.message) || state.resetting) && <p className="mt-3 text-[13px] ui-muted" role={state.error ? "alert" : "status"}>{state.resetting ? "Restarting this session…" : connection.status === "disconnected" ? "Tap CONNECT to pair this phone." : state.error || state.message}</p>}
      <div className="mt-5 grid gap-2.5">
        {!paired && <button className="ui-btn ui-btn-primary min-h-[68px]" disabled={state.resetting || !state.connected} onClick={() => void connect()}>CONNECT</button>}
        {paired && !state.finishing && !active && !connection.canAnswer && <button disabled={!o || !connection.canInitiate || state.resetting} onClick={() => void sendOutcome("A")} className="flex min-h-[68px] flex-col items-start justify-center rounded-[20px] border border-[#dcdcdc] bg-white px-5 text-left disabled:opacity-60"><span className="text-[17px] font-medium">Initiate route A</span><span className="text-[13px] ui-muted">No answer · Alodi messages, then calls</span></button>}
        {state.finishing && <p className="text-[13px] ui-muted" role="status">Saving the complete delivery details. Please wait for the saved result.</p>}
        {active && <><p className="text-[13px] ui-muted" role="status">{muted ? "Muted · Alodi can’t hear you" : connection.voice?.activity === "listening" ? "Listening · speak toward this phone" : connection.voice?.activity === "speaking" ? "Alodi is speaking" : "Connecting the conversation…"}</p>{connection.voice?.needsPlayback && <button className="ui-btn ui-btn-primary min-h-[68px]" onClick={() => void enableSound()}>Enable call audio</button>}<div className="grid grid-cols-2 gap-2.5"><button className={`ui-btn min-h-[68px] ${muted ? "ui-btn-primary" : "ui-btn-outline"}`} aria-pressed={muted} onClick={() => setMuted(!muted)} disabled={!connection.voice}>{muted ? "Unmute" : "Mute"}</button><button className="ui-btn ui-btn-outline min-h-[68px]" onClick={() => void end()} disabled={state.finishing}>End call</button></div></>}
        {state.mode && state.mode !== "live" && <p className="text-[13px] ui-muted">{state.mode} mode · a live provider is required for the conversation.</p>}
        <button className="ui-btn ui-btn-ghost" disabled={state.resetting || !state.generation} onClick={() => { if (window.confirm("Restart this demo from the beginning?")) void reset(); }}>{state.resetting ? "Restarting…" : "Restart demo"}</button>
      </div>
    </main>
  );
}
