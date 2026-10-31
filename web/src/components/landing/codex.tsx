"use client";

import { motion } from "motion/react";
import { TechIcon } from "@/components/site/logos";
import { Reveal, RevealText } from "./motion";

// High-level map of where the Codex ecosystem fits in Alodi's lifecycle. The 31 Oct demo uses part of it;
// keep the copy at this level and never present a stage as a measured result.

const EASE = [0.22, 1, 0.36, 1] as const;

const STAGES = [
  {
    k: "01",
    stage: "Specify",
    surface: "ChatGPT + Codex",
    body: "PRD, use cases and business rules written once, then turned into code: the mock hub generator and the cost model are scripts, not slides.",
    out: "PRD.md · generate.py · cost_model.py",
  },
  {
    k: "02",
    stage: "Build",
    surface: "Codex CLI · IDE extension",
    body: "Pair-programming inside the repo. AGENTS.md and the project rules travel with every task: fonts, colours, English copy, no citation markers.",
    out: "web/ · scenario engine · dashboard",
  },
  {
    k: "03",
    stage: "Parallelise",
    surface: "Codex cloud tasks",
    body: "Independent jobs run in their own sandboxes at the same time: charts, film capture scripts, screenshots, data exports. Each returns a diff to review.",
    out: "one task → one branch → one PR",
  },
  {
    k: "04",
    stage: "Review",
    surface: "Codex in GitHub",
    body: "Every pull request gets a Codex review next to lint and build in CI. People still merge.",
    out: "PR review · GitHub Actions",
  },
  {
    k: "05",
    stage: "Evaluate",
    surface: "Codex eval loop",
    body: "One prompt or schema change per round against a held-out set of chat, call and memo samples. Keep the best by per-field F1 and safe autonomy.",
    out: "eval-starter.jsonl · 47 samples",
  },
  {
    k: "06",
    stage: "Run",
    surface: "OpenAI platform",
    body: "Tool calling and Structured Outputs drive the agent today. In production gpt-oss-20b runs on the area server; the API is a masked fallback.",
    out: "tool calling · strict JSON · TTS",
  },
];

export function CodexEcosystem() {
  return (
    <section id="codex" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <Reveal>
              <div className="t-eyebrow flex items-center gap-3">
                <TechIcon icon="siOpenai" size={16} mono /> Codex ecosystem
              </div>
            </Reveal>
            <RevealText text="Codex from the spec to the running agent." className="t-h1 mt-6 max-w-[760px]" stagger={0.035} />
          </div>
          <Reveal delay={0.1}>
            <p className="text-[18px] leading-[1.4] text-graphite">
              One loop, six stages. A person sets the goal and approves the result at every stage; Codex does the typing,
              the parallel work and the checking.
            </p>
          </Reveal>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-[16px] border border-ash bg-ash md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((s, i) => (
            <motion.li
              key={s.k}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.06, ease: EASE }}
              className="group flex flex-col bg-paper p-7 transition-colors duration-300 hover:bg-parchment"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-orange-deep">{s.k}</span>
                <span className="text-[11px] uppercase text-smoke">{s.surface}</span>
              </div>
              <h3 className="t-h3 mt-6">{s.stage}</h3>
              <p className="t-body-sans mt-3 flex-1 text-[15px] leading-[1.45] text-graphite">{s.body}</p>
              <div className="mt-6 border-t border-ash pt-3 text-[12px] text-navy">{s.out}</div>
            </motion.li>
          ))}
        </ol>

        <Reveal className="mt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase text-smoke">
            <span className="text-navy">Human in the loop at every stage</span>
            <span>→ goal</span>
            <span>→ Codex task</span>
            <span>→ diff / eval</span>
            <span>→ person approves</span>
            <span>→ merge</span>
          </div>
          <p className="mt-3 text-[12px] leading-[1.45] text-smoke">
            A high-level map. The 31 October demo uses part of it; the rest is how the team runs the pilot.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
