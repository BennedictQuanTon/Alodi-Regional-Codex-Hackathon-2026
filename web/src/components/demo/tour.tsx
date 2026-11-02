"use client";

import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useDemo } from "@/lib/demo/engine";
import { fmtClock, fmtDay, setLiveAnswer, stepsFor } from "@/lib/demo/scenarios";
import { CHAPTERS, TOUR_STEPS, TourAudio, currentChapter, focusOf, useTourEffects } from "@/lib/demo/tour";
import { DropRing, Wordmark } from "@/components/site/brand";
import { BuyerPhone } from "./buyer-phone";
import { Person } from "./cast";
import { PhoneFrame } from "./phone";
import { ShipperApp } from "./shipper-app";
import { useFit } from "./stage";
import { TourCover } from "./tour-cover";
import { LiveTurn, useTrial } from "./tour-live";
import { TourAgent, TourDashboard } from "./tour-surfaces";

const NARROW = "(max-width: 900px)";
const watchNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

const SPEAKER: Record<string, string> = { narrator: "Narrator", agent: "Alodi", buyer: "Buyer" };

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
  const [speech, setSpeech] = useState({ text: "", voice: "narrator" });
  const [isLive, setIsLive] = useState(false);
  const [person, setPerson] = useState(false);
  const [turn, setTurn] = useState<{ resolve: (mode: "live" | "auto") => void } | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const { trial, setTrial, refresh } = useTrial();
  const narrow = useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [view, setView] = useState<View>("all");
  const single = narrow || view !== "all";
  const baseW = narrow ? 390 : single ? (view === "ops" ? 1000 : view === "agent" ? 620 : 420) : 1760;
  const baseH = narrow ? 800 : 800;
  const { ref, scale } = useFit(baseW, baseH);
  useTourEffects(s, audio);

  useEffect(() => {
    audio.listen((text, voice) => setSpeech({ text, voice }));
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

  const begin = (live: boolean) => {
    setLiveAnswer(null);
    setPerson(false);
    setIsLive(live);
    audio.setTurn(live ? () => new Promise((resolve) => setTurn({ resolve })) : undefined);
    setStarted(true);
    engine.reset("A_main");
    engine.play();
  };
  const start = () => { audio.unlock(); mic?.getTracks().forEach((t) => t.stop()); setMic(null); begin(false); };
  const startLive = async () => {
    audio.unlock(); // inside the tap, before the permission prompt, or Safari refuses to play the voices
    try {
      mic?.getTracks().forEach((t) => t.stop());
      setMic(await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }));
      begin(true);
    } catch {
      start(); // no microphone, or permission refused: the story still runs
    }
  };
  const toggleMute = () => { audio.setMuted(!muted); setMuted(!muted); };

  const finished = started && s.step >= stepsFor(s.scenario).length;
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

      </div>

      <AnimatePresence>
        {(!started || finished) && <TourCover key={finished ? "end" : "start"} mode={finished ? "end" : "start"} person={person} trial={trial} onPlay={start} onLive={() => void startLive()} />}
      </AnimatePresence>

      {turn && mic && (
        <LiveTurn
          stream={mic}
          trial={trial}
          onTrial={setTrial}
          onAck={audio.acknowledge}
          onCaption={(text) => setSpeech({ text, voice: "buyer" })}
          onDone={(answer) => {
            setLiveAnswer(answer);
            if (answer?.outcome === "person") engine.branch("A_lowconf");
            setPerson(answer?.outcome === "person");
            if (answer) setSpeech({ text: answer.transcript, voice: "buyer" });
            turn.resolve(answer ? "live" : "auto");
            setTurn(null);
          }}
        />
      )}

      <footer className="tf">
        <div className="tf-say" aria-live="polite">
          {started && !finished && speech.text && (
            <p key={speech.text}><span>{SPEAKER[speech.voice] ?? "Narrator"}</span>{speech.text}</p>
          )}
        </div>
        <div className="tf-bar">
          <div className="tf-controls">
            <button className="tf-btn tf-play" aria-label={s.playing ? "Pause" : "Play"} disabled={!started || finished || !!turn} onClick={engine.toggle}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>{s.playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" />}</svg>
            </button>
            <button className="tf-btn" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} onClick={toggleMute}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" />{muted ? <path d="M16.5 9.5l4.5 5M21 9.5l-4.5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}</svg>
            </button>
            <button className="tf-btn" aria-label="Restart" disabled={!started} onClick={() => { void refresh(); setStarted(false); setTurn(null); setLiveAnswer(null); engine.reset("A_main"); engine.setAuto(true); audio.stop(); audio.ring(false); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4.5V9h4.5" /></svg>
            </button>
          </div>
          <ol className="tf-line" style={{ gridTemplateColumns: `repeat(${CHAPTERS.length}, minmax(0, 1fr))` }}>
            {CHAPTERS.map((item, index) => {
              const end = CHAPTERS[index + 1]?.step ?? TOUR_STEPS.length;
              const fill = Math.max(0, Math.min(1, (s.step - item.step) / (end - item.step)));
              const now = started && index === chapter;
              return (
                <li key={item.label} className={now ? "now" : ""}>
                  <button disabled={!started || isLive} aria-current={now ? "step" : undefined} onClick={() => engine.seek(item.step)}>
                    <i><b style={{ transform: `scaleX(${started ? fill : 0})` }} /></i>
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </footer>
    </div>
  );
}
