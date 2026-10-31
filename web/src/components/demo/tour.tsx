"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useDemo } from "@/lib/demo/engine";
import { fmtClock, fmtDay } from "@/lib/demo/scenarios";
import { CHAPTERS, TOUR_STEPS, TourAudio, currentChapter, focusOf, useTourEffects } from "@/lib/demo/tour";
import { DropRing, Wordmark } from "@/components/site/brand";
import { BuyerPhone } from "./buyer-phone";
import { Person } from "./cast";
import { PhoneFrame } from "./phone";
import { ShipperApp } from "./shipper-app";
import { useFit } from "./stage";
import { TourAgent, TourDashboard } from "./tour-surfaces";

const NARROW = "(max-width: 900px)";
const watchNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

type View = "all" | "shipper" | "buyer" | "ops" | "agent";
const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All screens" },
  { id: "shipper", label: "Shipper" },
  { id: "buyer", label: "Customer" },
  { id: "ops", label: "SPX" },
  { id: "agent", label: "Agent" },
];

function Panel({ active, width, head, children }: { active: boolean; width?: number; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-70"} ${width ? "shrink-0" : "flex-1"}`} style={width ? { width } : undefined}>
      {head}
      {children}
    </div>
  );
}

const AGENT_HEAD = (
  <div className="mb-3 flex h-[64px] items-center justify-center gap-3">
    <span className="grid size-[60px] place-items-center rounded-full bg-white shadow-[0_0_0_2px_#fff,0_6px_16px_-8px_rgba(18,26,44,0.5)]">
      <DropRing size={40} />
    </span>
    <div className="text-left">
      <div className="text-[13px] font-medium ui-muted">Alodi · AI agent</div>
      <div className="text-[17px] font-medium leading-tight">Handling this rescue.</div>
    </div>
  </div>
);

/** One screen, no setup: press Start and watch a failed delivery get rescued, with sound. */
export function DemoTour() {
  const { state: s, engine } = useDemo();
  const [audio] = useState(() => new TourAudio());
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const narrow = useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [view, setView] = useState<View>("all");
  const single = narrow || view !== "all";
  const baseW = narrow ? 390 : single ? (view === "ops" ? 1000 : view === "agent" ? 620 : 420) : 1760;
  const baseH = narrow ? 800 : 800;
  const { ref, scale } = useFit(baseW, baseH);
  useTourEffects(s, audio);

  useEffect(() => {
    audio.listen(setSubtitle);
    engine.reset("A_main");
    engine.setAuto(true);
    engine.setSpeed(1);
    engine.setDirector(audio);
    return () => {
      engine.setDirector(null);
      engine.pause();
      audio.dispose();
    };
  }, [engine, audio]);

  const start = () => {
    audio.unlock();
    setStarted(true);
    engine.reset("A_main");
    engine.play();
  };
  const toggleMute = () => { audio.setMuted(!muted); setMuted(!muted); };

  const finished = started && s.step >= TOUR_STEPS.length;
  const base = focusOf(s);
  const focus = base === "ops" ? "agent" : s.stage === "ready" || s.stage === "closed" ? "ops" : base;
  const showing = view === "all" ? focus : view;
  const chapter = currentChapter(s.step);
  const shipper = <Panel key="shipper" active={focus === "shipper" || single} width={340} head={<Person who="shipper" state={s} />}><PhoneFrame clock={s.clock}><ShipperApp state={s} engine={engine} /></PhoneFrame></Panel>;
  const buyer = <Panel key="buyer" active={focus === "buyer" || single} width={340} head={<Person who="buyer" state={s} />}><PhoneFrame clock={s.clock} dark={s.call.status === "ringing" || s.call.status === "connected"}><BuyerPhone state={s} engine={engine} /></PhoneFrame></Panel>;
  const ops = <Panel key="ops" active={focus === "ops" || single} width={narrow ? 360 : single ? 920 : undefined} head={<Person who="ops" state={s} />}><div className="h-[704px]"><TourDashboard state={s} /></div></Panel>;
  const agent = <Panel key="agent" active={focus === "agent" || single} width={narrow ? 360 : single ? 540 : 360} head={AGENT_HEAD}><div className="h-[704px]"><TourAgent state={s} /></div></Panel>;
  const surfaces = { shipper, buyer, ops, agent };

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-6">
        <Link href="/" aria-label="Alodi home"><Wordmark className="text-[24px]" /></Link>
        <nav className="hidden items-center gap-1 rounded-[18px] bg-[#ececec] p-1 md:flex" aria-label="Demo screens">
          {VIEWS.map((v) => (
            <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`rounded-[14px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${view === v.id ? "bg-white text-[var(--ui-ink)] shadow-[var(--ui-shadow)]" : "ui-muted"}`}>
              {v.label}
            </button>
          ))}
        </nav>
        {started && <div className="flex items-baseline gap-1.5 tabular-nums"><span className="text-[18px] font-semibold">{fmtClock(s.clock)}</span><span className="text-[12px] ui-muted">{fmtDay(s.clock).weekday}</span>{s.animTo != null && <span className="ui-badge ui-badge-accent ml-1">fast-forward</span>}</div>}
      </header>

      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 flex items-start justify-center gap-8 px-6" style={{ width: baseW, height: baseH, transform: `translate(-50%, -50%) scale(${scale})` }}>
          {single ? surfaces[showing as keyof typeof surfaces] : [shipper, buyer, ops, agent]}
        </div>

        {(!started || finished) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/85 px-6 text-center backdrop-blur">
            <Wordmark className="text-[44px]" />
            <h1 className="ui-h text-[30px] leading-tight">{finished ? "Make the second drop land." : "Watch one failed delivery get rescued"}</h1>
            <p className="max-w-[460px] text-[15px] ui-muted">{finished ? "One tap from the shipper. The agent did the rest, and a person stays in charge of the hard calls." : "One buyer, one missed delivery and one tap. Turn your sound on."}</p>
            <button className="ui-btn ui-btn-accent mt-2 min-h-[56px] px-10 text-[17px]" onClick={start}>{finished ? "Watch again" : "Start with sound"}</button>
            <p className="text-[12px] ui-muted">A scripted example with fictional data and synthesized voices.</p>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-[var(--ui-line)] bg-white px-4 pb-3 pt-2.5">
        <p className="mx-auto mb-2 min-h-[20px] max-w-[860px] text-center text-[14px]">{started && !finished ? subtitle : ""}</p>
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">
          <button className="ui-btn ui-btn-primary min-w-[84px]" disabled={!started || finished} onClick={engine.toggle}>{s.playing ? "Pause" : "Play"}</button>
          <ol className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${CHAPTERS.length}, minmax(0, 1fr))` }}>
            {CHAPTERS.map((item, index) => {
              const end = CHAPTERS[index + 1]?.step ?? TOUR_STEPS.length;
              const fill = Math.max(0, Math.min(1, (s.step - item.step) / (end - item.step)));
              return (
                <li key={item.label}>
                  <button className="group w-full text-left" disabled={!started} aria-current={started && index === chapter ? "step" : undefined} onClick={() => engine.seek(item.step)}>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--ui-line)] group-hover:bg-[#d4d4d4]"><span className="block h-full rounded-full bg-[var(--ui-accent)] transition-[width] duration-500" style={{ width: `${fill * 100}%` }} /></span>
                    <span className={`mt-1 hidden truncate text-[12px] sm:block ${started && index === chapter ? "font-medium" : "ui-muted"}`}>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button className="ui-btn ui-btn-outline min-w-[84px]" aria-pressed={muted} onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
        </div>
      </footer>
    </div>
  );
}
