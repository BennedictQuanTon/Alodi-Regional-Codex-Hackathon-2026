"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCallAudio } from "@/lib/demo/audio";
import { useDemo } from "@/lib/demo/engine";
import { SCENARIOS, fmtClock, fmtDay } from "@/lib/demo/scenarios";
import type { ScenarioId } from "@/lib/demo/types";
import { Wordmark } from "@/components/site/brand";

const TABS = [
  { href: "/demo", label: "Stage" },
  { href: "/demo/shipper", label: "Shipper" },
  { href: "/demo/buyer", label: "Buyer" },
  { href: "/demo/console", label: "Ops" },
];

export function DemoNav({ active }: { active?: string }) {
  const path = usePathname();
  const current = active ?? path;
  return (
    <header className="ui relative z-10 flex h-16 shrink-0 items-center justify-between gap-4 px-6" style={{ viewTransitionName: "demo-nav" }}>
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Alodi home">
          <Wordmark className="text-[24px]" />
        </Link>
        <span className="ui-badge ui-badge-outline hidden md:inline-flex">Demo</span>
      </div>
      <nav className="flex items-center gap-1 rounded-[18px] bg-[#ececec] p-1" aria-label="Demo views">
        {TABS.map((t) => {
          const on = current === t.href;
          return (
            <Link key={t.href} href={t.href} className="relative rounded-[14px] px-3.5 py-1.5 text-[13px] font-medium">
              {on && <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-[14px] bg-white shadow-[var(--ui-shadow)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className={`relative ${on ? "text-[var(--ui-ink)]" : "ui-muted"}`}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <Link href="/console" className="ui-btn ui-btn-outline">
          Dashboard
        </Link>
        <Link href="/script" className="ui-btn ui-btn-ghost">
          Script
        </Link>
      </div>
    </header>
  );
}

const FLAG_EVENT = "alodi-flag";

/** Boolean flag in localStorage (a per-machine convenience; losing it is fine). */
export function useLocalFlag(key: string, initial: boolean) {
  const subscribe = (cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(FLAG_EVENT, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(FLAG_EVENT, cb);
    };
  };
  const read = () => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : raw === "1";
    } catch {
      return initial;
    }
  };
  const v = useSyncExternalStore(subscribe, read, () => initial);
  const set = (n: boolean) => {
    try {
      localStorage.setItem(key, n ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(FLAG_EVENT));
  };
  return [v, set] as const;
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="flex w-full items-center justify-between gap-6 rounded-[12px] px-3 py-2 text-[14px] hover:bg-[var(--ui-canvas)]">
      {label}
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-[var(--ui-ink-strong)]" : "bg-[#d4d4d4]"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Floating control dock: scenario, play, step, reset, clock, options. */
export function Director({ captions, setCaptions }: { captions?: boolean; setCaptions?: (v: boolean) => void; compact?: boolean }) {
  const { state: s, engine } = useDemo();
  const [audio, setAudio] = useLocalFlag("alodi-audio", true);
  const [open, setOpen] = useState(false);
  useCallAudio(s, audio);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.toggle();
      }
      if (e.key === "ArrowRight") engine.next();
      if (e.key.toLowerCase() === "r") engine.reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  const day = fmtDay(s.clock);

  return (
    <div className="ui pointer-events-none absolute inset-x-0 bottom-5 z-40 flex flex-col items-center gap-3 !bg-transparent">
      <AnimatePresence mode="wait">
        {(s.waitingFor || (captions && s.caption)) && (
          <motion.div
            key={s.waitingFor?.hint ?? s.caption}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto flex max-w-[760px] items-center gap-2 rounded-[18px] bg-[var(--ui-ink-strong)] px-4 py-2 text-[14px] text-white shadow-[0_8px_24px_rgba(18,26,44,0.25)]"
          >
            {s.waitingFor && <span className="blink size-1.5 shrink-0 rounded-full bg-[var(--ui-accent)]" aria-hidden />}
            {s.waitingFor ? s.waitingFor.hint : s.caption}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative flex items-center gap-2 rounded-[24px] border border-[var(--ui-line)] bg-white/90 p-2 shadow-[0_12px_32px_-12px_rgba(18,26,44,0.25),var(--ui-shadow)] backdrop-blur">
        <select
          value={s.scenario}
          onChange={(e) => engine.reset(e.target.value as ScenarioId)}
          className="h-9 rounded-[18px] bg-[var(--ui-canvas)] px-3 text-[13px] font-medium outline-none"
          aria-label="Scenario"
        >
          {SCENARIOS.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.title}
            </option>
          ))}
        </select>
        <button onClick={() => engine.reset()} className="ui-btn ui-btn-ghost" title="Reset (R)">
          Reset
        </button>
        <button onClick={engine.toggle} className="ui-btn ui-btn-accent min-w-[96px]" title="Space">
          {s.playing ? "Pause" : s.done ? "Replay" : "Play"}
        </button>
        <button onClick={engine.next} className="ui-btn ui-btn-ghost" title="Next step (→)">
          Next →
        </button>
        <div className="mx-2 flex items-baseline gap-1.5 tabular-nums">
          <span className="text-[20px] font-semibold tracking-[-0.03em]">{fmtClock(s.clock)}</span>
          <span className="text-[12px] ui-muted">{day.weekday}</span>
          {s.animTo != null && <span className="ui-badge ui-badge-accent ml-1">fast-forward</span>}
        </div>
        <button onClick={() => setOpen((o) => !o)} className="ui-btn ui-btn-outline" aria-expanded={open}>
          Options
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="ui-card absolute bottom-full right-0 mb-3 w-[240px] p-2"
            >
              <Switch on={s.auto} onClick={() => engine.setAuto(!s.auto)} label="Auto-tap" />
              <Switch on={audio} onClick={() => setAudio(!audio)} label="Sound" />
              {setCaptions && <Switch on={!!captions} onClick={() => setCaptions(!captions)} label="Captions" />}
              <div className="mt-1 flex items-center justify-between px-3 py-2 text-[14px]">
                Speed
                <span className="flex gap-1">
                  {[1, 1.5, 2].map((sp) => (
                    <button key={sp} onClick={() => engine.setSpeed(sp)} className={`ui-badge ${s.speed === sp ? "ui-badge-solid" : "ui-badge-soft"}`}>
                      {sp}x
                    </button>
                  ))}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
