"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Mark, Wordmark } from "@/components/site/brand";

// The welcome screen in front of the demos: the cast gathers around the mark, and you choose how to run it.
// People: "Notionists" by Zoish (CC0), rendered to web/public/people with DiceBear.

// In the order a rescue moves through them.
const CAST = [
  { id: "shipper", name: "Shipper" },
  { id: "buyer", name: "Buyer" },
  { id: "cs", name: "Customer service" },
  { id: "ops", name: "Hub ops" },
  { id: "next", name: "Next shipper" },
  { id: "seller", name: "Seller" },
];

// The live demo runs on the team's machine during the pitch. Set NEXT_PUBLIC_LIVE_READY=1 there to open /live directly;
// everywhere else the button points people to the stage.
const LIVE_READY = process.env.NEXT_PUBLIC_LIVE_READY === "1";

/* eslint-disable @next/next/no-img-element */
export function DemoGate() {
  const [lookUp, setLookUp] = useState(false);
  const liveClass = "gate-choice gate-choice-dark";
  const liveInner = (
    <>
      <span className="gate-icon">
        <Mark kind="wave" size={28} ring="#fff" className="text-white" />
      </span>
      <b>Live demo</b>
    </>
  );
  return (
    <main className="gate">
      <div className="gate-center">
        <Wordmark className="text-[40px]" />
        <h1>
          Welcome.<br />
          <em>Pick a demo.</em>
        </h1>
        <p>One failed delivery, one tap, one second drop.</p>

        <div className="gate-choices">
          {LIVE_READY ? (
            <Link href="/live" className={liveClass}>
              {liveInner}
            </Link>
          ) : (
            <button type="button" className={liveClass} onClick={() => setLookUp(true)}>
              {liveInner}
            </button>
          )}
          <Link href="/demo" className="gate-choice">
            <span className="gate-faces">
              <img src="/people/shipper.svg" alt="" width={32} height={32} />
              <img src="/people/buyer.svg" alt="" width={32} height={32} />
              <img src="/people/cs.svg" alt="" width={32} height={32} />
            </span>
            <b>Judges demo</b>
          </Link>
        </div>
      </div>

      <div className="gate-line" aria-hidden>
        <motion.i className="gate-rail" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
        <i className="gate-dot" />
        {CAST.map((p, i) => (
          <motion.div
            key={p.id}
            className="gate-person"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.07 }}
          >
            <img src={`/people/${p.id}.svg`} alt="" width={84} height={84} />
            <span>{p.name}</span>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {lookUp && (
          <motion.div className="sorry-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLookUp(false)}>
            <motion.div
              className="sorry"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sorry-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
            >
              <motion.img src="/people/shipper-joy.svg" alt="" width={96} height={96} className="sorry-face" initial={{ rotate: -8, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }} />
              <h2 id="sorry-title">
                Look up. <em>It’s happening on stage.</em>
              </h2>
              <p>The live demo runs during our pitch: a real phone in the shipper’s hand, synced with the customer’s phone, the hub dashboard and the agent on the big screen.</p>
              <p>It needs our backend and phone on site, so it doesn’t run on this website. Want to try the rescue yourself? The judges’ demo is one click away.</p>
              <div className="sorry-actions">
                <Link href="/demo" className="gate-choice gate-choice-dark sorry-go">
                  <b>Open the judges’ demo →</b>
                </Link>
              </div>
              <button type="button" className="sorry-close" aria-label="Close" onClick={() => setLookUp(false)}>
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
