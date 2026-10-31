import { FEATURES, OUTPUT_METRICS, SAVINGS } from "@/lib/content";
import { Mark, SourceNote } from "@/components/site/brand";
import { C4Architecture } from "./architecture";
import { Figure, Reveal, RevealText } from "./motion";

export function Product() {
  return (
    <section id="product" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <div className="t-eyebrow">What Alodi is</div>
            <RevealText text="An agent layer between the buyer and the carrier." className="t-h1 mt-6" />
          </div>
          <Reveal delay={0.1}>
            <p className="text-[20px] leading-[1.35] text-graphite">
              Alodi reads failed-delivery events, talks to the buyer, and writes structured context back into the carrier’s
              own systems. It replaces nothing the carrier already runs.
            </p>
          </Reveal>
        </div>
        <div className="mt-12">
          <C4Architecture />
        </div>
      </div>
    </section>
  );
}

/** Monad "Why Teams Choose" cards: soft colour bloom top-left, serif title, mono body. */
export function Features() {
  return (
    <section id="features" className="scroll-mt-28 py-24 md:py-32">
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
    <section id="metrics" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">Expected outcomes</div>
          </Reveal>
          <RevealText text="Four problem numbers. Four output metrics. The story closes the loop." className="t-h1 mt-6 max-w-[1000px]" stagger={0.035} />
          <Reveal>
          <p className="mt-8 max-w-[760px] text-[20px] leading-[1.35] text-graphite">
            Accuracy and Safe autonomy are measured on stage. Time-to-context is the best moment of the demo. Money always
            carries the word “projected”.
          </p>
        </Reveal>
        <div className="mt-14 border-t border-ash">
          {OUTPUT_METRICS.map((m, i) => (
            <Reveal key={m.metric} delay={i * 0.05}>
              <div className="grid gap-6 border-b border-ash py-10 md:grid-cols-[1fr_1.4fr_auto] md:items-center md:gap-10">
                <div>
                  <div className="t-label text-smoke">Problem</div>
                  <div className="mt-2 text-[16px] text-graphite">{m.problem}</div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="t-h2">{m.metric}</h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase ${
                        m.kind === "Measured" ? "border-good text-good" : "border-warn text-warn"
                      }`}
                    >
                      {m.kind}
                    </span>
                  </div>
                  <p className="t-body-sans mt-3 max-w-[560px] text-[15px] leading-[1.45] text-graphite">{m.how}</p>
                </div>
                <div className="md:text-right">
                  <div className="t-number text-[48px] md:text-[64px]">{m.target}</div>
                  <div className="mt-2 text-[12px] uppercase text-smoke">{m.targetNote}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14">
          <div className="t-eyebrow text-smoke">One area · 20 couriers · 4,000 orders a day · best-in-class rescue</div>
          <div className="mt-6 grid border-t border-ash sm:grid-cols-2 xl:grid-cols-4">
            {SAVINGS.map((s, i) => (
              <div key={s.value} className={`border-b border-ash py-8 sm:px-8 sm:first:pl-0 xl:border-b-0 ${i > 0 ? "xl:border-l" : ""} ${i % 2 === 1 ? "sm:border-l" : ""}`}>
                <div className={`t-number text-[56px] md:text-[64px] ${i === 0 ? "text-orange-deep" : ""}`}>
                  <Figure value={s.value} />
                </div>
                <p className="mt-4 max-w-[280px] text-[15px] leading-[1.4] text-graphite">{s.text}</p>
                <div className="mt-3 text-[11px] uppercase text-smoke">{s.note}</div>
              </div>
            ))}
          </div>
          <SourceNote className="mt-4">Team cost model, PRD §18.8; rescue 25% → 65% uses Shipsy’s best-in-class range (vendor). Base case: ₫99M a month (21%).</SourceNote>
        </Reveal>
      </div>
    </section>
  );
}
