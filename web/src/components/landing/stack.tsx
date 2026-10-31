"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { TECH_DEMO, TECH_PROD, type Tech } from "@/lib/content";
import { DropRing } from "@/components/site/brand";
import { TechIcon } from "@/components/site/logos";
import { Reveal, RevealText } from "./motion";
import { VelocityMarquee } from "./velocity-marquee";

const INNER = TECH_DEMO.filter((t) => ["siNextdotjs", "siFastapi", "siOpenai", "siLanggraph", "siTypescript", "siDocker"].includes(t.icon)).filter(
  (t, i, a) => a.findIndex((x) => x.icon === t.icon) === i,
);
const OUTER = TECH_PROD.filter((t) => ["siPostgresql", "siTemporal", "siApachekafka", "siNvidia", "siHuggingface", "siZalo", "siMinio", "siKubernetes"].includes(t.icon));

function OrbitRing({ items, radius, duration, reverse = false, size = 52 }: { items: Tech[]; radius: number; duration: number; reverse?: boolean; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: radius * 2,
        height: radius * 2,
        marginLeft: -radius,
        marginTop: -radius,
        animation: reduce ? undefined : `orbit-spin ${duration}s linear infinite ${reverse ? "reverse" : ""}`,
      }}
    >
      <div className="absolute inset-0 rounded-full border border-dashed border-navy/20" />
      {items.map((t, i) => {
        const a = (360 / items.length) * i;
        return (
          <div
            key={t.name}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${a}deg) translateX(${radius}px) rotate(${-a}deg)`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
          >
            <div
              className="group/chip relative grid h-full w-full place-items-center rounded-full bg-paper shadow-[0_0_0_1px_rgba(31,42,68,0.08),0_10px_24px_-10px_rgba(31,42,68,0.35)] transition-transform duration-300 hover:scale-110"
              style={{ animation: reduce ? undefined : `orbit-spin ${duration}s linear infinite ${reverse ? "" : "reverse"}` }}
              title={`${t.name} · ${t.note}`}
            >
              <TechIcon icon={t.icon} size={size * 0.46} />
              <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-full bg-navy px-2.5 py-1 text-[11px] text-parchment opacity-0 transition-opacity group-hover/chip:opacity-100">
                {t.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Orbit() {
  return (
    <div className="relative mx-auto size-[540px] shrink-0 max-sm:-mx-[97px] max-sm:-my-[97px] max-sm:scale-[0.64] sm:max-lg:-my-[40px] sm:max-lg:scale-[0.85] [&:hover_*]:[animation-play-state:paused]">
      <div className="wash left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-80" style={{ background: "radial-gradient(circle, rgba(240,90,0,0.55), transparent 70%)" }} />
      <OrbitRing items={OUTER} radius={236} duration={90} />
      <OrbitRing items={INNER} radius={146} duration={60} reverse size={56} />
      <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-navy shadow-[0_20px_50px_-12px_rgba(18,26,44,0.6)]">
        <span className="pulse-ring absolute inset-0 rounded-full border-2 border-orange" />
        <DropRing size={56} dot="var(--color-parchment)" />
      </div>
    </div>
  );
}

function LogoCard({ t, dark = false }: { t: Tech; dark?: boolean }) {
  return (
    <div
      className={`group mx-2 flex w-[290px] items-center gap-4 rounded-[14px] px-5 py-4 transition duration-300 hover:-translate-y-1 ${
        dark
          ? "bg-navy text-parchment shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_0_0_1px_rgba(240,90,0,0.8),0_16px_32px_-16px_rgba(18,26,44,0.6)]"
          : "bg-paper shadow-[0_0_0_1px_rgba(31,42,68,0.08)] hover:shadow-[0_0_0_1px_rgba(240,90,0,0.8),0_16px_32px_-16px_rgba(31,42,68,0.35)]"
      }`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-full ${dark ? "bg-parchment" : "bg-parchment shadow-[inset_0_0_0_1px_rgba(31,42,68,0.08)]"}`}>
        <TechIcon icon={t.icon} size={24} />
      </span>
      <span className="min-w-0">
        <span className="t-h4 block truncate !text-[22px]">{t.name}</span>
        <span className={`mt-0.5 block truncate text-[12px] uppercase ${dark ? "text-parchment/60" : "text-smoke"}`}>{t.note}</span>
      </span>
    </div>
  );
}

export function Stack() {
  return (
    <section id="tech" className="scroll-mt-28 py-16">
      <div className="relative mx-1 overflow-hidden rounded-[32px] bg-peach-mist md:mx-2">
        <div className="wash -left-32 bottom-0 h-[420px] w-[520px] opacity-70" style={{ background: "radial-gradient(circle, rgba(160,181,235,0.9), transparent 70%)" }} />
        <div className="container-page relative grid items-center gap-12 py-20 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="t-eyebrow">Tech stack</div>
            <RevealText text="A Stack That Runs Today, and Scales In-House" className="t-h2 mt-6 max-w-[560px]" />
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-[520px] text-[20px] leading-[1.35] text-graphite">
                The demo runs in the browser on mock data and a fast-forward clock. In production the model gateway moves
                on-prem per region and Vietnamese ASR is fine-tuned for regional accents.
              </p>
              <div className="mt-10 flex flex-wrap gap-6 text-[13px] uppercase">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-paper shadow-[0_0_0_1px_rgba(31,42,68,0.3)]" /> Inner orbit · demo, 31 Oct
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full border border-dashed border-navy" /> Outer orbit · production
                </span>
              </div>
              <Link href="/demo" className="btn btn-dark mt-10">
                Explore the demo
              </Link>
            </Reveal>
          </div>
          <motion.div className="flex justify-center" initial={{ opacity: 0, scale: 0.9, rotate: -8 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
            <Orbit />
          </motion.div>
        </div>
        <div className="relative space-y-4 pb-16">
          <VelocityMarquee speed={42} className="[mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            {TECH_DEMO.map((t) => (
              <LogoCard key={t.name} t={t} />
            ))}
          </VelocityMarquee>
          <VelocityMarquee speed={34} reverse className="[mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            {TECH_PROD.map((t) => (
              <LogoCard key={t.name} t={t} dark />
            ))}
          </VelocityMarquee>
        </div>
      </div>
    </section>
  );
}
