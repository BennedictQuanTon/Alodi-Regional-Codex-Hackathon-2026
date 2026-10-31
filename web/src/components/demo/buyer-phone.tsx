"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { DemoEngine } from "@/lib/demo/engine";
import { ORDER, fmtClock } from "@/lib/demo/scenarios";
import type { DemoState } from "@/lib/demo/types";
import { DropRing } from "@/components/site/brand";
import { Waveform } from "./phone";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Buyer phone: marketplace-style chat + the AI call screen. */
export function BuyerPhone({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [s.chat.length]);
  const showCall = s.call.status === "ringing" || s.call.status === "connected";

  return (
    <div className="ui relative flex h-full flex-col !bg-[var(--ui-alt)]">
      <div className="border-b border-[var(--ui-line)] bg-white px-5 pb-3 pt-14">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[var(--ui-ink-strong)]">
            <DropRing size={24} dot="#fff" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight">Delivery Assistant</div>
            <div className="text-[12px] ui-muted">{ORDER.item}</div>
          </div>
          <span className="ui-badge ui-badge-soft">Auto</span>
        </div>
      </div>

      <div ref={scroller} className="ui-scroll flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {s.chat.length === 0 && <div className="pt-28 text-center text-[13px] ui-muted">No messages yet</div>}
        <AnimatePresence initial={false}>
          {s.chat.map((m) => (
            <motion.div key={m.id} layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}>
              {m.from === "system" ? (
                <div className="mx-auto w-fit rounded-full bg-[var(--ui-canvas)] px-3 py-1 text-center text-[11px] ui-muted">{m.text}</div>
              ) : (
                <div className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[86%]">
                    <div
                      className={`rounded-[18px] px-3.5 py-2.5 text-[14px] leading-snug ${
                        m.from === "buyer" ? "rounded-br-[6px] bg-[var(--ui-ink-strong)] text-white" : "rounded-bl-[6px] bg-white shadow-[var(--ui-shadow)]"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.options && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.options.map((o) => (
                          <span key={o} className="ui-badge ui-badge-outline !bg-white !px-3 !py-1">
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`mt-1 text-[11px] ui-muted ${m.from === "buyer" ? "text-right" : ""}`}>{fmtClock(m.at)}</div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--ui-line)] bg-white px-4 py-3">
        <div className="flex-1 rounded-[18px] bg-[var(--ui-canvas)] px-4 py-2 text-[13px] ui-muted">Message</div>
        <span className="grid size-9 place-items-center rounded-full bg-[var(--ui-accent)] text-white" aria-hidden>
          ↑
        </span>
      </div>

      <AnimatePresence>{showCall && <CallScreen state={s} engine={engine} />}</AnimatePresence>
    </div>
  );
}

function CallScreen({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const ringing = s.call.status === "ringing";
  const first = s.call.lines[0]?.at;
  const secs = first != null ? Math.max(0, Math.round((s.clock - first) * 60)) : 0;
  const waitingAnswer = s.waitingFor?.action === "buyer:answer";
  const last = s.call.lines.at(-1);

  return (
    <motion.div
      initial={{ opacity: 0, y: "6%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "6%" }}
      transition={{ duration: 0.4, ease: EASE }}
      className="absolute inset-0 z-20 flex flex-col items-center bg-[#0f1424] px-7 pb-12 pt-24 text-white"
    >
      <div className="relative grid size-24 place-items-center rounded-full bg-white/5">
        {ringing && <span className="pulse-ring absolute inset-0 rounded-full border-2 border-[var(--ui-accent)]" />}
        <DropRing size={56} dot="#fff" />
      </div>
      <div className="ui-h mt-5 text-[24px]">Delivery Assistant</div>
      <div className="mt-1 text-[13px] text-white/55 tabular-nums">
        {ringing ? "Verified caller" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
      </div>

      <div className="mt-10 flex w-full flex-1 flex-col items-center">
        {!ringing && (
          <>
            <div className="text-[var(--ui-accent)]">
              <Waveform active bars={26} />
            </div>
            <AnimatePresence mode="wait">
              {last && (
                <motion.p
                  key={last.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className={`mt-8 text-center text-[15px] leading-[1.45] ${last.who === "ai" ? "text-white/85" : "text-[#ffb48a]"}`}
                >
                  {last.text}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="flex w-full items-start justify-around text-[12px] text-white/70">
        <span className="flex flex-col items-center gap-2">
          <span className="block size-16 rounded-full bg-[#dc2626]" />
          {ringing ? "Decline" : "End"}
        </span>
        {ringing && (
          <button onClick={() => engine.dispatch("buyer:answer")} disabled={!waitingAnswer} className="flex flex-col items-center gap-2">
            <span className="relative block size-16 rounded-full bg-[#16a34a]">
              {waitingAnswer && <span className="pulse-ring absolute inset-0 rounded-full bg-[#16a34a]" />}
            </span>
            Answer
          </button>
        )}
      </div>
    </motion.div>
  );
}
