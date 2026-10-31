"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { AREA_DAY, HERO_STATS, PHOTOS } from "@/lib/content";
import { SourceNote } from "@/components/site/brand";
import { Figure, Reveal, RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Portrait photo with a slow parallax drift and a clip reveal; toned to the parchment palette. */
function Photo() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  return (
    <motion.figure
      ref={ref}
      initial={{ clipPath: "inset(10% 10% 10% 10% round 24px)" }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 24px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1.1, ease: EASE }}
      className="relative h-[420px] overflow-hidden rounded-[24px] lg:h-full lg:min-h-[560px]"
    >
      <motion.div className="absolute inset-[-8%]" style={reduce ? undefined : { y }}>
        <Image src={PHOTOS.street.src} alt={PHOTOS.street.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="photo-tone object-cover object-[50%_92%]" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/15 to-transparent" />
      <figcaption className="absolute inset-0 flex flex-col p-7">
        <div className="t-number text-[88px] leading-none text-parchment md:text-[112px]">
          <Figure value="320" />
        </div>
        <p className="mt-3 max-w-[300px] text-[15px] leading-[1.4] text-parchment/85">failed deliveries a day in one area, mostly because nobody picked up.</p>
        <p className="mt-auto text-[11px] text-parchment/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{PHOTOS.street.credit}</p>
      </figcaption>
    </motion.figure>
  );
}

export function Problem() {
  return (
    <section id="problem" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">The problem</div>
        </Reveal>
        <RevealText text="A failed delivery is a time negotiation that happens off the system." className="t-h1 mt-5 max-w-[920px]" stagger={0.03} />

        <div className="mt-10 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <Photo />

          <div className="flex flex-col gap-3">
            <div className="grid flex-1 overflow-hidden rounded-[24px] border border-ash sm:grid-cols-2">
              {HERO_STATS.map((s, i) => (
                <Reveal
                  key={s.value}
                  delay={i * 0.07}
                  className={`flex flex-col justify-between gap-6 p-7 ${i > 0 ? "border-t border-ash" : ""} ${i === 1 ? "sm:border-t-0 sm:border-l" : ""} ${i === 3 ? "sm:border-l" : ""}`}
                >
                  <div className={`t-number whitespace-nowrap text-[56px] leading-none md:text-[64px] ${i === 3 ? "text-orange-deep" : ""}`}>
                    <Figure value={s.value} />
                  </div>
                  <div>
                    <p className="max-w-[260px] text-[15px] leading-[1.4] text-graphite">{s.text}</p>
                    <SourceNote className="mt-3">{s.source}</SourceNote>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className="rounded-[24px] bg-ink px-7 py-6 text-parchment">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="t-eyebrow text-parchment/50">One area · one day</span>
                  <span className="text-[11px] text-parchment/40">Source: VECOM 8%; Shipsy 25% rescue (vendor); Shopee §7.1; PRD §18.8</span>
                </div>
                <ol className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                  {AREA_DAY.map((d, i) => (
                    <motion.li
                      key={d.label}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ delay: 0.1 + i * 0.12, duration: 0.55, ease: EASE }}
                    >
                      <div className={`t-number text-[36px] leading-none ${i === AREA_DAY.length - 1 ? "text-orange" : ""}`}>{d.value}</div>
                      <div className="mt-2 text-[12px] leading-[1.35] text-parchment/60">{d.label}</div>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
