"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/site/brand";
import { LIVE_DEMO_URL } from "@/lib/content";

// The welcome screen in front of the demos: the cast gathers around the mark, and you choose how to run it.
// People: "Notionists" by Zoish (CC0), rendered to web/public/people with DiceBear.

const CAST = [
  { id: "shipper", name: "Shipper" },
  { id: "buyer", name: "Buyer" },
  { id: "seller", name: "Seller" },
  { id: "next", name: "Next shipper" },
  { id: "cs", name: "Customer service" },
  { id: "ops", name: "Hub ops" },
];

/* eslint-disable @next/next/no-img-element */
export function DemoGate() {
  return (
    <main className="gate">
      <div className="gate-stage" aria-hidden>
        {CAST.map((p, i) => {
          const a = ((-150 + (i * 360) / CAST.length) * Math.PI) / 180;
          return (
            <motion.div
              key={p.id}
              className="gate-person"
              style={{ left: `${(50 + 44 * Math.cos(a)).toFixed(3)}%`, top: `${(50 + 42 * Math.sin(a)).toFixed(3)}%` }}
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.05 + i * 0.05 }}
            >
              <img src={`/people/${p.id}.svg`} alt="" width={84} height={84} />
              <span>{p.name}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="gate-center">
        <Wordmark className="text-[44px]" />
        <h1>
          Welcome. <em>Pick a demo.</em>
        </h1>
        <p>One failed delivery, one tap, one second drop.</p>

        <div className="gate-choices">
<a href={LIVE_DEMO_URL} className="gate-choice gate-choice-dark">
            <span className="gate-icon">
              <Mark kind="wave" size={28} ring="#fff" className="text-white" />
            </span>
            <b>Live demo</b>
          </a>
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
    </main>
  );
}
