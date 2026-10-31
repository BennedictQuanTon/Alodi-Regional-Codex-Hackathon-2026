import { FEATURES, OUTPUT_METRICS } from "@/lib/content";
import { Mark } from "@/components/site/brand";
import { Reveal, RevealText } from "./motion";

type Box = { t: string; tech?: string; d: string };

function Layer({
  title,
  tint,
  edge,
  items,
  cols,
  className = "",
  children,
  delay = 0,
}: {
  title: string;
  tint: string;
  edge: string;
  items?: Box[];
  cols?: string;
  className?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <div className="h-full rounded-[14px] border p-4" style={{ background: tint, borderColor: edge }}>
        <div className="mb-3 text-[12px] uppercase tracking-[0.04em]" style={{ color: edge }}>
          {title}
        </div>
        {items && (
          <div className={`grid gap-2 ${cols ?? "sm:grid-cols-3"}`}>
            {items.map((b) => (
              <div key={b.t} className="rounded-[10px] bg-paper px-3 py-2.5 shadow-[0_0_0_1px_rgba(31,42,68,0.07)]">
                <div className="t-body-sans text-[14px] font-medium text-navy">{b.t}</div>
                {b.tech && <div className="mt-0.5 text-[11px] text-smoke">[{b.tech}]</div>}
                <div className="t-body-sans mt-1 text-[12px] leading-[1.35] text-graphite">{b.d}</div>
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </Reveal>
  );
}

/** Animated connector between layers: dashed = async events, solid = sync calls. */
function Flow({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 py-2" aria-hidden>
      <span className={`h-6 w-[2px] ${dashed ? "flow-dash" : "bg-navy/40"}`} />
      <span className="rounded-full border border-ash bg-paper px-3 py-1 text-[11px] text-graphite">{label}</span>
      <span className={`h-6 w-[2px] ${dashed ? "flow-dash" : "bg-navy/40"}`} />
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="rounded-[16px] border border-ash bg-paper/70 p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="t-eyebrow text-smoke">C4 container view · target deployment</div>
          <div className="t-body-sans mt-1 text-[13px] text-graphite">The demo runs the same shape on mock data and cloud APIs.</div>
        </div>
        <div className="flex gap-5 text-[11px] uppercase text-smoke">
          <span className="flex items-center gap-2"><span className="h-[2px] w-6 bg-navy/50" /> sync</span>
          <span className="flex items-center gap-2"><span className="flow-dash h-[2px] w-6" /> async / event</span>
        </div>
      </div>

      {/* row 1: people → apps → gateway → contact */}
      <div className="grid gap-3 lg:grid-cols-[0.7fr_2fr_1.2fr_1.3fr]">
        <Layer title="Internal users" tint="#eef0f4" edge="#1f2a44" delay={0}>
          <ul className="t-body-sans space-y-1.5 text-[14px] text-navy">
            <li>Courier</li>
            <li>Dispatcher</li>
            <li>Customer service</li>
          </ul>
        </Layer>
        <Layer
          title="Presentation layer"
          tint="#eaf0fb"
          edge="#3f5fae"
          delay={0.05}
          items={[
            { t: "Courier app", tech: "PWA · React", d: "One tap, context card" },
            { t: "Dispatcher", tech: "Next.js", d: "Exception queue with context" },
            { t: "CS console", tech: "Next.js", d: "Escalations, label approval" },
          ]}
        />
        <Layer
          title="API gateway"
          tint="#e8f6f1"
          edge="#1f8a5b"
          delay={0.1}
          cols="grid-cols-3"
          items={[
            { t: "FastAPI", d: "REST" },
            { t: "Webhook", d: "ingest" },
            { t: "WebSocket", d: "stream" },
          ]}
        />
        <Layer
          title="Contact layer → buyer"
          tint="#fdeee4"
          edge="#c94b00"
          delay={0.15}
          cols="grid-cols-1"
          items={[
            { t: "Chat gateway", d: "Shopee chat · Zalo · SMS" },
            { t: "Voice gateway", d: "SIP trunk + verified brand name" },
          ]}
        />
      </div>

      <Flow label="button events · today’s orders (webhook / CDC)" dashed />

      {/* row 2: agent layer (one agent + tools) + timers */}
      <div className="grid gap-3 lg:grid-cols-[2.6fr_1fr]">
        <Reveal delay={0.05}>
          <div className="h-full rounded-[14px] border p-4" style={{ background: "#fff4ec", borderColor: "#f05a00" }}>
            <div className="mb-3 text-[12px] uppercase tracking-[0.04em] text-orange-deep">Agent layer · Alodi agent (one agent + tools)</div>
            <div className="relative mx-auto mb-4 flex max-w-[460px] items-center gap-3 overflow-hidden rounded-[12px] bg-orange px-4 py-3 text-ink">
              <span className="orch-sheen pointer-events-none absolute inset-0" aria-hidden />
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden className="relative shrink-0">
                <circle cx="12" cy="12" r="8.6" fill="none" stroke="#fff" strokeWidth="4" />
                <g fill="var(--color-ink)">
                  <rect x="8.55" y="10.25" width="1.5" height="3.5" rx="0.75" />
                  <rect x="11.25" y="8.9" width="1.5" height="6.2" rx="0.75" />
                  <rect x="13.95" y="10.25" width="1.5" height="3.5" rx="0.75" />
                </g>
              </svg>
              <div className="relative">
                <div className="t-body-sans text-[16px] font-medium">Alodi Agent · the brain</div>
                <div className="text-[11px]">state machine per order + LLM tool calling</div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                ["Ask for a window", "tool", "Before delivery, ≥2 options"],
                ["Send chat", "tool", "Branch A · Shopee chat, Zalo"],
                ["AI call", "tool", "Max 2 calls · ASR ↔ TTS"],
                ["Extract", "tool", "JSON schema + confidence"],
                ["Policy guard", "rule", "Quiet hours, caps · human approval"],
              ].map(([t, kind, d], i) => (
                <div key={t} className="relative rounded-[10px] bg-paper px-3 py-2.5 shadow-[0_0_0_1px_rgba(240,90,0,0.25)]">
                  <span className="agent-pulse absolute right-2 top-2 size-1.5 rounded-full bg-orange" style={{ animationDelay: `${i * 0.5}s` }} />
                  <div className="t-body-sans text-[14px] font-medium text-navy">{t}</div>
                  <div className="mt-0.5 text-[11px] text-smoke">[{kind}]</div>
                  <div className="t-body-sans mt-1 text-[12px] leading-[1.35] text-graphite">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Layer title="Rescue timer watcher" tint="#fdf0f3" edge="#b4235a" delay={0.1}>
          <ul className="space-y-1.5">
            {[
              ["T0", "tap → chat now"],
              ["+60′", "silence → AI call 1"],
              ["+2h", "AI call 2 → CS"],
              ["08:00–20:30", "calls only in this window"],
              ["≤ 2 cycles", "per order, within 5 days"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-3 rounded-[8px] bg-paper px-3 py-2 shadow-[0_0_0_1px_rgba(180,35,90,0.15)]">
                <span className="text-[12px] text-[#b4235a]">{k}</span>
                <span className="t-body-sans text-right text-[12px] text-graphite">{v}</span>
              </li>
            ))}
          </ul>
        </Layer>
      </div>

      <Flow label="prompt · audio ↔ text · JSON   ·   write context" />

      {/* row 3: intelligence + data */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Layer
          title="Intelligence layer"
          tint="#eef8ee"
          edge="#2f8f3e"
          delay={0.05}
          cols="sm:grid-cols-2 xl:grid-cols-4"
          items={[
            { t: "Model gateway", tech: "OpenAI API", d: "Structured Outputs; on-prem LLM later" },
            { t: "ASR", tech: "AssemblyAI", d: "Streaming Vietnamese; PhoWhisper later" },
            { t: "Vietnamese TTS", tech: "OpenAI TTS", d: "Pre-recorded + dynamic phrases" },
            { t: "PII redactor", tech: "Guardrails", d: "Masks phones and addresses before cloud" },
          ]}
        />
        <Layer
          title="Data layer"
          tint="#edf1fb"
          edge="#3f5fae"
          delay={0.1}
          cols="sm:grid-cols-2 xl:grid-cols-4"
          items={[
            { t: "Order context", tech: "PostgreSQL", d: "Versions + audit log, courier notes" },
            { t: "Conversation vault", tech: "Object storage", d: "Raw audio, transcripts · 30-day TTL" },
            { t: "Queue & timers", tech: "Redis", d: "Schedules, retries, job queue" },
            { t: "Metrics & eval", tech: "PostgreSQL", d: "4 key metrics, eval set + log" },
          ]}
        />
      </div>

      <Flow label="write to the waybill   ·   escalate: 2 cycles used · low confidence · refused" dashed />

      <Layer
        title="Carrier systems (external) · SPX / depot"
        tint="#f3effb"
        edge="#6b4fbb"
        delay={0.05}
        cols="sm:grid-cols-2 xl:grid-cols-4"
        items={[
          { t: "Carrier OMS", d: "Today’s orders · COD · webhook / CDC" },
          { t: "Route planner", d: "Routes + feasible windows" },
          { t: "Courier app backend", d: "Button events · context card" },
          { t: "CS ticketing + hotline", d: "Escalations · call-backs" },
        ]}
      />

      <div className="h-3" />

      <Layer
        title="Infrastructure"
        tint="#f1efed"
        edge="#6b7183"
        delay={0.05}
        cols="sm:grid-cols-2 xl:grid-cols-4"
        items={[
          { t: "Demo · 31 Oct", d: "Docker Compose · 1 VM · fast-forward clock" },
          { t: "Region GPU · LLM", d: "On-prem serving (7–14B, estimated)" },
          { t: "Region GPU · Speech", d: "ASR + TTS on-prem" },
          { t: "Cloud fallback", d: "Receives only PII-masked data" },
        ]}
      />
    </div>
  );
}

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
          <ArchitectureDiagram />
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
      </div>
    </section>
  );
}
