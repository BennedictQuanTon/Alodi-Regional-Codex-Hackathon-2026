"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { HERO_STATS, SURVEY, SURVEY_PHOTOS } from "@/lib/content";
import { SourceNote } from "@/components/site/brand";
import { Figure, Reveal, RevealText } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Reserved for the team’s field-survey photos (SURVEY_PHOTOS). Empty → a quiet placeholder frame. */
function SurveyPhotos() {
  const has = SURVEY_PHOTOS.length > 0;
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className={`relative min-h-[420px] overflow-hidden rounded-[24px] lg:h-full ${has ? "" : "border border-dashed border-ash bg-paper/60"}`}
    >
      {has ? (
        <div className={`grid h-full gap-1 ${SURVEY_PHOTOS.length > 1 ? "grid-rows-2" : ""}`}>
          {SURVEY_PHOTOS.slice(0, 2).map((p) => (
            <div key={p.src} className="relative min-h-[420px]">
              <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/70 to-transparent" />
              {p.caption && <figcaption className="absolute bottom-5 left-6 text-[12px] font-medium uppercase tracking-[0.08em] text-parchment/85">{p.caption}</figcaption>}
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="grid size-14 place-items-center rounded-full border border-dashed border-smoke text-[22px] text-smoke">+</span>
          <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-smoke">Field survey photos</span>
          <span className="max-w-[260px] text-[13px] leading-[1.45] text-smoke">Photos from our interviews with couriers and buyers go here.</span>
        </div>
      )}
    </motion.figure>
  );
}

function SurveyBand() {
  const groups = [
    { who: "Buyers", n: SURVEY.buyers.n, sub: "online shoppers", stats: SURVEY.buyers.stats },
    { who: "Couriers", n: SURVEY.couriers.n, sub: SURVEY.couriers.from, stats: SURVEY.couriers.stats },
  ];
  return (
    <div className="overflow-hidden rounded-[24px] bg-ink text-parchment">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-7 py-4">
        <span className="t-eyebrow text-parchment/55">We asked both sides</span>
        {SURVEY.status === "MOCK" && <span className="text-[11px] text-parchment/35">Placeholder values until the interview export lands</span>}
      </div>
      <div className="grid md:grid-cols-2">
        {groups.map((g, gi) => (
          <div key={g.who} className={`px-7 py-5 ${gi === 1 ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}>
            <div className="flex items-baseline gap-2 text-[12px]">
              <span className="font-medium uppercase tracking-[0.08em] text-orange">{g.who}</span>
              <span className="text-parchment/40">
                n = {g.n} · {g.sub}
              </span>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-6">
              {g.stats.map((st, i) => (
                <motion.li
                  key={st.text}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: 0.1 + (gi * 2 + i) * 0.1, duration: 0.55, ease: EASE }}
                >
                  <div className="t-number text-[44px] leading-none">
                    <Figure value={st.value} />
                  </div>
                  <div className="mt-2 text-[13px] leading-[1.4] text-parchment/65">{st.text}</div>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
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
          <SurveyPhotos />

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
              <SurveyBand />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
