"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useDemo } from "@/lib/demo/engine";
import { fmtClock, fmtDay } from "@/lib/demo/scenarios";
import { CHAPTERS, TOUR_STEPS, TourAudio, currentChapter, focusOf, useTourEffects } from "@/lib/demo/tour";
import { Wordmark } from "@/components/site/brand";
import { BuyerPhone } from "./buyer-phone";
import { ConsolePanel } from "./console-parts";
import { PhoneFrame } from "./phone";
import { ShipperApp } from "./shipper-app";
import { useFit } from "./stage";

const NARROW = "(max-width: 900px)";
const watchNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

function Panel({ label, active, width, children }: { label: string; active: boolean; width?: number; children: React.ReactNode }) {
  return (
    <div className={`transition-opacity duration-500 ${active ? "opacity-100" : "opacity-55"} ${width ? "shrink-0" : "min-w-0 flex-1"}`} style={width ? { width } : undefined}>
      <div className={`mb-3 text-center text-[13px] font-medium ${active ? "text-[var(--ui-accent)]" : "text-[var(--ui-muted)]"}`}>{label}</div>
      {children}
    </div>
  );
}

/** One screen, no setup: press Start and watch a failed delivery get rescued, with sound. */
export function DemoTour() {
  const { state: s, engine } = useDemo();
  const [audio] = useState(() => new TourAudio());
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const narrow = useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const baseW = narrow ? 390 : 1720;
  const baseH = narrow ? 760 : 790;
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
  const focus = focusOf(s);
  const chapter = currentChapter(s.step);
  const shipper = <Panel key="shipper" label="Shipper" active={focus === "shipper"} width={340}><PhoneFrame clock={s.clock}><ShipperApp state={s} engine={engine} /></PhoneFrame></Panel>;
  const buyer = <Panel key="buyer" label="Buyer" active={focus === "buyer"} width={340}><PhoneFrame clock={s.clock} dark={s.call.status === "ringing" || s.call.status === "connected"}><BuyerPhone state={s} engine={engine} /></PhoneFrame></Panel>;
  const ops = <Panel key="ops" label="Hub dashboard" active={focus === "ops"} width={narrow ? 360 : undefined}><div className="h-[704px]"><ConsolePanel state={s} engine={engine} minimal /></div></Panel>;

  return (
    <div className="ui flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-6">
        <Link href="/" aria-label="Alodi home"><Wordmark className="text-[24px]" /></Link>
        {started && <div className="flex items-baseline gap-1.5 tabular-nums"><span className="text-[18px] font-semibold">{fmtClock(s.clock)}</span><span className="text-[12px] ui-muted">{fmtDay(s.clock).weekday}</span>{s.animTo != null && <span className="ui-badge ui-badge-accent ml-1">fast-forward</span>}</div>}
      </header>

      <div ref={ref} className="relative flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 flex items-start justify-center gap-8 px-6" style={{ width: baseW, height: baseH, transform: `translate(-50%, -50%) scale(${scale})` }}>
          {narrow ? (focus === "shipper" ? shipper : focus === "buyer" ? buyer : ops) : [shipper, buyer, ops]}
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
