import { HERO_STATS, SIDE_FACTS } from "@/lib/content";
import { SourceNote } from "@/components/site/brand";
import { BomRateChart, DepotDayChart, GmvChart, LossChart } from "./charts";
import { Figure, Reveal, RevealText } from "./motion";

function ChartCard({ title, note, source, children }: { title: string; note: string; source: string; children: React.ReactNode }) {
  return (
    <figure className="flex h-full flex-col rounded-[16px] border border-ash p-6 md:p-8">
      <figcaption className="t-h4">{title}</figcaption>
      <div className="mt-8 flex-1">{children}</div>
      <div className="mt-6 border-t border-ash pt-4">
        <p className="t-body-sans text-[13px] leading-[1.45] text-graphite">{note}</p>
        <SourceNote className="mt-1">{source}</SourceNote>
      </div>
    </figure>
  );
}

export function Problem() {
  return (
    <section id="problem" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">The problem</div>
        </Reveal>
        <RevealText text="Every failed delivery is a time negotiation that happens outside the system, then disappears." className="t-h1 mt-6 max-w-[1080px]" stagger={0.03} />

        <div className="mt-16 grid border-t border-ash sm:grid-cols-2 xl:grid-cols-4">
          {HERO_STATS.map((s, i) => (
            <Reveal
              key={s.value}
              delay={i * 0.08}
              className={`flex flex-col border-b border-ash py-10 sm:px-8 sm:first:pl-0 xl:border-b-0 ${i > 0 ? "xl:border-l" : ""} ${
                i % 2 === 1 ? "sm:border-l" : ""
              }`}
            >
              <div className="t-eyebrow text-orange-deep">{s.tag}</div>
              <div className="t-number mt-8 whitespace-nowrap text-[64px] md:text-[80px] xl:text-[72px] 2xl:text-[88px]">
                <Figure value={s.value} />
              </div>
              <p className="mt-6 max-w-[320px] text-[16px] leading-[1.35] text-graphite">{s.text}</p>
              <SourceNote className="mt-4 max-w-[320px]">{s.source}</SourceNote>
            </Reveal>
          ))}
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <ChartCard
              title="How often orders are refused in Vietnam"
              source="VECOM (nationwide, remote); Tran Anh Tung (today, sale season), Nguoi Lao Dong, Jul 2025"
              note="This measures buyers refusing at the door, so it describes the scale of the problem."
            >
              <BomRateChart />
            </ChartCard>
          </Reveal>
          <Reveal delay={0.08}>
            <ChartCard
              title="A day at a 10,000-order depot"
              source="Team assumptions; baseline rescue rate from Shipsy"
              note="8% is a conservative mark below the VECOM range. The 20–30% baseline rescue rate is a vendor figure."
            >
              <DepotDayChart />
            </ChartCard>
          </Reveal>
          <Reveal>
            <ChartCard
              title="Daily loss per depot (million VND)"
              source="Shopee return fee policy; GHN courier earnings; hub/CS cost is a team estimate"
              note="Redelivery: 800 orders × ~1.5 attempts × 6,000–8,000 VND courier pay."
            >
              <LossChart />
            </ChartCard>
          </Reveal>
          <Reveal delay={0.08}>
            <ChartCard
              title="E-commerce grows faster than call teams can hire"
              source="Metric, E-commerce Report 2025 (Shopee, TikTok Shop, Lazada, Tiki)"
              note="2024 derived from the 34.75% growth. Q1 2026 grew a further 46.6%. 13 callers is a team estimate."
            >
              <div className="grid items-end gap-8 sm:grid-cols-[1.1fr_1fr]">
                <GmvChart />
                <div className="space-y-8 pb-4">
                  <div>
                    <div className="t-number text-[56px] text-orange-deep">
                      <Figure value="+34.75%" />
                    </div>
                    <div className="mt-2 text-[13px] text-smoke">trillion VND, 4 marketplaces, 2025 vs 2024</div>
                  </div>
                  <div>
                    <div className="t-number text-[56px]">
                      ≈ <Figure value="13" /> callers
                    </div>
                    <div className="mt-2 text-[13px] text-smoke">to phone 800 buyers a day (800 × 2 calls × 4 min)</div>
                  </div>
                </div>
              </div>
            </ChartCard>
          </Reveal>
        </div>

        <Reveal className="mt-4">
          <div className="grid gap-px overflow-hidden rounded-[16px] border border-ash bg-ash md:grid-cols-3">
            {SIDE_FACTS.map((f) => (
              <div key={f.strong} className="bg-parchment p-8">
                <div className="t-h4">{f.strong}</div>
                <p className="mt-3 text-[15px] leading-[1.4] text-graphite">{f.rest}</p>
                <SourceNote className="mt-3">{f.source}</SourceNote>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
