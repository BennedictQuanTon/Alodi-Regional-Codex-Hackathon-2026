"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Mark } from "@/components/site/brand";

// The first and last thing the narrated demo shows. The "o" of the logo is the play button: it is already a call.
// People: "Notionists" by Zoish (CC0), web/public/people.

const EASE = [0.22, 1, 0.36, 1] as const;

const CAST = {
  start: [
    { face: "shipper", name: "Shipper" },
    { face: "buyer", name: "Buyer" },
    { face: "ops", name: "Hub ops" },
    { face: "next", name: "Next shipper" },
  ],
  end: [
    { face: "shipper-joy", name: "Shipper" },
    { face: "buyer-joy", name: "Buyer" },
    { face: "ops", name: "Hub ops" },
    { face: "next-joy", name: "Next shipper" },
  ],
};

const RECAP = [
  { mark: "wave", title: "One tap", text: "The shipper moves on" },
  { mark: "square", title: "When, where, who", text: "One card for the next shipper" },
  { mark: "check", title: "Delivered", text: "On the second attempt" },
] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE, delay },
});

/* eslint-disable @next/next/no-img-element */
export function TourCover({ mode, onPlay }: { mode: "start" | "end"; onPlay: () => void }) {
  const end = mode === "end";
  return (
    <motion.div
      className="tc"
      initial={end ? { clipPath: "circle(0% at 50% 34%)" } : false}
      animate={{ clipPath: "circle(150% at 50% 34%)" }}
      exit={{ clipPath: "circle(0% at 50% 34%)" }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="tc-center">
        <motion.div className="tc-logo" {...rise(0.05)}>
          <span>al</span>
          <button className="tc-play" onClick={onPlay} aria-label={end ? "Watch again" : "Start with sound"} tabIndex={-1}>
            <i className="tc-halo" />
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="8.6" fill="none" stroke="#f05a00" strokeWidth="5.2" />
              <rect className="tc-bar" x="8.55" y="10.25" width="1.5" height="3.5" rx="0.75" />
              <rect className="tc-bar" x="11.25" y="8.9" width="1.5" height="6.2" rx="0.75" />
              <rect className="tc-bar" x="13.95" y="10.25" width="1.5" height="3.5" rx="0.75" />
            </svg>
          </button>
          <span>di</span>
        </motion.div>

        <motion.h1 {...rise(0.15)}>
          {end ? <>Make the second <em>drop land.</em></> : <>One missed call. <em>One rescue.</em></>}
        </motion.h1>

        {end ? (
          <motion.ul className="tc-recap" {...rise(0.25)}>
            {RECAP.map((r) => (
              <li key={r.title}>
                <Mark kind={r.mark} size={30} ring="#f05a00" />
                <b>{r.title}</b>
                <span>{r.text}</span>
              </li>
            ))}
          </motion.ul>
        ) : (
          <motion.p {...rise(0.25)}>Follow one failed delivery, from the doorstep to the second drop.</motion.p>
        )}

        <motion.div className="tc-actions" {...rise(0.35)}>
          <button className="tc-cta" onClick={onPlay}>
            {end ? "Watch again" : "Start with sound"}
          </button>
          {end && <Link href="/demo" className="tc-cta tc-cta-line">Try it yourself</Link>}
        </motion.div>
        {!end && <motion.small {...rise(0.42)}>About 2 minutes · Sound on</motion.small>}
      </div>

      <div className="tc-foot">
        <div className="tc-line" aria-hidden>
          <motion.i className="tc-rail" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.3 }} />
          <i className="tc-dot" />
          {CAST[mode].map((p, i) => (
            <motion.div key={p.name} className="tc-person" {...rise(0.35 + i * 0.07)}>
              <img src={`/people/${p.face}.svg`} alt="" width={64} height={64} />
              <span>{p.name}</span>
            </motion.div>
          ))}
        </div>
        <p>A scripted example with fictional data and synthesized voices.</p>
      </div>
    </motion.div>
  );
}
