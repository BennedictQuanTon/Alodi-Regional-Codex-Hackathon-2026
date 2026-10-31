"use client";

import { motion } from "motion/react";
import { FEATURES, NUMBERS_PDF } from "@/lib/content";
import { Mark, SourceNote } from "@/components/site/brand";
import { ArchitectureDiagram } from "./architecture";
import { Figure, Reveal, RevealText } from "./motion";

export function Product() {
  return (
    <section id="product" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <div className="t-eyebrow">Architecture</div>
            <RevealText text="An agent layer between the buyer and the carrier." className="t-h1 mt-5 max-w-[820px]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[440px] text-[18px] leading-[1.4] text-graphite lg:ml-auto">
              GPT-6.1 Terra runs the agent in the middle. The carrier keeps every system it already has.
            </p>
          </Reveal>
        </div>
        <div className="mt-10">
          <ArchitectureDiagram />
        </div>
      </div>
    </section>
  );
}

/** Monad "Why Teams Choose" cards: soft colour bloom top-left, serif title, mono body. */
export function Features() {
  return (
    <section id="features" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <RevealText text="Why Alodi" className="t-h1" />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.k} delay={(i % 2) * 0.06}>
              <div className="relative h-full overflow-hidden rounded-[16px] border border-navy/80 p-8 md:p-10">
                <div className="wash -left-16 -top-24 h-[260px] w-[360px] opacity-90" style={{ background: `radial-gradient(circle, ${f.tint}, transparent 70%)` }} />
                <div className="relative">
                  <Mark kind={i % 3 === 0 ? "dot" : i % 3 === 1 ? "square" : "check"} size={32} className="text-navy" />
                  <h3 className="t-h3 mt-6">{f.title}</h3>
                  <p className="mt-6 text-[18px] leading-[1.45] text-graphite">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

const JOURNEY = [
  { id: "shipper", who: "Shipper", did: "One tap" },
  { id: "buyer", who: "Buyer", did: "Answers" },
  { id: "next", who: "Next shipper", did: "Sees the card" },
];

export function Outcomes() {
  const net = 187.4;
  const loss = 472.9;
  return (
    <section id="metrics" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">Outcomes</div>
        </Reveal>
        <RevealText text="Less money lost. A second drop that just works." className="t-h1 mt-5 max-w-[900px]" stagger={0.03} />

        <div className="mt-10 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="flex flex-col justify-between rounded-[24px] bg-ink p-8 text-parchment md:p-10">
            <div className="flex items-baseline justify-between gap-4 text-[12px] uppercase tracking-[0.08em] text-parchment/70">
              <span>Saved a month, one area</span>
              <span>Projected</span>
            </div>
            <div className="t-number mt-8 whitespace-nowrap text-[72px] leading-none text-orange sm:text-[96px]">
              <Figure value="₫187M" />
            </div>
            <div className="mt-10 space-y-5" role="img" aria-label="Monthly loss per area: ₫473M today, ₫286M with Alodi, ₫187M saved">
              <div>
                <div className="flex justify-between text-[14px] text-parchment/80">
                  <span>Lost today</span>
                  <span className="tabular-nums">₫473M</span>
                </div>
                <motion.div className="mt-2 h-9 origin-left rounded-[6px] bg-parchment/30" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1, ease: EASE }} />
              </div>
              <div>
                <div className="flex justify-between text-[14px] text-parchment/80">
                  <span>With Alodi</span>
                  <span className="tabular-nums">₫286M</span>
                </div>
                <div className="mt-2 flex h-9 gap-[3px]">
                  <motion.div className="origin-left rounded-[6px] bg-parchment/30" style={{ width: `${((loss - net) / loss) * 100}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1, delay: 0.15, ease: EASE }} />
                  <motion.div className="flex flex-1 origin-left items-center justify-center rounded-[6px] bg-orange text-[14px] font-medium text-white" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay: 0.9, ease: EASE }}>
                    −₫187M · 40%
                  </motion.div>
                </div>
              </div>
            </div>
            <a href={NUMBERS_PDF} target="_blank" rel="noreferrer" className="mt-8 self-start text-[15px] font-medium text-parchment underline decoration-orange underline-offset-4">
              See every formula · PDF →
            </a>
          </Reveal>

          <Reveal delay={0.1} className="flex flex-col justify-between rounded-[24px] border border-ash bg-paper p-8 md:p-10">
            <div className="flex items-baseline justify-between gap-4 text-[12px] uppercase tracking-[0.08em] text-smoke">
              <span>From answer to card</span>
              <span>Target</span>
            </div>
            <div className="t-number mt-8 whitespace-nowrap text-[72px] leading-none sm:text-[96px]">
              <Figure value="< 10 s" />
            </div>
            <div className="mt-10" role="img" aria-label="From the buyer's answer at zero seconds to the card on the shipper's phone in under ten seconds">
              <div className="relative h-9 overflow-hidden rounded-[6px] bg-ash-soft">
                <motion.div className="h-full origin-left bg-navy" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 1.4, ease: EASE }} />
              </div>
              <div className="mt-2 flex justify-between text-[12px] tabular-nums text-graphite">
                {[0, 2, 4, 6, 8, 10].map((s) => (
                  <span key={s}>{s} s</span>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between gap-4">
                {[JOURNEY[1], JOURNEY[2]].map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3 ${i ? "flex-row-reverse text-right" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/people/${p.id}.svg`} alt="" width={52} height={52} className="rounded-full" />
                    <div>
                      <div className="text-[15px] font-medium text-navy">{p.did}</div>
                      <div className="text-[13px] text-graphite">{p.who}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[15px] leading-[1.45] text-graphite">No form to fill, no extra step. The next attempt simply knows when, where and who.</p>
            </div>
          </Reveal>
        </div>
        <SourceNote className="mt-4">Team cost model, PRD §18.8, best-in-class rescue 25% → 65% (Shipsy vendor range); time-to-context target, PRD §2.3.</SourceNote>
      </div>
    </section>
  );
}
