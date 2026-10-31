"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { CountUp, IterLine, Legend, PairedBars } from "./charts";
import { DashShell } from "./shell";

// Mock numbers for the draft. Replace with real eval output (per-field F1 script).
const FIELDS = [
  { k: "Window", a: 0.71, b: 0.93 },
  { k: "Drop-off", a: 0.58, b: 0.89 },
  { k: "Alt. receiver", a: 0.64, b: 0.91 },
  { k: "Address fix", a: 0.42, b: 0.82 },
];
const ITER = [
  { v: "v0", dev: 0.61, held: 0.59 },
  { v: "v1", dev: 0.72, held: 0.68 },
  { v: "v2", dev: 0.79, held: 0.75 },
  { v: "v3", dev: 0.85, held: 0.81 },
  { v: "v4", dev: 0.89, held: 0.86 },
  { v: "v5", dev: 0.91, held: 0.88 },
  { v: "v6", dev: 0.92, held: 0.88 },
];
const TOP = [
  { label: "Time-to-context", value: "4 s", badge: "p90 9 s", tone: "d-chip-good" },
  { label: "Extraction F1", value: "0.88", badge: "held-out", tone: "d-chip-primary" },
  { label: "Safe autonomy", value: "64%", badge: "1.8% error", tone: "d-chip-good" },
  { label: "Boundary breaches", value: "0", badge: "target 0", tone: "d-chip-good" },
];
const SAFE = [
  { l: "Cases handled by the agent alone", v: "64%", t: "good" },
  { l: "Error rate inside that group", v: "1.8%", t: "warn" },
  { l: "Routed to review on low confidence", v: "22%", t: "neutral" },
  { l: "High-stakes actions without approval", v: "0", t: "good" },
  { l: "Calls outside 08:00–20:30", v: "0", t: "good" },
  { l: "Contact after the buyer said “stop”", v: "0", t: "good" },
];

