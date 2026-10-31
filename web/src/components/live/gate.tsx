"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Mark, Wordmark } from "@/components/site/brand";

// The welcome screen in front of the demos: the cast gathers around the mark, and you choose how to run it.
// People: "Notionists" by Zoish (CC0), rendered to web/public/people with DiceBear.

const EASE = [0.22, 1, 0.36, 1] as const;

const CAST = [
  { id: "shipper", name: "Shipper" },
  { id: "buyer", name: "Buyer" },
  { id: "seller", name: "Seller" },
  { id: "next", name: "Next shipper" },
  { id: "cs", name: "Customer service" },
  { id: "ops", name: "Hub ops" },
];

type Iris = { x: number; y: number; r: number; color: string };

export function DemoGate() {
  const router = useRouter();
  const [iris, setIris] = useState<Iris | null>(null);

  const go = (e: MouseEvent<HTMLButtonElement>, color: string, href: string) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || b.left + b.width / 2;
    const y = e.clientY || b.top + b.height / 2;
    setIris({ x, y, color, r: Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 4 });
    router.prefetch(href);
    window.setTimeout(() => router.push(href), 520);
  };

  return (
    <main className="gate">
      <div className="gate-stage" aria-hidden>
        {CAST.map((p, i) => {
          const a = ((-150 + (i * 360) / CAST.length) * Math.PI) / 180;
          return (
            <motion.div
              key={p.id}
              className="gate-person"
              style={{ left: `${50 + 44 * Math.cos(a)}%`, top: `${50 + 42 * Math.sin(a)}%` }}
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={iris ? { opacity: 0, scale: 0.8, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              transition={iris ? { duration: 0.3 } : { type: "spring", stiffness: 260, damping: 18, delay: 0.4 + i * 0.07 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/people/${p.id}.svg`} alt="" width={84} height={84} />
              <span>{p.name}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="gate-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
          <Wordmark className="text-[44px]" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
          Welcome. <em>Pick a demo.</em>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.35 }}>
          One failed delivery, one tap, one second drop.
        </motion.p>

        <div className="gate-choices">
          <motion.button
            className="gate-choice gate-choice-dark"
            onClick={(e) => go(e, "#1f2a44", "/live")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.5 }}
          >
            <span className="gate-icon">
              <Mark kind="wave" size={28} ring="#fff" className="text-white" />
            </span>
            <b>Live demo</b>
          </motion.button>
          <motion.button
            className="gate-choice"
            onClick={(e) => go(e, "#ffe6d6", "/demo")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.6 }}
          >
            <span className="gate-faces">
              {/* eslint-disable @next/next/no-img-element */}
              <img src="/people/shipper.svg" alt="" width={32} height={32} />
              <img src="/people/buyer.svg" alt="" width={32} height={32} />
              <img src="/people/cs.svg" alt="" width={32} height={32} />
              {/* eslint-enable @next/next/no-img-element */}
            </span>
            <b>Judges demo</b>
          </motion.button>
        </div>
      </div>

      {iris && (
        <div
          className="gate-iris"
          style={{ left: iris.x - iris.r, top: iris.y - iris.r, width: iris.r * 2, height: iris.r * 2, background: iris.color }}
        />
      )}
    </main>
  );
}
