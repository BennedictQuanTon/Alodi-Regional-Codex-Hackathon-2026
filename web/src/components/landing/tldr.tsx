"use client";

import { motion } from "motion/react";
import { TLDR } from "@/lib/content";
import { Figure } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The whole pitch in four cells, right under the hero. */
export function Tldr() {
  return (
    <section id="tldr" className="pb-4 pt-6">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative overflow-hidden rounded-[24px] bg-ink text-parchment"
        >
          <div className="wash -right-24 -top-32 h-80 w-[420px] opacity-35" style={{ background: "radial-gradient(circle, rgba(240,90,0,0.9), transparent 70%)" }} />
          <div className="relative grid md:grid-cols-[120px_1fr]">
            <div className="flex items-center border-b border-white/10 px-7 py-5 md:border-b-0 md:border-r">
              <span className="text-[13px] font-medium tracking-[0.08em] text-orange">TL;DR</span>
            </div>
            <ol className="grid sm:grid-cols-2 xl:grid-cols-4">
              {TLDR.map((t, i) => (
                <motion.li
                  key={t.k}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: EASE }}
                  className={`px-7 py-6 ${i > 0 ? "border-t border-white/10 sm:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "sm:border-t xl:border-t-0" : ""} ${i > 0 ? "xl:border-l" : ""} border-white/10`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-parchment/45">{t.k}</div>
                  <div className={`t-number mt-3 text-[40px] leading-none ${i === 3 ? "text-orange" : ""}`}>
                    <Figure value={t.value} />
                  </div>
                  <p className="mt-3 max-w-[240px] text-[14px] leading-[1.4] text-parchment/70">{t.line}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
