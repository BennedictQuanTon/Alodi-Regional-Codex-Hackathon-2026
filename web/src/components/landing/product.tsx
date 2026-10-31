"use client";

import { motion } from "motion/react";
import { AREA_GAINS, FEATURES, NUMBERS_PDF, OUTPUT_METRICS } from "@/lib/content";
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
              OpenAI runs the agent in the middle. The carrier keeps every system it already has.
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

function cellBorder(i: number) {
  return `${i > 0 ? "border-t border-ash sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t xl:border-t-0" : ""} ${i > 0 ? "xl:border-l" : ""}`;
}

function RowLabel({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ash px-7 py-3.5 md:px-8">
      <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-navy">{children}</span>
      {right && <span className="text-[12px] text-smoke">{right}</span>}
    </div>
  );
}

export function Outcomes() {
  const net = 193.8;
  const loss = 472.9;
  return (
    <section id="metrics" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">Outcomes</div>
        </Reveal>
        <RevealText text="What we will be judged on." className="t-h1 mt-5" stagger={0.035} />

        <Reveal className="mt-10">
          <div className="overflow-hidden rounded-[24px] border border-ash">
            <RowLabel right="PRD §2.3 · §23">Measured on stage</RowLabel>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {OUTPUT_METRICS.map((m, i) => (
                <div key={m.metric} className={`flex flex-col p-7 md:p-8 ${cellBorder(i)}`}>
                  <span className="text-[12px] uppercase tracking-[0.08em] text-smoke">{m.metric}</span>
                  <div className="t-number mt-6 whitespace-nowrap text-[56px] leading-none md:text-[64px]">
                    <Figure value={m.target} />
                  </div>
                  <p className="mt-4 max-w-[230px] text-[14px] leading-[1.45] text-graphite">{m.how}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-ash bg-paper">
              <RowLabel right="PRD §18.8 · projected">What one area gets back</RowLabel>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                {AREA_GAINS.map((g, i) => (
                  <div key={g.label} className={`flex flex-col p-7 md:p-8 ${cellBorder(i)}`}>
                    <span className="text-[12px] uppercase tracking-[0.08em] text-smoke">a day</span>
                    <div className="t-number mt-6 whitespace-nowrap text-[56px] leading-none md:text-[64px]">
                      <Figure value={g.value} />
                    </div>
                    <p className="mt-4 text-[14px] leading-[1.45] text-graphite">{g.label}</p>
                    <p className="mt-1 text-[12px] text-smoke">{g.note}</p>
                  </div>
                ))}
                <div className={`flex flex-col p-7 md:p-8 ${cellBorder(3)}`}>
                  <span className="text-[12px] uppercase tracking-[0.08em] text-smoke">a month, net</span>
                  <div className="t-number mt-6 whitespace-nowrap text-[56px] leading-none text-orange-deep md:text-[64px]">
                    <Figure value="₫194M" />
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ash-soft">
                    <motion.div
                      className="h-full rounded-full bg-orange"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(net / loss) * 100}%` }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 1.3, ease: EASE }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-smoke">41% of the ₫473M lost each month</p>
                  <a href={NUMBERS_PDF} target="_blank" rel="noreferrer" className="mt-5 text-[13px] font-medium text-navy underline decoration-orange decoration-2 underline-offset-4 hover:text-orange-deep">
                    See every formula · PDF →
                  </a>
                </div>
              </div>
            </div>
          </div>
          <SourceNote className="mt-4">PRD §2.3, §23 targets; §18.8 team cost model, best-in-class rescue 25% → 65% (Shipsy vendor range); base case ₫99M a month.</SourceNote>
        </Reveal>
      </div>
    </section>
  );
}
