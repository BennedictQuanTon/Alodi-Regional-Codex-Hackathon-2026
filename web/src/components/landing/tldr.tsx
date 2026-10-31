"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { DEMO_VIDEO, TLDR } from "@/lib/content";
import { DropRing } from "@/components/site/brand";
import { Reveal, RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Demo video frame. Plays the file in DEMO_VIDEO.src; without one it shows a branded placeholder. */
function VideoFrame() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const has = Boolean(DEMO_VIDEO.src);
  const play = () => {
    if (!has || !ref.current) return;
    ref.current.play();
    setPlaying(true);
  };
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className="relative aspect-video overflow-hidden rounded-[28px] bg-ink"
    >
      {has ? (
        <video ref={ref} src={DEMO_VIDEO.src} poster={DEMO_VIDEO.poster || undefined} controls={playing} playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div className="wash left-1/2 top-1/2 h-[70%] w-[60%] -translate-x-1/2 -translate-y-1/2 opacity-60" style={{ background: "radial-gradient(circle, rgba(240,90,0,0.75), transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(var(--color-parchment) 1px, transparent 1px), linear-gradient(90deg, var(--color-parchment) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        </>
      )}

      {!playing && (
        <button
          type="button"
          onClick={play}
          disabled={!has}
          aria-label={has ? "Play the demo video" : "Demo video coming soon"}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-6 text-parchment"
        >
          <span className="relative grid size-24 place-items-center rounded-full bg-parchment/10 backdrop-blur-md transition-transform duration-500 group-enabled:group-hover:scale-105 md:size-28">
            <span className="pulse-ring absolute inset-0 rounded-full border border-orange" />
            {has ? <span className="ml-1 text-[34px] leading-none text-parchment">▸</span> : <DropRing size={44} dot="var(--color-parchment)" />}
          </span>
          <span className="text-center">
            <span className="block text-[13px] font-medium uppercase tracking-[0.08em] text-parchment/60">{has ? `Watch the demo · ${DEMO_VIDEO.length}` : "Demo video · coming soon"}</span>
            <span className="mt-2 block text-[15px] text-parchment/80">{DEMO_VIDEO.caption}</span>
          </span>
        </button>
      )}
    </motion.figure>
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
