"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DEMO_VIDEO, TLDR } from "@/lib/content";
import { Reveal, RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The story film: just the video, playing silently while in view, with one sound toggle. */
function VideoFrame() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className="relative">
      <video ref={ref} src={DEMO_VIDEO.src} poster={DEMO_VIDEO.poster} muted={muted} loop playsInline preload="metadata" className="block aspect-video w-full" />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={!muted}
        className="absolute bottom-4 right-4 grid size-12 place-items-center rounded-full bg-white text-navy shadow-[0_10px_30px_-12px_rgba(18,26,44,0.6)]"
      >
        <svg width="26" height="26" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="#f05a00" strokeWidth="1.8" />
          <g fill="currentColor">
            <rect x="5.4" y={muted ? 7.35 : 6.9} width="1.3" height={muted ? 1.3 : 2.2} rx="0.65" />
            <rect x="7.35" y={muted ? 7.35 : 5.9} width="1.3" height={muted ? 1.3 : 4.2} rx="0.65" />
            <rect x="9.3" y={muted ? 7.35 : 6.9} width="1.3" height={muted ? 1.3 : 2.2} rx="0.65" />
          </g>
        </svg>
      </button>
    </div>
  );
}

/** Introducing Alodi: what it is, then the demo video. Sits right above "How Alodi works". */
export function Tldr() {
  return (
    <section id="tldr" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <div className="t-eyebrow">Introducing Alodi</div>
            </Reveal>
            <RevealText text={TLDR.headline} className="t-h1 mt-6" stagger={0.03} />
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[560px] text-[18px] leading-[1.45] text-graphite">{TLDR.body}</p>
            </Reveal>
          </div>
          <dl className="self-end border-t border-ash">
            {TLDR.facts.map((f, i) => (
              <motion.div
                key={f.k}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: EASE }}
                className="grid grid-cols-[110px_1fr] gap-4 border-b border-ash py-4"
              >
                <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-orange-deep">{f.k}</dt>
                <dd className="text-[15px] leading-[1.4] text-navy">{f.v}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <div className="mt-12">
          <VideoFrame />
        </div>
      </div>
    </section>
  );
}