function Card({ title, sub, tag, children, className = "" }: { title: string; sub?: string; tag: "Measured" | "Projected"; children: React.ReactNode; className?: string }) {
  return (
    <section className={`d-card p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="d-title text-[24px]">{title}</h2>
          {sub && <p className="mt-1 text-[14px] d-muted">{sub}</p>}
        </div>
        <span className={`d-chip ${tag === "Measured" ? "d-chip-good" : "d-chip-warn"}`}>{tag}</span>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Slider({ label, value, set, min, max, step, fmt }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string }) {
  return (
    <label className="block">
      <div className="flex justify-between text-[14px]">
        <span className="d-text2">{label}</span>
        <span className="font-semibold tabular-nums">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="mt-2 w-full accent-[var(--d-primary)]" />
    </label>
  );
}

// One area, one month, following the team cost model (PRD §18.8). Defaults reproduce the best-in-class headline.
function Money() {
  const [orders, setOrders] = useState(4000);
  const [failRate, setFailRate] = useState(8);
  const [uplift, setUplift] = useState(40);
  const [auto, setAuto] = useState(65);
  const [running, setRunning] = useState(27.3);
  const failed = orders * (failRate / 100);
  const fee = failed * (uplift / 100) * 40000 * 30;
  const redelivery = failed * (uplift / 100) * 0.75 * 7000 * 30;
  const door = (failed / 320) * (uplift / 40) * 11.8e6;
  const csHours = (failed * (auto / 100) * 2 * 4 * 30) / 60;
  const csSave = csHours * 35000;
  const cost = running * 1e6;
  const net = fee + redelivery + door + csSave - cost;
  const m = (n: number) => `₫${(n / 1e6).toFixed(1)}M`;
  const rows: [string, string][] = [
    ["Return fees avoided", `+${m(fee)}`],
    ["Redelivery attempts avoided", `+${m(redelivery)}`],
    ["Courier door time saved", `+${m(door)}`],
    [`CS calls by the agent (${csHours.toFixed(0)} h)`, `+${m(csSave)}`],
    ["Running cost", `−${m(cost)}`],
  ];
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-5">
        <Slider label="Orders per day (one area, 20 couriers)" value={orders} set={setOrders} min={1000} max={12000} step={500} fmt={(n) => n.toLocaleString("en-US")} />
        <Slider label="First-attempt failure rate" value={failRate} set={setFailRate} min={4} max={20} step={1} fmt={(n) => `${n}%`} />
        <Slider label="Extra rescue over today’s 25% (assumed)" value={uplift} set={setUplift} min={0} max={40} step={5} fmt={(n) => `${n} pts`} />
        <Slider label="Cases handled by the agent" value={auto} set={setAuto} min={20} max={90} step={5} fmt={(n) => `${n}%`} />
        <Slider label="Running cost a month" value={running} set={setRunning} min={5} max={70} step={0.1} fmt={(n) => `₫${n.toFixed(1)}M`} />
      </div>
      <div className="flex flex-col justify-between rounded-xl bg-[var(--d-tint)] p-6">
        <div>
          <div className="d-overline">Net saving a month, one area</div>
          <motion.div key={Math.round(net / 1e6)} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="d-num mt-2 text-[56px] leading-none" style={{ color: net < 0 ? "var(--d-bad)" : undefined }}>
            {m(net)}
          </motion.div>
          <div className="mt-2 text-[13px] d-muted">{((net / 473e6) * 100).toFixed(0)}% of the ₫473M monthly loss</div>
        </div>
        <dl className="mt-6 space-y-2 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="d-text2">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-[12px] leading-[1.5] d-muted">
          ₫40,000 return fee per Shopee policy; ₫7,000 courier pay per attempt (GHN); 2 calls × 4 min at ₫35,000 per CS hour and the running cost are team estimates. Defaults are the best-in-class case (25% → 65%, Shipsy vendor range). Projected, not measured.
        </p>
      </div>
    </div>
  );
}

export function MetricsDash() {
  return (
    <DashShell>
      <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="d-title text-[40px] leading-[1.1] md:text-[52px]">Rescue Metrics</h1>
            <p className="mt-2 text-[16px] d-text2">Four output metrics, one for each problem number. Eval set v6.</p>
          </div>
          <span className="d-chip d-chip-warn">Draft · mock numbers until the real eval runs</span>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TOP.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="d-tint p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[14px] d-text2">{k.label}</span>
                <span className={`d-chip ${k.tone}`}>{k.badge}</span>
              </div>
              <div className="d-num mt-3 text-[44px] leading-none">
                <CountUp value={k.value} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card title="Extraction Accuracy" sub="Per-field F1, 260 hand-written samples, 30% held out" tag="Measured">
            <Legend items={[{ label: "Baseline v0", color: "c2" }, { label: "After Codex loop (v6)", color: "c1" }]} />
            <div className="mt-5">
              <PairedBars rows={FIELDS} />
            </div>
          </Card>
          <Card title="Optimisation Curve" sub="One prompt or schema change per round; stop when held-out stalls" tag="Measured">
            <Legend items={[{ label: "Dev set", color: "c2" }, { label: "Held-out", color: "c1" }]} />
            <div className="mt-4">
              <IterLine rows={ITER} />
            </div>
          </Card>
          <Card title="Time-to-Context" sub="From the buyer’s answer to the card appearing" tag="Measured">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Chat", "4 s", "p90 9 s"],
                ["AI call", "6 s", "after hang-up"],
                ["Voice memo", "11 s", "incl. ASR"],
              ].map(([k, v, s]) => (
                <div key={k} className="rounded-xl border border-[var(--d-border)] p-4">
                  <div className="d-overline">{k}</div>
                  <div className="d-num mt-2 text-[32px] leading-none">{v}</div>
                  <div className="mt-2 text-[12px] d-muted">{s}</div>
                </div>
              ))}
            </div>
            <table className="mt-6 w-full text-[14px]">
              <thead>
                <tr>
                  <th className="pb-2 text-left d-overline">Source</th>
                  <th className="pb-2 text-left d-overline">Samples</th>
                  <th className="pb-2 text-right d-overline">F1</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Chat", 120, 0.94],
                  ["Call transcript", 80, 0.88],
                  ["Voice memo", 60, 0.86],
                ].map(([k, n, f]) => (
                  <tr key={k as string} className="border-t border-[var(--d-border)]">
                    <td className="py-2.5">{k}</td>
                    <td className="py-2.5 d-muted">{n}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{(f as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Safe Autonomy" sub="Every action in the eval, and who decided it" tag="Measured">
            <ul>
              {SAFE.map((r) => (
                <li key={r.l} className="flex items-center justify-between border-b border-[var(--d-border)] py-3 last:border-0">
                  <span className="flex items-center gap-2.5 text-[14px]">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: r.t === "good" ? "var(--d-good)" : r.t === "warn" ? "var(--d-warn)" : "var(--d-muted)" }}
                      aria-hidden
                    />
                    {r.l}
                  </span>
                  <span className="d-num text-[26px] leading-none">{r.v}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Money" sub="One area, one month. Projected from the team cost model until the pilot measures the real rescue rate." tag="Projected" className="mt-4">
          <Money />
        </Card>
      </div>
    </DashShell>
  );
}
