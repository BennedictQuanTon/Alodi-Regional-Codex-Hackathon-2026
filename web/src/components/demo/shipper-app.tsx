"use client";

import { AnimatePresence, motion } from "motion/react";
import type { DemoEngine } from "@/lib/demo/engine";
import { ORDER, SCENARIOS, fmtClock } from "@/lib/demo/scenarios";
import type { DemoState } from "@/lib/demo/types";
import { DropRing } from "@/components/site/brand";
import { Waveform } from "./phone";

const EASE = [0.22, 1, 0.36, 1] as const;

const STOPS_D0 = [
  { n: 6, name: "Phuc Tran", eta: "09:48", done: true },
  { n: 7, name: ORDER.buyer, eta: "10:02", current: true },
  { n: 8, name: "Hanh Vo", eta: "10:15" },
];
const STOPS_D1 = [
  { n: 14, name: "Vy Do", eta: "16:58", done: true },
  { n: 15, name: ORDER.buyer, eta: "17:22", current: true },
  { n: 16, name: "Bao Huynh", eta: "17:40" },
];

function Hint({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="pointer-events-none absolute -inset-[5px] animate-pulse rounded-[inherit] border-2 border-[var(--ui-accent)]" aria-hidden />;
}

export function ShipperApp({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const waiting = s.waitingFor?.action;
  const hintKey = SCENARIOS.find((x) => x.id === s.scenario)?.key;
  const stops = s.shipper.day === 1 ? STOPS_D1 : STOPS_D0;
  const stopNo = s.shipper.day === 1 ? 15 : 7;

  return (
    <div className="ui flex h-full flex-col !bg-white">
      <div className="px-6 pb-4 pt-14">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--ui-canvas)] text-[12px] font-semibold">TN</span>
            <div>
              <div className="text-[14px] font-semibold leading-tight">{ORDER.shipper}</div>
              <div className="text-[12px] ui-muted">{ORDER.route}</div>
            </div>
          </div>
          <span className="ui-badge ui-badge-soft">{s.shipper.day === 1 ? "Sun" : "Sat"}</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ui-canvas)]">
            <motion.div className="h-full rounded-full bg-[var(--ui-accent)]" animate={{ width: `${(stopNo / 24) * 100}%` }} transition={{ duration: 0.8, ease: EASE }} />
          </div>
          <span className="text-[12px] tabular-nums ui-muted">{stopNo}/24</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={s.shipper.screen + s.shipper.day}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: EASE }}
            className="ui-scroll absolute inset-0 overflow-y-auto px-5 pb-6"
          >
            {s.shipper.screen === "route" && (
              <div className="space-y-2.5">
                {stops.map((st) => (
                  <div
                    key={st.n}
                    className={`rounded-[18px] border px-4 py-3.5 ${st.current ? "border-[var(--ui-ink)] bg-white" : "border-[var(--ui-line)] bg-[var(--ui-alt)]"} ${st.done ? "opacity-45" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-medium">{st.name}</span>
                      <span className="text-[12px] tabular-nums ui-muted">{st.eta}</span>
                    </div>
                    {st.current && s.shipper.day === 1 && s.card && (
                      <div className="mt-3 space-y-3">
                        <ContextCardView card={s.card} compact />
                        <button
                          onClick={() => engine.dispatch("shipper:delivered")}
                          disabled={waiting !== "shipper:delivered"}
                          className="ui-btn ui-btn-primary relative h-11 w-full disabled:opacity-40"
                        >
                          Delivered
                          <Hint on={waiting === "shipper:delivered"} />
                        </button>
                      </div>
                    )}
                    {st.current && s.shipper.day === 0 && <div className="mt-1 text-[12px] ui-muted">COD {ORDER.cod}</div>}
                  </div>
                ))}
              </div>
            )}

            {(s.shipper.screen === "calling" || s.shipper.screen === "choose") && (
              <div className="flex h-full flex-col">
                <div className="rounded-[18px] border border-[var(--ui-line)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold">{ORDER.buyer}</span>
                    <span className="ui-badge ui-badge-soft">COD</span>
                  </div>
                  <div className="mt-1 text-[13px] ui-muted">Sky Garden, Tower B</div>
                  <div className="mt-3 flex items-center gap-2 text-[13px] text-[#c2410c]">
                    <span className="size-1.5 rounded-full bg-current" /> No answer, twice
                  </div>
                </div>
                <div className="mt-auto space-y-2.5 pt-6">
                  {(
                    [
                      { k: "A", label: "No answer", cls: "ui-btn-accent" },
                      { k: "B", label: "Rescheduled", cls: "ui-btn-primary" },
                      { k: "REFUSE", label: "Refused", cls: "ui-btn-outline" },
                    ] as const
                  ).map((b, i) => (
                    <motion.button
                      key={b.k}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.07, ease: EASE }}
                      onClick={() => engine.dispatch("shipper:choose", b.k)}
                      disabled={waiting !== "shipper:choose"}
                      className={`ui-btn relative h-14 w-full !rounded-[20px] text-[16px] disabled:opacity-60 ${b.cls}`}
                    >
                      {b.label}
                      <Hint on={waiting === "shipper:choose" && hintKey === b.k} />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {s.shipper.screen === "waiting" && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="relative grid size-24 place-items-center">
                  <span className="pulse-ring absolute inset-0 rounded-full border-2 border-[var(--ui-accent)]" />
                  <DropRing size={64} />
                </div>
                <div className="ui-h mt-6 text-[22px]">Alodi is on it</div>
                <div className="mt-1 text-[14px] ui-muted">Head to your next stop.</div>
                <div className="mt-6 flex gap-1.5">
                  {[
                    { l: "Chat", on: s.guard.contacts > 0 },
                    { l: "Call 1", on: s.call.attempt >= 1 },
                    { l: "Call 2", on: s.call.attempt >= 2 },
                  ].map((x) => (
                    <span key={x.l} className={`ui-badge ${x.on ? "ui-badge-solid" : "ui-badge-outline"}`}>
                      {x.l}
                    </span>
                  ))}
                </div>
                {s.timer && (
                  <div className="mt-4 text-[13px] ui-muted">
                    {s.timer.label} in <span className="font-semibold tabular-nums text-[var(--ui-ink)]">{Math.max(0, Math.ceil(s.timer.until - s.clock))} min</span>
                  </div>
                )}
              </div>
            )}

            {s.shipper.screen === "memo" && <MemoView state={s} engine={engine} />}

            {s.shipper.screen === "context" && s.card && (
              <div className="pt-2">
                <div className="ui-label mb-3">New context</div>
                <ContextCardView card={s.card} />
              </div>
            )}

            {s.shipper.screen === "delivered" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <motion.svg initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }} width="96" height="96" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="var(--ui-accent)" strokeWidth="4.4" />
                  <motion.path d="M8.4 12.3l2.4 2.4 4.8-5" fill="none" stroke="var(--ui-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5 }} />
                </motion.svg>
                <div className="ui-h text-[24px]">Delivered</div>
                <div className="text-[13px] ui-muted">Attempt 2 · {fmtClock(s.clock)}</div>
              </div>
            )}

            {s.shipper.screen === "handoff" && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="ui-badge ui-badge-warn">With CS</span>
                <div className="ui-h mt-4 text-[22px]">Sent to support</div>
                <div className="mt-1 text-[14px] ui-muted">Nothing more to do here.</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ContextCardView({ card, compact = false }: { card: NonNullable<DemoState["card"]>; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={`rounded-[20px] bg-[var(--ui-ink-strong)] text-white ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-center justify-between text-[12px] text-white/60">
        <span>{card.by === "cs" ? "Confirmed by CS" : "From the buyer"}</span>
        <DropRing size={18} dot="#fff" />
      </div>
      <div className={`ui-h mt-3 ${compact ? "text-[18px]" : "text-[26px]"}`}>{card.window}</div>
      <div className="mt-4 space-y-2 text-[14px]">
        <div className="flex justify-between gap-3">
          <span className="text-white/55">Drop-off</span>
          <span className="text-right">{card.drop}</span>
        </div>
        {card.alt && (
          <div className="flex justify-between gap-3">
            <span className="text-white/55">Backup</span>
            <span className="text-right">{card.alt}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MemoView({ state: s, engine }: { state: DemoState; engine: DemoEngine }) {
  const waiting = s.waitingFor?.action === "shipper:memo";
  const rec = s.memo.status === "recording";
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="ui-h text-[20px]">Repeat what they said</div>
      <div className="mt-1 text-[13px] ui-muted">10 seconds</div>
      <div className={`mt-8 text-[var(--ui-accent)] ${rec ? "" : "opacity-25"}`}>
        <Waveform active={rec} bars={22} />
      </div>
      <button
        onClick={() => engine.dispatch("shipper:memo")}
        disabled={!waiting}
        className="relative mt-6 grid size-24 place-items-center rounded-full bg-[var(--ui-accent)]"
        aria-label="Hold to record"
      >
        {rec && <span className="pulse-ring absolute inset-0 rounded-full bg-[var(--ui-accent)]" />}
        <span className="relative block h-9 w-5 rounded-full border-[3px] border-white" aria-hidden />
        {waiting && <span className="pointer-events-none absolute -inset-2 animate-pulse rounded-full border-2 border-[var(--ui-accent)]" />}
      </button>
      <div className="mt-4 text-[13px] ui-muted">{rec ? "Recording…" : s.memo.status === "done" ? `${s.memo.seconds}s recorded` : "Hold to record"}</div>
      {s.memo.transcript && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[18px] bg-[var(--ui-canvas)] px-4 py-3 text-left text-[13px] leading-[1.45]">
          “{s.memo.transcript}”
        </motion.p>
      )}
    </div>
  );
}
