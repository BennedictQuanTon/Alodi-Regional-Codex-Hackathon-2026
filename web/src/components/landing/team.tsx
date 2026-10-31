"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { TEAM } from "@/lib/content";
import { Reveal, RevealText } from "./motion";

const EASE = [0.76, 0, 0.24, 1] as const;

function initials(name: string) {
  const p = name.split(" ");
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function Member({ m, i }: { m: (typeof TEAM)[number]; i: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [failed, setFailed] = useState(false);

  return (
    <figure ref={ref} className="group">
      <motion.div
        className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-navy-mist"
        initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0% round 20px)" }}
        animate={inView || reduce ? { clipPath: "inset(0% 0% 0% 0% round 20px)" } : undefined}
        transition={{ duration: 1.1, delay: i * 0.1, ease: EASE }}
      >
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.photo}
            alt={m.name}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full scale-[1.04] object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100"
            style={{ objectPosition: m.pos }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-[family-name:var(--font-serif)] text-[88px] text-navy/70">{initials(m.name)}</span>
          </div>
        )}
      </motion.div>
      <motion.figcaption
        className="mt-5 flex flex-col gap-2 border-b border-ash pb-5"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={inView || reduce ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, delay: 0.35 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="t-h4 !text-[26px]">{m.name}</span>
        <span className="text-[13px] uppercase tracking-[0.04em] text-orange-deep">{m.role}</span>
        <span className="text-[13px] uppercase tracking-[0.04em] text-orange-deep">{m.role2}</span>
      </motion.figcaption>
    </figure>
  );
}

export function Team() {
  return (
    <section id="team" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="t-eyebrow">The team</div>
            <RevealText text="Team Develarper" className="t-h1 mt-6" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[420px] text-[18px] leading-[1.4] text-graphite">Four builders from UTS × HCMUT.</p>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map((m, i) => (
            <Member key={m.name} m={m} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
