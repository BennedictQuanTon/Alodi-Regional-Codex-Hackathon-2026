import type { Metadata } from "next";
import Link from "next/link";
import { DemoNav } from "@/components/demo/director";
import { CALL_CAST, CHECKLIST, LIVE, TRAILER } from "@/lib/script";
import { SCENARIOS } from "@/lib/demo/scenarios";

export const metadata: Metadata = { title: "Demo script · Alodi" };

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["→", "Next step (skip waits)"],
  ["R", "Reset"],
  ["H", "Hide controls (single windows)"],
];

export default function ScriptPage() {
  return (
    <div className="ui min-h-dvh">
      <DemoNav active="/script" />
      <main className="mx-auto max-w-[1240px] px-6 py-12 md:px-8 md:py-16">
        {/* Header */}
        <div className="ui-label">MVP demo · 31 October 2026</div>
        <h1 className="ui-h mt-3 text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[52px]">The Demo Script</h1>
        <p className="mt-4 max-w-[720px] text-[16px] leading-[1.5] ui-muted">
          Two cuts: a 90-second trailer recorded in advance, and a three-minute live demo on stage. Both run on the same
          scenario engine, with mock data and a fast-forward clock.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/demo" className="ui-btn ui-btn-accent">
            Open the stage
          </Link>
          <Link href="/demo/shipper" className="ui-btn ui-btn-outline">
            Shipper window
          </Link>
          <Link href="/demo/buyer" className="ui-btn ui-btn-outline">
            Buyer window
          </Link>
          <Link href="/demo/console" className="ui-btn ui-btn-outline">
            Console window
          </Link>
        </div>

        {/* 1 · Trailer */}
        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--ui-line)] pb-4">
            <h2 className="ui-h text-[24px]">1 · Trailer, 90 seconds</h2>
            <span className="ui-label">screen capture + voice-over</span>
          </div>
          <ol>
            {TRAILER.map((s) => (
              <li key={s.tc} className="grid gap-4 border-b border-[var(--ui-line)] py-6 md:grid-cols-[110px_170px_1fr_1fr]">
                <div className="text-[13px] tabular-nums ui-muted">{s.tc}</div>
                <div className="text-[13px] font-medium uppercase tracking-[0.02em]">{s.screen}</div>
                <div className="text-[14px] leading-[1.5] ui-muted">
                  {s.action}
                  {s.onScreen && <div className="mt-2 text-[12px] opacity-80">On screen: {s.onScreen}</div>}
                </div>
                <blockquote className="border-l-2 border-[var(--ui-accent)] pl-4 text-[16px] leading-[1.45]">{s.vo}</blockquote>
              </li>
            ))}
          </ol>
        </section>

        {/* 2 · Live demo */}
        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--ui-line)] pb-4">
            <h2 className="ui-h text-[24px]">2 · Live demo, 3 minutes</h2>
            <span className="ui-label">four speakers, one segment each</span>
          </div>
          <ol>
            {LIVE.map((b) => (
              <li key={b.time} className="grid gap-4 border-b border-[var(--ui-line)] py-6 md:grid-cols-[70px_170px_1fr_300px]">
                <div className="text-[13px] tabular-nums ui-muted">{b.time}</div>
                <div className="text-[13px] font-medium uppercase tracking-[0.02em]">{b.who}</div>
                <p className="text-[16px] leading-[1.45]">{b.say}</p>
                <div className="rounded-[12px] bg-[var(--ui-canvas)] p-3.5 text-[13px] leading-[1.5] ui-muted">{b.do}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* 3 · Reference cards */}
        <section className="mt-16 grid gap-4 lg:grid-cols-2">
          <div className="ui-card p-6">
            <h2 className="ui-h text-[20px]">Five scenarios in the engine</h2>
            <ul className="mt-5 divide-y divide-[var(--ui-line)]">
              {SCENARIOS.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className="ui-badge ui-badge-soft mt-0.5 shrink-0">{s.key === "REFUSE" ? "—" : s.key}</span>
                  <span>
                    <span className="block text-[14px] font-medium">{s.title}</span>
                    <span className="mt-0.5 block text-[13px] ui-muted">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="ui-card p-6">
              <h2 className="ui-h text-[20px]">Voicing the call</h2>
              <ul className="mt-5 divide-y divide-[var(--ui-line)]">
                {CALL_CAST.map((c) => (
                  <li key={c.role} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="text-[14px] font-medium">{c.role}</div>
                    <div className="mt-0.5 text-[13px] ui-muted">{c.voice}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[24px] bg-[var(--ui-ink-strong)] p-6 text-white">
              <h2 className="ui-h text-[20px]">Checklist before demo day</h2>
              <ol className="mt-5 space-y-3">
                {CHECKLIST.map((c, i) => (
                  <li key={c} className="grid grid-cols-[24px_1fr] gap-3 text-[14px] leading-[1.5] text-white/85">
                    <span className="tabular-nums text-[var(--ui-accent)]">{String(i + 1).padStart(2, "0")}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 4 · Shortcuts */}
        <section className="mt-8 ui-card p-6">
          <h2 className="ui-h text-[20px]">Keyboard shortcuts while recording</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 text-[14px]">
                <kbd className="ui-badge ui-badge-outline px-3 py-1 text-[13px]">{k}</kbd>
                <span className="ui-muted">{v}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
