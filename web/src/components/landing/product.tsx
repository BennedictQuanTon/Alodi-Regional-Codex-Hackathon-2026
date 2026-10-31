"use client";

import { motion } from "motion/react";
import { FEATURES, MONEY, NUMBERS_PDF, OUTPUT_METRICS } from "@/lib/content";
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
const LOSS = 472.9;
const GROSS = 214.7;
const COST = 20.9;

/** Proportional bar: the monthly loss, the part Alodi recovers, and the running cost taken out of it. */
function MoneyBar() {
  const pct = (v: number) => `${(v / LOSS) * 100}%`;
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-ash-soft">
        <motion.div
          className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: pct(GROSS) }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          <span className="h-full bg-orange" style={{ width: `${((GROSS - COST) / GROSS) * 100}%` }} />
          <span className="h-full bg-navy" style={{ width: `${(COST / GROSS) * 100}%` }} />
        </motion.div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {MONEY.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: EASE }}
            className="flex items-start gap-2.5"
          >
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? "bg-ash" : i === 1 ? "bg-orange/50" : i === 2 ? "bg-navy" : "bg-orange"}`} />
            <span>
              <span className={`t-number block text-[28px] leading-none ${i === 3 ? "text-orange-deep" : ""}`}>{m.value}</span>
              <span className="mt-1.5 block text-[13px] text-graphite">{m.label}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function Outcomes() {
  return (
    <section id="metrics" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">Expected outcomes</div>
        </Reveal>
        <RevealText text="What we will be judged on." className="t-h1 mt-5" stagger={0.035} />

        <Reveal className="mt-10">
          <div className="overflow-hidden rounded-[24px] border border-ash">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {OUTPUT_METRICS.map((m, i) => (
                <div
                  key={m.metric}
                  className={`flex flex-col p-7 md:p-8 ${i > 0 ? "border-t border-ash sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t xl:border-t-0" : ""} ${i > 0 ? "xl:border-l" : ""}`}
                >
                  <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-smoke">{m.metric}</span>
                  <div className={`t-number mt-8 whitespace-nowrap text-[64px] leading-none md:text-[76px] ${i === 3 ? "text-orange-deep" : ""}`}>
                    <Figure value={m.target} />
                  </div>
                  <p className="mt-5 max-w-[240px] text-[14px] leading-[1.45] text-graphite">{m.how}</p>
                </div>
              ))}
            </div>
            <div className="grid items-end gap-8 border-t border-ash bg-paper p-7 md:p-8 xl:grid-cols-[1fr_auto] xl:gap-14">
              <div>
                <div className="mb-5 text-[12px] font-medium uppercase tracking-[0.08em] text-smoke">Where ₫194M a month comes from · one area</div>
                <MoneyBar />
              </div>
              <a href={NUMBERS_PDF} target="_blank" rel="noreferrer" className="btn btn-dark justify-self-start">
                The numbers, proved · PDF
              </a>
            </div>
          </div>
          <SourceNote className="mt-4">Team cost model, PRD §18.8. Best-in-class rescue, 25% → 65% (Shipsy vendor range). Base case ₫99M a month. Money is projected; the other three are measured on stage.</SourceNote>
        </Reveal>
      </div>
    </section>
  );
}
