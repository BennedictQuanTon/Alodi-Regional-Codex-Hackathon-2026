"""Build the Alodi project report (HTML → PDF) in the same design as the numbers proof.

Usage (from the repo root):
    python3 -I prep/02-technical/report/build_report.py
Writes prep/02-technical/report/alodi-report.pdf and copies it to web/public/alodi-report.pdf.
Every money figure is computed by cost_model.py; the simulated day comes from mock-data; survey values
are read from prep/06-survey and labelled by their data_status.
"""
import csv
import html
import importlib.util
import json
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location("cost_model", ROOT / "prep/02-technical/cost-model/cost_model.py")
cm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cm)

R = cm.run()
L = R["loss"]
MID = R["loss_mid"]
ROWS = {(r["setup"], r["messaging"], r["scenario"]): r for r in R["rows"]}
BEST = ROWS[("local_first", "risky_only", "best_in_class")]
BASE = ROWS[("local_first", "risky_only", "base")]
CONS = ROWS[("local_first", "risky_only", "conservative")]
DAY = json.loads((ROOT / "prep/02-technical/mock-data/expected-day-summary.json").read_text())
DOOR = L["items"]["Courier time lost when the buyer doesn't answer"]


def m(v, d=0):
    return f"₫{v / 1e6:,.{d}f}M"


def e(s):
    return html.escape(str(s))


def rows_csv(p):
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


couriers = rows_csv(ROOT / "prep/06-survey/couriers.csv")
customers = rows_csv(ROOT / "prep/06-survey/customers.csv")
summary = {(r["audience"], r["metric"]): r["value"] for r in rows_csv(ROOT / "prep/06-survey/summary_MOCK.csv")}
status = Counter(r["data_status"] for r in couriers + customers)
companies = Counter(r["company"] for r in couriers)
placeholder = status.get("REAL", 0) == 0

LOGO = (ROOT / "prep/04-brand/logo/alodi-wordmark-navy.svg").read_text()
LOGO_W = (ROOT / "prep/04-brand/logo/alodi-wordmark-white.svg").read_text()
IMG = lambda p: (ROOT / p).as_uri()
FONTS = {"Geist": ROOT / "prep/01-pitch/charts/fonts/Geist.ttf", "Be Vietnam Pro": ROOT / "prep/04-brand/fonts/BeVietnamPro-ExtraBold.ttf"}
font_css = "\n".join(f"@font-face {{ font-family: '{k}'; src: url('{v.as_uri()}'); }}" for k, v in FONTS.items())


