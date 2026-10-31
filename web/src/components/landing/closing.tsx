"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { COMPETITORS, FAQ, ROADMAP, SOURCES } from "@/lib/content";
import { Chevron, LogoLink, SourceNote, Wordmark } from "@/components/site/brand";
import { Reveal, RevealText } from "./motion";

export function Roadmap() {
  return (
    <section id="roadmap" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <RevealText text="What Comes After the Demo" className="t-h1" />
        <ol className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {ROADMAP.map((r, i) => (
            <Reveal as="li" key={r.k} delay={i * 0.07} className="flex flex-col rounded-[16px] border border-ash p-6">
              <div className="flex items-baseline justify-between">
                <span className="t-number text-[56px] text-navy/90">{r.k}</span>
                <span className={`text-[12px] uppercase ${i === 0 ? "text-orange-deep" : "text-smoke"}`}>{r.when}</span>
              </div>
              <h3 className="t-h4 mt-10">{r.title}</h3>
              <p className="t-body-sans mt-3 text-[15px] leading-[1.45] text-graphite">{r.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Competitors() {
  return (
    <section id="competitors" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <Reveal>
          <div className="t-eyebrow">Competitive landscape</div>
          </Reveal>
          <RevealText text="AI delivery rescue exists in India. Nobody builds it for Vietnamese buyers, starting from one courier tap." className="t-h1 mt-6 max-w-[1080px]" stagger={0.03} />
        <Reveal className="mt-14">
          <div className="overflow-x-auto scrollbar-thin rounded-[16px] border border-ash">
            <table className="w-full min-w-[1120px] border-collapse text-left text-[14px]">
              <thead>
                <tr>
                  <th className="w-[210px] border-b border-ash p-5 font-normal" />
                  {COMPETITORS.columns.map((c, i) => (
                    <th key={c} className={`border-b border-ash p-5 align-bottom font-normal ${i === 0 ? "bg-navy text-parchment" : ""}`}>
                      {i === 0 ? <Wordmark className="text-[26px]" tone="light" /> : <span className="t-h4 !text-[22px]">{c}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.rows.map((r) => (
                  <tr key={r.label} className="border-b border-ash last:border-0">
                    <th scope="row" className="p-5 align-top text-[12px] font-normal uppercase text-smoke">
                      {r.label}
                    </th>
                    {r.cells.map((c, i) => (
                      <td
                        key={i}
                        className={`p-5 align-top leading-[1.4] ${i === 0 ? "bg-[#fdeee4] text-navy" : c.startsWith("Not disclosed") ? "text-smoke" : "text-graphite"}`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceNote className="mt-4 max-w-[1100px]">
            ClickPost NDR Management and Parth (Angel One); Shipsy NDR guide and last-mile page; AfterShip exception agent;
            Ringg AI failed-delivery recovery; Shiprocket contact-buyer docs; GHTK scheduled delivery. Vendor figures are
            self-reported. “Not disclosed” means we found nothing on the official pages as of October 2026.
          </SourceNote>
        </Reveal>
      </div>
    </section>
  );
}

function ArrowDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path d="M11 3v15M4.5 11.5L11 18l6.5-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <RevealText text="Frequently Asked Questions" className="t-h1" />
        <div className="mt-12">
          {FAQ.map((f, i) => (
            <div key={f.q} className="border-b border-ash">
              <button className="flex w-full items-center justify-between gap-6 px-0 py-10 text-left md:px-10" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="t-h3">{f.q}</span>
                <motion.span animate={{ rotate: open === i ? 180 : 0 }} className="text-navy">
                  <ArrowDown />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                    <p className="max-w-[860px] px-0 pb-10 text-[18px] leading-[1.45] text-graphite md:px-10">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden py-28 md:py-40">
      <div className="wash left-1/2 top-1/2 h-[460px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-60" style={{ background: "radial-gradient(ellipse, rgba(255,148,115,0.75), rgba(160,181,235,0.45) 55%, transparent 75%)" }} />
      <div className="container-page relative text-center">
          <RevealText text="Make the second drop land." className="t-display mx-auto max-w-[900px]" stagger={0.07} />
          <Reveal delay={0.2}>
          <p className="mx-auto mt-8 max-w-[600px] text-[20px] leading-[1.35] text-graphite">
            One courier tap, one well-timed conversation, one context card for the next attempt.
          </p>
          <div className="mt-11 flex flex-wrap justify-center gap-4">
            <Link href="/demo" className="btn btn-dark">
              Watch the demo
            </Link>
            <Link href="/console" className="btn btn-primary">
              Open dashboard <Chevron />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Sources() {
  return (
    <section id="sources" className="scroll-mt-28 border-t border-ash py-20">
      <div className="container-page">
        <div className="t-eyebrow">Sources</div>
        <ul className="mt-8 grid gap-x-12 gap-y-4 md:grid-cols-2">
          {SOURCES.map((s) => (
            <li key={s.url} className="t-body-sans text-[14px] leading-[1.5]">
              <a href={s.url} target="_blank" rel="noreferrer" className="text-navy underline decoration-ash underline-offset-4 hover:decoration-orange">
                {s.label}
              </a>
              <span className="text-smoke"> — {s.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  const cols = [
    { h: "Project", l: [["Problem", "/#problem"], ["Approach", "/#approach"], ["Product", "/#how-it-works"], ["Competitors", "/#competitors"]] },
    { h: "Demo", l: [["Demo stage", "/demo"], ["Dashboard", "/console"], ["Metrics", "/metrics"], ["Script", "/script"]] },
    { h: "Team", l: [["Develarper", "/#team"], ["FAQ", "/#faq"], ["Sources", "/#sources"]] },
  ];
  return (
    <footer className="border-t border-ash">
      <div className="container-page grid gap-10 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <LogoLink />
          <p className="mt-5 max-w-[360px] text-[14px] leading-[1.45] text-smoke">Failed-delivery rescue for Vietnamese e-commerce. MVP demo on mock data.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <div className="text-[14px] uppercase text-smoke">{c.h}</div>
            <ul className="mt-5 space-y-3 text-[16px]">
              {c.l.map(([t, h]) => (
                <li key={h}>
                  <Link href={h} className="hover:text-orange-deep">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-page flex flex-wrap justify-between gap-4 border-t border-ash py-6 text-[13px] text-smoke">
        <span>© 2026 Team Develarper. All rights reserved.</span>
        <span>Demo data is simulated.</span>
      </div>
    </footer>
  );
}
