"use client";

import { motion } from "motion/react";
import Link from "next/link";
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

/* eslint-disable @next/next/no-img-element */
export function DemoGate() {
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
          <Link href="/tour" className="gate-choice gate-choice-dark">
            <span className="gate-icon">
              <Mark kind="wave" size={28} ring="#fff" className="text-white" />
            </span>
            <b>Watch the demo</b>
          </Link>
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
    </main>
  );
}