def table(head, rows, cls=""):
    th = "".join(f"<th{' class=r' if h.startswith('~') else ''}>{e(h.lstrip('~'))}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td{' class=r' if head[i].startswith('~') else ''}>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def chapter(n, title, lead, body):
    return f'<section class="ch"><div class="eyebrow">{n:02d}</div><h2>{e(title)}</h2><p class="lead">{lead}</p>{body}</section>'


def stats(items, dark=False):
    cells = "".join(f'<div><b>{v}</b><span>{l}</span><i>{s}</i></div>' for v, l, s in items)
    return f'<div class="stats{" dark" if dark else ""}">{cells}</div>'


# ---------------------------------------------------------------- chapters
fa = DAY["failed_first_attempt"]

cover = f"""
<section class="cover">
  <div class="ctop"><span class="logo">{LOGO_W}</span><span>Team Develarper · Sea × OpenAI Regional Codex Hackathon · 31 Oct 2026</span></div>
  <div class="cmid">
    <div class="eyebrow o">Project report</div>
    <h1>Make the second<br>drop land.</h1>
    <p>Alodi is an AI agent that rescues failed deliveries for Vietnamese e-commerce. This report covers the problem,
    the product, the architecture, the OpenAI stack, the evaluation plan, the economics and the road to a pilot.
    Every figure carries its source and its status.</p>
  </div>
  <div class="cgrid">
    <div><b>{m(MID)}</b><span>lost a month in one area today · modelled</span></div>
    <div><b>1 tap</b><span>from the courier starts a rescue</span></div>
    <div><b>0</b><span>high-stakes actions without a person</span></div>
    <div class="hi"><b>{m(BEST['net_month'])}</b><span>net saving a month, {BEST['net_pct']:.0%} · projected</span></div>
  </div>
</section>"""

contents = """
<section class="ch toc"><div class="eyebrow">Contents</div><h2>In this report</h2>
<ol>
<li>Executive summary</li><li>The problem</li><li>What we heard: the survey</li><li>Alodi</li><li>The product</li>
<li>Architecture</li><li>OpenAI at the core</li><li>Data, privacy and rules</li><li>Evaluation and outcomes</li>
<li>Economics</li><li>Competitive landscape</li><li>Roadmap</li><li>Risks and assumptions</li><li>Team</li><li>Sources and verification</li>
</ol>
<p class="note">Status labels used throughout: <b>Sourced</b> public document · <b>Vendor</b> company claim · <b>Estimate</b> team assumption ·
<b>Modelled</b> sourced numbers combined with stated assumptions · <b>Projected</b> not yet measured · <b>Simulated</b> fictional mock data.</p>
</section>"""

c1 = chapter(1, "Executive summary", "A failed delivery is a time negotiation that happens off the system. Alodi brings it back in.", f"""
<div class="two">
<div><h3>The problem</h3><p>Sellers pay up to ₫40,000 in return shipping for every failed Shopee order, 8–12% of orders are refused at the door,
and buyers still cannot choose a delivery window. When a courier can’t reach a buyer, the context that would fix the next attempt is compressed into one
error code. For one area of 20 couriers and 4,000 orders a day, that costs about {m(MID)} a month (modelled).</p></div>
<div><h3>The answer</h3><p>The courier taps one button: No answer, Rescheduled or Refused. Alodi messages the buyer at once, calls if there is silence
(60 minutes, then 2 hours, only 08:00–20:30), turns the answer into structured context with a confidence score per field, and hands the next courier a card
with when, where and who. Refusals, labels and returns always go to a person.</p></div>
</div>
{stats([("< 10 s", "time-to-context target", "measured on stage"), ("≥ 0.90", "extraction F1 target", "held-out set"), ("416", "CS calls a day handled by the agent", "projected"), (m(BEST['net_month']), "net saving a month", f"{BEST['net_pct']:.0%} of the loss · projected")])}
""")

c2 = chapter(2, "The problem", "Nothing is broken in the route. The context dies in a phone call.", f"""
<div class="two w">
<div>
{stats([("₫40,000", "return fee the seller pays per failed order", "Shopee §7.1; cap since 1 Apr 2025, GHN · Sourced"), ("8–12%", "of orders refused at the door, nationwide", "VECOM, Nguoi Lao Dong 19 Jul 2025 · Sourced"), ("0", "delivery windows a Shopee buyer can choose", "Shopee Help Center 79559 · Sourced"), ("3 in 90 days", "failed COD orders before COD is switched off", "Shopee Help Center 79196 · Sourced")])}
<h3>Why it persists</h3>
<ul>
<li><b>Time is negotiated off the system.</b> Shopee does not support choosing a delivery time, so buyer and courier agree by phone.</li>
<li><b>One error code replaces the context.</b> “No answer” or “rescheduled” loses when, where and who; the second attempt repeats the first.</li>
<li><b>People don’t scale.</b> Phoning 320 failed buyers twice a day for four minutes takes about five full-time callers per area (estimate).</li>
<li><b>The frame is fixed.</b> Shopee allows 2–3 contact attempts and a reschedule within 5 days (Help Center 79569); anything that helps must fit inside it.</li>
</ul>
</div>
<figure class="photo"><img src="{IMG('web/public/photos/survey/spx-hub.webp')}"><figcaption>Field visit · SPX Express hub, Ho Chi Minh City</figcaption></figure>
</div>
<div class="keep"><h3>One area, one month</h3>
{table(["Loss item", "Formula", "~Per month", "Type"], [
 ["Return fees paid by sellers", "4,000 × 8% = 320 failed a day; 75% not rescued × ₫40,000 × 30", m(L['items']['Return fees paid by sellers'][0], 1), "Derived"],
 ["Courier pay for redelivery", "320 × 1.5 attempts × ₫6,000–8,000 × 30", f"{m(L['items']['Courier pay for redelivery attempts'][0], 1)}–{m(L['items']['Courier pay for redelivery attempts'][1], 1)}", "Derived"],
 ["Courier time at unanswered doors", "320 × 5 min × courier hourly cost × 30", f"{m(DOOR[0], 1)}–{m(DOOR[1], 1)}", "Modelled"],
 ["CS calling buyers back", "320 × 2 calls × 4 min × ₫35,000/h × 30", m(L['items']['Hub / CS staff calling buyers back'][0], 1), "Estimate"],
 ["<b>Total</b>", "midpoint of low and high", f"<b>{m(L['total'][0])}–{m(L['total'][1])} · ≈ {m(MID)}</b>", "Modelled"],
])}</div>
<p class="note">Not counted: the seller’s lost sale, packaging, ad spend, damaged goods. At VECOM’s 12% upper rate every line scales by 1.5×. Full derivation: alodi-numbers.pdf.</p>
""")

sv = lambda a, k: summary.get((a, k), "–")
c3 = chapter(3, "What we heard: the survey", "We asked both sides of the same missed call.", f"""
<div class="status{' warn' if placeholder else ''}"><b>Data status · {', '.join(f'{k} {v}' for k, v in status.items())}.</b>
{'The response files in the repository are still the generated placeholders (prep/06-survey, seed 30102026). The values below show what the survey measures and must be replaced by the interview export before they are quoted as findings.' if placeholder else 'Real interview responses.'}</div>
<div class="two">
<div><h3>Buyers · n = {len(customers)}</h3>
{table(["Question", "~Value"], [["Want to choose a delivery window", sv('customer', 'Want to choose a delivery window (agree or strongly agree)')], ["Called the courier back and couldn’t reach them", sv('customer', 'Called back and could not reach the courier, sometimes or more')], ["Courier called while busy, often or very often", sv('customer', 'Courier called while busy, often or very often')], ["Comfortable with an automated call", sv('customer', 'Comfortable with an automated call (agree or strongly agree)')], ["Would use an Alodi-like service: yes", sv('customer', 'Would use an Alodi-like service: Yes')]])}
</div>
<div><h3>Couriers · n = {len(couriers)}</h3>
{table(["Question", "~Value"], [["Calls to buyers a day (mean)", sv('courier', 'Mean calls to buyers per day')], ["Share of calls unanswered (mean %)", sv('courier', 'Mean unanswered call share (%)')], ["Buyers call while riding, often", sv('courier', 'Buyers call while riding, often or very often')], ["Would like an Alodi-like system: yes", sv('courier', 'Would like an Alodi-like system: Yes')], ["Minutes saved a day expected (mean)", sv('courier', 'Mean expected minutes saved per day (Yes answers)')]])}
<p class="note">Courier sample: {', '.join(f'{k} {v}' for k, v in companies.most_common())}.</p>
</div></div>
<p class="note">Instrument: 16 buyer and 15 courier questions in Vietnamese and English (prep/06-survey/codebook.csv). Personal data is dropped before saving (Vietnam PDPL).</p>
""")

c4 = chapter(4, "Alodi", "The AI agent that rescues failed deliveries. Autonomous where the rules are clear; human where they aren’t.", f"""
<h3>The flow, in eight steps</h3>
<ol class="steps8">
<li><b>Load orders and windows</b><span>every morning, per area</span></li>
<li><b>Ask for a window</b><span>≥ 2 options from the route planner</span></li>
<li><b>Note to the courier</b><span>no reply: deliver as planned</span></li>
<li><b>Deliver, tap the outcome</b><span>A / B / Refused, 2-minute undo</span></li>
<li><b>Flow A · no answer</b><span>chat → 60′ call → +2 h call → CS</span></li>
<li><b>Flow B · rescheduled</b><span>10 s memo → ASR → mask → JSON</span></li>
<li><b>Save the appointment</b><span>context card for the next attempt</span></li>
<li><b>CS decides</b><span>a person labels and returns</span></li>
</ol>
<h3>Hard rules (policy guard, in code)</h3>
{table(["Rule", "Value"], [["Call hours", "08:00–20:30 only; later calls move to the next morning"], ["Calls per cycle", "at most 2"], ["Redeliveries", "at most 2, inside Shopee’s 5-day frame"], ["Auto-apply", "only when every field has confidence ≥ 0.85; otherwise confirm in chat or send to CS"], ["Refused at the door", "no buyer contact; straight to CS"], ["Labels and returns", "suggested by the agent, approved by a person"], ["Opt-out", "“stop” ends all contact"], ["Recordings", "consent in the opening line; raw audio kept 30 days"]])}
""")

c5 = chapter(5, "The product", "Four screens, one agent, live on stage.", f"""
<figure class="shot"><img src="{IMG('prep/02-technical/report/img/app-demo.png')}"><figcaption>Demo stage: courier app, buyer chat and the operations panel, kept in sync on a fast-forward clock.</figcaption></figure>
<div class="two">
<div><h3>Built for the demo</h3><ul>
<li><b>Courier app</b> · one tap, voice memo, context card</li><li><b>Buyer channel</b> · chat with quick replies and the AI call</li>
<li><b>Ops console</b> · live case, extracted fields, audit trail, CS approval</li><li><b>Hub dashboard</b> · a simulated 4,000-order day: pipeline, failures by hour, policy guard, 20 routes, CS queue</li>
<li><b>Landing page</b> and <b>numbers proof</b> (alodi-numbers.pdf)</li></ul></div>
<figure class="shot s"><img src="{IMG('prep/02-technical/report/img/app-console.png')}"><figcaption>Hub dashboard on the simulated day.</figcaption></figure>
</div>
{stats([(f"{DAY['orders']:,}", "orders in the simulated day", "fixed seed · Simulated"), (str(fa['total']), f"failed first time · A {fa['A']} · B {fa['B']} · refused {fa['C']}", "Simulated"), (str(DAY['rescheduled_with_card']), "rescued with a context card", "Simulated"), (str(DAY['cs_queue']['total']), "handed to customer service", "Simulated")])}
""")

c6 = chapter(6, "Architecture", "An agent layer between the buyer and the carrier. It replaces nothing and fails open.", """
<div class="arch">
  <div class="col"><h4>Carrier + buyer</h4><div>Route planner · SPX</div><div>Order system · SPX</div><div>Courier tap</div><div>Buyer chat · Shopee / Zalo</div><div>AI call · SIP</div></div>
  <div class="core"><h4>alodi · agent layer</h4><div><b>Alodi Agent</b> · Agents SDK, one run per order</div><div><b>Policy guard</b> · rules in code</div><div><b>Scheduler</b> · Temporal timers</div><div><b>Model gateway</b> · masks PII</div><p>PostgreSQL · Redis · MinIO</p></div>
  <div class="col"><h4>Back to the carrier</h4><div>Context card → courier</div><div>CS queue → a person</div><div>Ops dashboard</div></div>
</div>
""" + table(["Component", "Demo (31 Oct)", "Production (per area)"], [
 ["Clients", "Next.js PWA on a phone, iPad console, laptop buyer view", "SPX driver app, a screen in the SPX dashboard, Shopee Chat / Zalo"],
 ["API + realtime", "FastAPI, REST + WebSocket", "FastAPI behind Caddy"],
 ["Agent", "State machine + tool calling", "OpenAI Agents SDK, workers on a Temporal queue"],
 ["Models", "OpenAI API, OpenAI TTS, AssemblyAI", "gpt-oss-20b on vLLM, PhoWhisper, Piper; OpenAI API as masked fallback"],
 ["Data", "SQLite, recordings folder", "PostgreSQL, Redis, Temporal, MinIO (encrypted, 30-day TTL)"],
 ["Hosting", "One VM, Docker Compose", "One workstation with two 16 GB GPUs per area; Kubernetes per region at scale"],
]) + '<p class="note">Source: PRD §16, §18.8. The same interfaces run in demo and production; only implementations swap.</p>')

c7 = chapter(7, "OpenAI at the core", "Runtime on OpenAI models; built and reviewed with Codex.", table(["Component", "Role in Alodi", "Demo", "Production"], [
 ["gpt-oss-20b", "Agent decisions and JSON extraction; runs in about 16 GB with MXFP4", "–", "Primary, on the area server"],
 ["Agents SDK", "One agent run per order: tools, CS handoff, guardrails, tracing", "State machine", "Orchestration layer"],
 ["Responses API", "Tool calling and Structured Outputs (strict schema)", "Primary", "Fallback for ~10% of requests, masked text"],
 ["gpt-4o-mini-tts", "Dynamic phrases inside the AI call", "Yes", "Short lines only"],
 ["gpt-4o-transcribe", "Second opinion when local ASR is unsure", "–", "Fallback, masked audio turns"],
 ["Evals", "Graders on the held-out set; gate every change", "Codex loop", "Release gate"],
 ["Codex", "Specify, build, parallelise, review, evaluate", "Yes", "Yes"],
]) + """
<h3>Distributed agent</h3><p>One orchestrator hands work to six workers (window question, rescue chat, voice, extractor, fallback, guardrails). Each worker is a task on
the Temporal queue, so a restart never loses a case, and every worker call passes the policy guard first. Traces go to the events log next to the audit trail.</p>
<p class="note">Source: PRD §16.7. Production design; the demo runs the OpenAI API behind the same interfaces.</p>""")

c8 = chapter(8, "Data, privacy and rules", "Personal data stays in the area; only extracted JSON leaves it.", """<ul>
<li>Phone numbers, names and addresses are masked before any model call; only masked text reaches the OpenAI fallback.</li>
<li>Raw audio and transcripts are encrypted with a 30-day TTL; every change to an order’s context is versioned with the actor and time.</li>
<li>Recording consent sits in the pre-recorded opening of every call; refusal ends the call and continues by chat or CS.</li>
<li>Opt-out is checked before every scheduled job; no real number is dialled in the demo (TEST-0001 … TEST-2000).</li>
<li>Constraints: Vietnam PDPL (from 1 Jan 2026), Decree 53/2022 on data location, Shopee’s 2–3 contacts within 5 days.</li></ul>""")

c9 = chapter(9, "Evaluation and outcomes", "Three numbers measured on stage, one projected.", stats([("< 10 s", "time-to-context, median", "event log · Measured"), ("≥ 0.90", "extraction F1 per field", "held-out set · Measured"), ("< 2%", "wrong auto-applies", "eval replay · Measured"), ("0", "labels, returns or calls out of hours without a person", "Measured")]) + table(["Eval item", "Spec"], [
 ["Starting set", "47 dev samples (35 templated, 12 hard cases)"], ["Final set", "≥ 200 samples: chat 45%, call 30%, memo 25%; 30% held out by a different teammate"],
 ["Scoring", "Precision, recall, F1 per field; calibration: ≥ 95% correct above 0.85 confidence"], ["Loop", "Codex proposes one change per round; keep it if F1 rises without hurting calibration; stop when held-out stalls"],
 ["Safe-autonomy run", f"Replay every sample plus the simulated day; simulation: {DAY['extraction']['auto_applied']} auto-applied of {fa['total']} failures"],
]) + '<p class="note">Source: PRD §2.3, §23. Numbers shown on today’s /metrics page are mock until the eval runs.</p>')

sc = [("Conservative", CONS), ("Base", BASE), ("Best-in-class", BEST)]
c10 = chapter(10, "Economics", f"One area loses {m(MID)} a month. Alodi costs {m(BEST['cost_month'])} a month to run.", table(["Scenario", "~Conservative", "~Base", "~Best-in-class"], [
 ["Rescue rate after a failed attempt (today 25%)", "40%", "45%", "65%"],
 ["Gross saving a month"] + [m(r["gross_month"], 1) for _, r in sc],
 ["Running cost a month"] + [m(r["cost_month"], 1) for _, r in sc],
 ["<b>Net saving a month</b>"] + [f"<b>{m(r['net_month'], 1)}</b>" for _, r in sc],
 ["Net as share of the loss"] + [f"{r['net_pct']:.0%}" for _, r in sc],
 ["Net a year"] + [f"₫{r['net_year'] / 1e9:.2f}B" for _, r in sc],
], "money") + f"""
{stats([("416", "CS calls a day handled by the agent", "≈ 28 staff-hours · Projected"), ("96", "fewer wasted courier trips a day", "320 × 0.3 attempts · Projected"), ("24 min", "back per courier a day", "Projected"), (f"{m(R['hardware_one_time'][0])}–{m(R['hardware_one_time'][1])}", "one-time server per area", "pays back in ~2 weeks · Listed price + estimate")])}
<p class="note">Best-in-class uses the top of Shipsy’s published 50–65% range (vendor). All savings are projected until a pilot measures Alodi’s own rescue rate. Every input and formula: alodi-numbers.pdf.</p>""")

comp = json.loads(subprocess.run(["node", "-e", "const t=require('fs').readFileSync(process.argv[1],'utf8');const m=t.match(/export const COMPETITORS = (\\{[\\s\\S]*?\\n\\});/);console.log(JSON.stringify(eval('('+m[1]+')')))", str(ROOT / "web/src/lib/content.ts")], capture_output=True, text=True, check=True).stdout)
c11 = chapter(11, "Competitive landscape", "Others reach the buyer. Alodi starts with a meaningful tap and hands back typed context.", table([""] + comp["columns"], [[f"<b>{e(r['label'])}</b>"] + [e(c) for c in r["cells"]] for r in comp["rows"]], "comp") + '<p class="note">Competitor figures are vendor claims from their own sites (see sources); not independently verified.</p>')

c12 = chapter(12, "Roadmap", "From a stage demo to a national rollout.", table(["Phase", "When", "Content", "Exit criteria"], [
 ["MVP demo", "31 Oct 2026", "Four screens on mock data", "AC-01 to AC-15 pass in rehearsal"], ["Full build", "Nov 2026", "Server engine, real call audio, ≥ 200 eval samples", "Measured metrics on /metrics"],
 ["Shadow mode", "Q1 2027", "One area, real events, no buyer contact", "Agent vs CS decisions compared; thresholds tuned; DPIA done"], ["Controlled channels", "Q2 2027", "Real chat and calls for risky orders", "0 rule violations; rescue rate measured"],
 ["Region", "H2 2027", "5–20 hubs; Vietnamese ASR and TTS self-hosted", "Cost per case and latency on target"], ["National", "2028", "20–100 hubs, GPU pool, second region", "Break-even; 99.9% availability"],
]) + '<p class="note">Source: PRD §28.</p>')

c13 = chapter(13, "Risks and assumptions", "What could make the numbers wrong, and what we do about it.", table(["Risk", "Mitigation"], [
 ["Buyers ignore unknown callers", "Chat first; verified brand name; call only after silence"], ["ASR mishears Vietnamese addresses", "Read-back confirmation; 0.85 threshold; PhoWhisper fine-tuning in the pilot"],
 ["Wrong auto-applied appointment", "Threshold plus calibration check; courier can still call; audit log"], ["Wrong label harms a buyer", "Labels only by a person"],
 ["Message cost or spam perception", "Opt-out; risky orders only; Shopee Chat before ZNS"], ["Cross-border personal data", "PII stays in Vietnam; masked text only to model APIs; self-hosted models at scale"],
 ["Mock numbers shown as results", "Labels mock, simulated, projected on every screen and page"],
]) + table(["Key assumption", "Status"], [["One area = 20 couriers, 4,000 orders a day, 200 stops each", "Estimate; to check with courier interviews"], ["8% first-attempt failure, 25% baseline rescue", "VECOM low end (Sourced); Shipsy (Vendor)"], ["Alodi lifts rescue to 65%", "Projected; measured only in a pilot"], ["₫26,000 = $1", "Estimate"]]) + '<p class="note">Source: PRD §26, §27.</p>')

team = [("nomura-yoshio.jpg", "Nomura Yoshio", "Team Lead · Presenter", "Product, demo script, pitch"), ("long-quan-ton.jpg", "Long Quan Ton", "AI Engineer · Solution Architect", "Orchestrator, voice agent, eval loop"), ("khanh-tuong-huynh.jpg", "Khanh Tuong Huynh", "AI Engineer · Deployment", "Context extractor, ASR, policy guard"), ("thanh-loi-tran.jpg", "Thanh Loi Tran", "Data Engineer · Backend", "Order Context Object, APIs, metrics log")]
c14 = chapter(14, "Team", "Team Develarper.", '<div class="team">' + "".join(f'<div><img src="{IMG("web/public/team/" + f)}"><b>{n}</b><span>{r}</span><i>{d}</i></div>' for f, n, r, d in team) + "</div>")

SRC = [
 ("Shopee Return & Refund Policy §7.1–7.2", "Seller pays return shipping on failed-delivery orders; none when the carrier is at fault", "help.shopee.vn/portal/4/article/77251", "Verified 31 Oct 2026 (policy republished 30 Oct 2026, effective 6 Nov 2026; no amount stated)"),
 ("GHN, who pays for Shopee returns", "₫40,000 cap per order since 1 Apr 2025 (₫20,000 express)", "ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi", "Verified; secondary source quoting Shopee"),
 ("Nguoi Lao Dong, 19 Jul 2025", "VECOM 8–12%, up to 20% remote; Tran Anh Tung 10–15%, 25–30% in sale season", "tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm", "Verified"),
 ("Shopee Help Center 79559", "No specific delivery time can be chosen", "help.shopee.vn/portal/4/article/79559", "Verified"),
 ("Shopee Help Center 79569", "2–3 contacts; reschedule within 5 days", "help.shopee.vn/portal/4/article/79569", "Verified"),
 ("Shopee Help Center 79196", "3 failed COD orders in 90 days disable COD", "help.shopee.vn/portal/4/article/79196", "Verified"),
 ("GHN, courier pay per order", "₫6,000–8,000 per delivered order (average)", "ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien", "Verified; not an official Shopee figure"),
 ("Shipsy, NDR management", "Industry rescue 20–30%, best-in-class 50–65%", "shipsy.ai/insights/what-is-ndr-non-delivery-report-management", "Verified; vendor claim"),
 ("Metric, E-commerce report 2025", "₫429.7T across Shopee, TikTok Shop, Lazada, Tiki; +34.75%", "metric.vn (via daibieunhandan.vn, vneconomy.vn)", "Verified via press; single data provider"),
 ("OpenAI, gpt-oss model card", "gpt-oss-20b runs within 16 GB with MXFP4", "openai.com · Azure AI catalog · vLLM recipes", "Verified"),
 ("Glints Vietnam; Phong Vu; Viettel reseller; oazns.vn; EVN", "Courier income, GPU prices, SIP, ZNS and power tariffs", "see PRD §18.8", "Listed prices, checked 30 Oct 2026 by the team"),
 ("ClickPost, AfterShip, Ringg AI, Shiprocket, GHTK", "Competitor capabilities and results", "see web/src/lib/content.ts sources", "Vendor claims; not independently verified"),
]
c15 = chapter(15, "Sources and verification", "Every external figure, where it comes from, and how far we checked it.", table(["Source", "What we use", "Where", "Check"], [[f"<b>{e(a)}</b>", e(b), f"<span class=url>{e(c)}</span>", e(d)] for a, b, c, d in SRC], "src") + '<p class="note">Correction made on 31 Oct 2026: earlier drafts cited a Shopee policy date of 11 Mar 2026 and a VTV article for the ₫40,000 figure. The VTV article describes a promotional support cap, and the policy page has since been republished, so the figure is now cited to the policy (§7.1) plus GHN for the cap.</p>')

CSS = font_css + """
@page { size: A4; margin: 18mm 17mm 18mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Geist', sans-serif; color: #1f2a44; font-size: 9.6pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { width: 210mm; height: 297mm; background: #121a2c; color: #f6f3f1; padding: 20mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.ctop { display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; color: #8a91a6; } .ctop svg { height: 12mm; width: auto; }
h1 { font-weight: 500; font-size: 52pt; line-height: 1; letter-spacing: -0.035em; margin: 5mm 0 0; }
.cmid p { font-size: 12pt; color: #c9cfdc; max-width: 145mm; margin-top: 8mm; }
.cgrid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid rgba(255,255,255,.15); }
.cgrid div { padding: 6mm 4mm 0 0; } .cgrid div + div { padding-left: 4mm; border-left: 1px solid rgba(255,255,255,.15); }
.cgrid b { display: block; font-size: 22pt; font-weight: 500; } .cgrid .hi b { color: #f05a00; } .cgrid span { font-size: 8pt; color: #a7aec0; text-transform: uppercase; letter-spacing: .03em; }
.eyebrow { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: #c94b00; font-weight: 600; } .eyebrow.o { color: #f05a00; }
.ch { page-break-before: always; } .toc { page-break-before: auto; }
h2 { font-weight: 500; font-size: 24pt; letter-spacing: -0.025em; line-height: 1.1; margin: 2mm 0 2mm; }
h3 { font-size: 11pt; font-weight: 600; margin: 6mm 0 2mm; break-after: avoid; }
.keep { page-break-inside: avoid; } h4 { margin: 0 0 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7183; }
.lead { font-size: 12pt; color: #4a5268; margin: 0 0 5mm; }
.toc ol { font-size: 13pt; columns: 2; padding-left: 6mm; line-height: 1.9; }
ul { padding-left: 4.5mm; } li { margin-bottom: 1.2mm; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; font-size: 8.6pt; page-break-inside: avoid; }
th { text-align: left; font-weight: 600; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7183; padding: 2mm; border-bottom: 1px solid #1f2a44; }
td { padding: 2mm; border-bottom: 1px solid #e6e2df; vertical-align: top; } td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
table.comp { font-size: 7.4pt; } table.src { font-size: 7.6pt; } .url { color: #6b7183; word-break: break-all; }
.note { font-size: 8.2pt; color: #6b7183; border-left: 2px solid #f05a00; padding-left: 3.5mm; margin: 3mm 0; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; } .two.w { grid-template-columns: 1.35fr 1fr; align-items: start; }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); border-top: 1px solid #1f2a44; margin: 4mm 0; page-break-inside: avoid; }
.two .stats { grid-template-columns: 1fr 1fr; } section > .stats { grid-template-columns: repeat(4, 1fr); }
.stats div { padding: 3.5mm 3mm 3.5mm 0; border-bottom: 1px solid #e6e2df; } .stats b { display: block; font-size: 19pt; font-weight: 500; letter-spacing: -0.02em; }
.stats span { display: block; font-size: 8.6pt; margin-top: 1mm; } .stats i { display: block; font-style: normal; font-size: 7.4pt; color: #8a91a6; margin-top: 1mm; }
.photo img { width: 100%; border-radius: 4mm; display: block; } figcaption { font-size: 7.6pt; color: #6b7183; margin-top: 1.5mm; }
.shot { margin: 2mm 0 4mm; } .shot img { width: 100%; border-radius: 3mm; border: 1px solid #e6e2df; display: block; } .shot.s { margin-top: 6mm; }
.steps8 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 0; list-style: none; counter-reset: s; border-top: 1px solid #1f2a44; }
.steps8 li { counter-increment: s; padding: 3mm 3mm 3mm 0; border-bottom: 1px solid #e6e2df; margin: 0; } .steps8 li::before { content: "0" counter(s); color: #f05a00; font-size: 8pt; font-weight: 600; display: block; }
.steps8 b { display: block; font-size: 9.4pt; } .steps8 span { font-size: 8pt; color: #6b7183; }
.arch { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 4mm; margin: 2mm 0 4mm; page-break-inside: avoid; }
.arch .col div { border: 1px solid #cecac8; border-radius: 3mm; padding: 2.2mm 3mm; margin-bottom: 2mm; font-size: 8.6pt; background: #fbf9f7; }
.arch .core { background: #121a2c; color: #f6f3f1; border-radius: 4mm; padding: 4mm; } .arch .core h4 { color: #f05a00; font-family: 'Be Vietnam Pro'; text-transform: none; font-size: 13pt; letter-spacing: -0.02em; }
.arch .core div { background: rgba(255,255,255,.07); border-radius: 2.5mm; padding: 2mm 3mm; margin-bottom: 2mm; font-size: 8.4pt; } .arch .core p { font-size: 7.8pt; color: #a7aec0; margin: 3mm 0 0; }
.status { font-size: 8.4pt; padding: 3mm 4mm; border-radius: 3mm; background: #e7f3ec; margin-bottom: 4mm; } .status.warn { background: #fbe3d4; }
.team { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin-top: 6mm; } .team img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 50%; }
.team b { display: block; margin-top: 3mm; font-size: 10pt; } .team span { display: block; font-size: 8.2pt; color: #c94b00; } .team i { display: block; font-style: normal; font-size: 8pt; color: #6b7183; margin-top: 1mm; }
"""

doc = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Alodi · Project report</title><style>{CSS}</style></head><body>{cover}{contents}{c1}{c2}{c3}{c4}{c5}{c6}{c7}{c8}{c9}{c10}{c11}{c12}{c13}{c14}{c15}</body></html>"
out_html = HERE / "alodi-report.html"
out_pdf = HERE / "alodi-report.pdf"
out_html.write_text(doc, encoding="utf-8")
chrome = next((p for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("google-chrome"), shutil.which("chromium")] if p and Path(p).exists()), None)
if not chrome:
    sys.exit(f"Wrote {out_html}; install Chrome to print the PDF.")
subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", out_html.as_uri()], check=True, capture_output=True)
shutil.copy(out_pdf, ROOT / "web/public/alodi-report.pdf")
out_html.unlink()  # holds absolute local paths; the PDF is the artefact
print(out_pdf)
