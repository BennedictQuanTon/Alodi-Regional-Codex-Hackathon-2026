import { TECH_DEMO, TECH_PROD, type Tech } from "@/lib/content";
import { TechIcon } from "@/components/site/logos";
import { Reveal, RevealText } from "./motion";

function Chip({ t }: { t: Tech }) {
  return (
    <li className="mq-chip" title={t.note}>
      {t.icon ? (
        <TechIcon icon={t.icon} size={24} mono />
      ) : (
        <span className="mq-mono" aria-hidden>
          {t.mono}
        </span>
      )}
      <span>{t.name}</span>
      <span className="mq-note">{t.note}</span>
    </li>
  );
}

/** Infinite loop: the list is rendered twice and shifted by exactly one copy. */
function Marquee({ items, reverse = false, seconds }: { items: Tech[]; reverse?: boolean; seconds: number }) {
  return (
    <div className="mq">
      <div className={`mq-track ${reverse ? "mq-reverse" : ""}`} style={{ animationDuration: `${seconds}s` }}>
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined}>
            {items.map((t) => (
              <Chip key={t.name} t={t} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function Stack() {
  return (
    <section id="tech" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <div className="t-eyebrow">Tech stack</div>
            </Reveal>
            <RevealText text="Cloud APIs on demo day. One server per area in production." className="t-h2 mt-6 max-w-[640px]" />
          </div>
          <Reveal delay={0.1}>
            <p className="text-[18px] leading-[1.4] text-graphite">
              Same interfaces in both rows; only the implementations swap. In production OpenAI’s open-weight model runs on
              the area server and the cloud API only sees masked text for the hardest cases.
            </p>
          </Reveal>
        </div>
      </div>
      <Reveal className="mt-14 grid gap-2">
        <div className="container-page text-[12px] uppercase text-smoke">Demo · 31 Oct</div>
        <Marquee items={TECH_DEMO} seconds={46} />
        <div className="container-page mt-6 text-[12px] uppercase text-smoke">Production · per area</div>
        <Marquee items={TECH_PROD} seconds={52} reverse />
      </Reveal>
    </section>
  );
}
