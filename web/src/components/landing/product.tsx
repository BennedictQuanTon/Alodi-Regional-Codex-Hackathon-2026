"use client";

import { motion } from "motion/react";
import { FEATURES, MONEY, NUMBERS_PDF, OUTPUT_METRICS } from "@/lib/content";
import { Mark, SourceNote } from "@/components/site/brand";
import { C4Architecture } from "./architecture";
import { Figure, Reveal, RevealText } from "./motion";

export function Product() {
  return (
    <section id="product" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <div className="t-eyebrow">Architecture</div>
            <RevealText text="An agent layer between the buyer and the carrier." className="t-h1 mt-6" />
          </div>
          <Reveal delay={0.1}>
            <p className="text-[20px] leading-[1.35] text-graphite">
              Production design in the C4 model. OpenAI runs the agent; the carrier keeps every system it already has.
            </p>
          </Reveal>
        </div>
        <div className="mt-10">
          <C4Architecture />
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

export function Outcomes() {
  return (
    <section id="metrics" className="scroll-mt-28 py-20 md:py-24">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <div className="t-eyebrow">Expected outcomes</div>
            </Reveal>
            <RevealText text="Four numbers we will be judged on." className="t-h1 mt-6 max-w-[760px]" stagger={0.035} />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[440px] text-[18px] leading-[1.4] text-graphite lg:ml-auto">
              Three are measured on stage from the event log and the eval set. Money is projected, and every input is in the PDF.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid border-y border-ash sm:grid-cols-2 xl:grid-cols-4">
          {OUTPUT_METRICS.map((m, i) => (
            <Reveal
              key={m.metric}
              delay={i * 0.07}
              className={`flex flex-col py-10 sm:px-8 sm:first:pl-0 ${i > 0 ? "border-t border-ash sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i === 2 ? "sm:border-t xl:border-t-0" : ""} ${i === 3 ? "sm:border-t xl:border-t-0" : ""} ${i > 0 ? "xl:border-l" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-navy">{m.metric}</span>
                <span className={`text-[11px] font-medium uppercase tracking-[0.06em] ${m.kind === "Measured" ? "text-good" : "text-warn"}`}>{m.kind}</span>
              </div>
              <div className={`t-number mt-10 whitespace-nowrap text-[64px] leading-none md:text-[80px] ${i === 3 ? "text-orange-deep" : ""}`}>
                <Figure value={m.target} />
              </div>
              <p className="mt-6 max-w-[260px] text-[14px] leading-[1.45] text-graphite">{m.how}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-4">
          <div className="grid items-center gap-8 rounded-[24px] bg-ink px-7 py-7 text-parchment md:px-9 xl:grid-cols-[1fr_auto]">
            <ol className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
              {MONEY.map((m, i) => (
                <motion.li
                  key={m.label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-baseline gap-3">
                    {i > 0 && <span className="text-[20px] text-parchment/30">{i === 2 ? "−" : i === 3 ? "=" : "→"}</span>}
                    <span className={`t-number text-[40px] leading-none md:text-[44px] ${i === 3 ? "text-orange" : ""}`}>{m.value}</span>
                  </div>
                  <div className="mt-2 text-[12px] uppercase tracking-[0.06em] text-parchment/55">{m.label}</div>
                </motion.li>
              ))}
            </ol>
            <a href={NUMBERS_PDF} target="_blank" rel="noreferrer" className="btn justify-self-start bg-parchment text-ink hover:bg-white">
              The numbers, proved · PDF
            </a>
          </div>
          <SourceNote className="mt-4">Team cost model, PRD §18.8. One area, best-in-class rescue (25% → 65%, Shipsy vendor range). Base case ₫99M a month. Projected.</SourceNote>
        </Reveal>
      </div>
    </section>
  );
}
