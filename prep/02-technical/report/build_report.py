"""Build the Alodi project report (HTML → PDF): a continuous, numbered report in the Alodi brand.

Usage (from the repo root):
    python3 -I prep/02-technical/report/build_report.py
Writes prep/02-technical/report/alodi-report.pdf and copies it to web/public/alodi-report.pdf.
Money comes from cost_model.py, the simulated day from mock-data, the survey from prep/06-survey (labelled by its
data_status). Sections flow continuously; page numbers and running footers come from CSS page margin boxes.
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
AWS = ROWS[("aws_managed", "risky_only", "best_in_class")]
DAY = json.loads((ROOT / "prep/02-technical/mock-data/expected-day-summary.json").read_text())
DOOR = L["items"]["Shipper time lost when the buyer doesn't answer"]
VERSION = "0.5 · working draft"
DATE = "31 October 2026"


def m(v, d=0):
    return f"₫{v / 1e6:,.{d}f}M"


def e(s):
    return html.escape(str(s))


def rows_csv(p):
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


shippers = rows_csv(ROOT / "prep/06-survey/couriers.csv")
customers = rows_csv(ROOT / "prep/06-survey/customers.csv")
summary = {(r["audience"], r["metric"].replace("courier", "shipper").replace("Courier", "Shipper")): r["value"] for r in rows_csv(ROOT / "prep/06-survey/summary_MOCK.csv")}
status = Counter(r["data_status"] for r in shippers + customers)
companies = Counter(r["company"] for r in shippers)
placeholder = status.get("REAL", 0) == 0
sv = lambda a, k: summary.get((a, k), "–")

LOGO_W = (ROOT / "prep/04-brand/logo/alodi-wordmark-white.svg").read_text()
FONTS = {"Geist": ROOT / "prep/01-pitch/charts/fonts/Geist.ttf", "Be Vietnam Pro": ROOT / "prep/04-brand/fonts/BeVietnamPro-ExtraBold.ttf"}
font_css = "\n".join(f"@font-face {{ font-family: '{k}'; src: url('{v.as_uri()}'); }}" for k, v in FONTS.items())


def table(head, rows, cls=""):
    th = "".join(f"<th{' class=r' if h.startswith('~') else ''}>{e(h.lstrip('~'))}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td{' class=r' if head[i].startswith('~') else ''}>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def chapter(n, title, lead, body):
    return f'<section class="ch"><h2><span>{n}</span>{e(title)}</h2><p class="lead">{lead}</p>{body}</section>'


def sub(n, title):
    return f"<h3><span>{n}</span>{e(title)}</h3>"


def kf(items):
    """Key-figure strip: value, label, status. Compact, full width."""
    return '<div class="kf">' + "".join(f"<div><b>{v}</b><span>{l}</span><i>{s}</i></div>" for v, l, s in items) + "</div>"


def note(t):
    return f'<p class="note">{t}</p>'


fa = DAY["failed_first_attempt"]
net_pct = BEST["net_pct"]

# ---------------------------------------------------------------- front matter
cover = f"""
<section class="cover">
  <div class="ctop"><span class="logo">{LOGO_W}</span><img class="ev-sea" src="{(HERE / 'event/sea-openai.png').as_uri()}"></div>
  <div class="cmid">
    <div class="ey">Project report</div>
    <h1>Alodi</h1>
    <p class="tag">Make the second drop land.</p>
    <p class="abs">The agentic recovery system for last-mile delivery in Vietnam: the problem, the product, the architecture,
    the OpenAI stack, the evaluation plan, the economics and the road to a pilot.</p>
  </div>
  <dl class="meta">
    <div><dt>Prepared by</dt><dd>Team Develarper</dd></div>
    <div><dt>Event</dt><dd>Sea × OpenAI Regional Codex Hackathon, Ho Chi Minh City</dd></div>
    <div><dt>Date</dt><dd>{DATE}</dd></div>
    <div><dt>Version</dt><dd>{VERSION}</dd></div>
    <div><dt>Status</dt><dd>Money figures projected; survey values placeholder until the interview export lands</dd></div>
  </dl>
</section>"""

contents = f"""
<section class="front">
<h2 class="plain">Contents</h2>
<ol class="toc">
<li>Executive summary</li><li>The problem</li><li>What we heard: the survey</li><li>Alodi</li><li>The product</li>
<li>Architecture</li><li>OpenAI at the core</li><li>Data, privacy and rules</li><li>Evaluation and outcomes</li>
<li>Economics</li><li>Competitive landscape</li><li>Roadmap</li><li>Risks and assumptions</li><li>Team</li><li>Sources and verification</li>
</ol>
<h2 class="plain">Key figures</h2>
{table(["Figure", "~Value", "Status", "Where it comes from"], [
 ["Return fee the seller pays per failed order", "up to ₫40,000", "Sourced", "Shopee policy §7.1; cap since 1 Apr 2025 (GHN)"],
 ["Orders refused at the door, nationwide", "8–12%", "Sourced", "VECOM via Nguoi Lao Dong, 19 Jul 2025"],
 ["Delivery windows a Shopee buyer can choose", "0", "Sourced", "Shopee Help Center 79559"],
 ["Loss per area per month (20 shippers, 4,000 orders a day)", f"≈ {m(MID)}", "Modelled", "Team cost model, §10"],
 ["Alodi running cost per area per month", m(BEST['cost_month'], 1), "Estimate", "OpenAI list prices, SIP, ZNS, ops, §10"],
 ["Net saving per area per month, best-in-class", f"{m(BEST['net_month'], 1)} ({net_pct:.0%})", "Projected", "Shipsy best-in-class rescue range (vendor)"],
 ["Time-to-context target", "< 10 s", "Measured on stage", "PRD §2.3"],
 ["Extraction F1 target", "≥ 0.90", "Measured on stage", "PRD §23"],
])}
{note('Status labels: <b>Sourced</b> public document · <b>Vendor</b> company claim · <b>Estimate</b> team assumption · <b>Modelled</b> sourced numbers with stated assumptions · <b>Projected</b> not yet measured · <b>Simulated</b> fictional mock data.')}
</section>"""

# ---------------------------------------------------------------- chapters
c1 = chapter(1, "Executive summary", "A failed delivery is a time negotiation that happens off the system. Alodi brings it back in.", f"""
<div class="cols">
<p><b>Problem.</b> Sellers pay up to ₫40,000 in return shipping for every failed Shopee order, 8–12% of orders are refused at the door, and buyers
cannot choose a delivery window. When a shipper can’t reach a buyer, the context that would fix the next attempt is compressed into one error code.
For one area of 20 shippers and 4,000 orders a day, that costs about {m(MID)} a month (modelled).</p>
<p><b>Product.</b> The shipper taps one button: No answer, Rescheduled or Refused. Alodi messages the buyer at once and calls if there is silence
(60 minutes, then 2 hours, only 08:00–20:30). GPT-Live-1 holds the call, the Decisions API on GPT-6 Luna triages every answer, and GPT-6.1 Terra
orchestrates the case and writes a context card with when, where and who. Refusals, labels and returns always go to a person.</p>
<p><b>Proof.</b> Three outcomes are measured on stage: time-to-context under 10 seconds, per-field F1 of at least 0.90, and zero high-stakes actions
without a person. Money is projected: at best-in-class rescue Alodi saves {m(BEST['net_month'], 1)} a month per area ({net_pct:.0%} of the loss)
after a running cost of {m(BEST['cost_month'], 1)}.</p>
<p><b>Next.</b> A full build in November 2026, shadow mode at one area in Q1 2027 with no buyer contact, then controlled real channels, a region and a
national rollout by 2028.</p>
</div>
{sub("1.1", "At a glance")}
{kf([(m(MID), "lost a month in one area today", "Modelled"), ("1 tap", "from the shipper starts a rescue", "Product"), ("< 10 s", "from the buyer’s answer to the shipper’s card", "Target · measured on stage"), (m(BEST['net_month']), f"net saving a month, {net_pct:.0%} of the loss", "Projected")])}
{sub("1.2", "Why now")}
<ul class="cols"><li><b>The cost moved to sellers.</b> Since April 2025 Shopee sellers pay return shipping on failed orders, up to ₫40,000 each.</li>
<li><b>Volume keeps growing.</b> The four largest marketplaces sold ₫429.7T in 2025, up 34.75% (Metric); call teams cannot grow that fast.</li>
<li><b>The models are ready.</b> GPT-Live-1 makes a natural voice call possible, the Decisions API makes triage cheap, GPT-6.1 Terra handles the orchestration.</li>
<li><b>The rules are clear.</b> Shopee’s 2–3 contacts within 5 days give the agent a fixed frame to work inside.</li></ul>
""")

c2 = chapter(2, "The problem", "Nothing is broken in the route. The context dies in a phone call.", f"""
{kf([("₫40,000", "return fee per failed order", "Shopee §7.1 · GHN · Sourced"), ("8–12%", "refused at the door, nationwide", "VECOM · Sourced"), ("0", "delivery windows a buyer can choose", "Shopee 79559 · Sourced"), ("3 in 90 days", "failed COD orders before COD is switched off", "Shopee 79196 · Sourced")])}
{sub("2.1", "Why it persists")}
<ul class="cols">
<li><b>Time is negotiated off the system.</b> Shopee does not support choosing a delivery time, so buyer and shipper agree by phone.</li>
<li><b>One error code replaces the context.</b> “No answer” or “rescheduled” loses when, where and who; the second attempt repeats the first.</li>
<li><b>People don’t scale.</b> Phoning 320 failed buyers twice a day for four minutes takes about five full-time callers per area (estimate).</li>
<li><b>The frame is fixed.</b> Shopee allows 2–3 contact attempts and a reschedule within 5 days (Help Center 79569).</li>
</ul>
{sub("2.2", "One area, one month")}
{table(["Loss item", "Formula", "~Per month", "Type"], [
 ["Return fees paid by sellers", "4,000 × 8% = 320 failed a day; 75% not rescued × ₫40,000 × 30", m(L['items']['Return fees paid by sellers'][0], 1), "Derived"],
 ["Shipper pay for redelivery", "320 × 1.5 attempts × ₫6,000–8,000 × 30", f"{m(L['items']['Shipper pay for redelivery attempts'][0], 1)}–{m(L['items']['Shipper pay for redelivery attempts'][1], 1)}", "Derived"],
 ["Shipper time at unanswered doors", "320 × 5 min × shipper hourly cost × 30", f"{m(DOOR[0], 1)}–{m(DOOR[1], 1)}", "Modelled"],
 ["CS calling buyers back", "320 × 2 calls × 4 min × ₫35,000/h × 30", m(L['items']['Hub / CS staff calling buyers back'][0], 1), "Estimate"],
 ["<b>Total</b>", "midpoint of low and high", f"<b>{m(L['total'][0])}–{m(L['total'][1])} · ≈ {m(MID)}</b>", "Modelled"],
])}
{note("Not counted: the seller’s lost sale, packaging, ad spend, damaged goods. At VECOM’s 12% upper rate every line scales by 1.5×. Full derivation in alodi-numbers.pdf.")}
""")

c3 = chapter(3, "What we heard: the survey", "We asked both sides of the same missed call.", f"""
<div class="status{' warn' if placeholder else ''}"><b>Data status · {', '.join(f'{k} {v}' for k, v in status.items())}.</b>
{'The response files in the repository are still the generated placeholders (prep/06-survey, seed 30102026). The values below show what the survey measures and are replaced by the interview export before they are quoted as findings.' if placeholder else 'Real interview responses.'}</div>
<div class="cols2">
<div>{sub("3.1", f"Buyers · n = {len(customers)}")}
{table(["Question", "~Value"], [["Want to choose a delivery window", sv('customer', 'Want to choose a delivery window (agree or strongly agree)')], ["Called the shipper back and couldn’t reach them", sv('customer', 'Called back and could not reach the shipper, sometimes or more')], ["Shipper called while busy, often", sv('customer', 'Shipper called while busy, often or very often')], ["Comfortable with an automated call", sv('customer', 'Comfortable with an automated call (agree or strongly agree)')], ["Would use an Alodi-like service", sv('customer', 'Would use an Alodi-like service: Yes')]])}</div>
<div>{sub("3.2", f"Shippers · n = {len(shippers)}")}
{table(["Question", "~Value"], [["Calls to buyers a day (mean)", sv('courier', 'Mean calls to buyers per day')], ["Share of calls unanswered (mean %)", sv('courier', 'Mean unanswered call share (%)')], ["Buyers call while riding, often", sv('courier', 'Buyers call while riding, often or very often')], ["Would like an Alodi-like system", sv('courier', 'Would like an Alodi-like system: Yes')], ["Minutes saved a day expected (mean)", sv('courier', 'Mean expected minutes saved per day (Yes answers)')]])}</div>
</div>
{note(f"Shipper sample: {', '.join(f'{k} {v}' for k, v in companies.most_common())}. Instrument: 16 buyer and 15 shipper questions in Vietnamese and English (prep/06-survey/codebook.csv). Names and phone numbers are dropped before saving (Vietnam PDPL).")}
""")

c4 = chapter(4, "Alodi", "The agentic recovery system for last-mile delivery. Autonomous where the rules are clear; human where they aren’t.", f"""
{sub("4.1", "The flow, in eight steps")}
<ol class="steps8">
<li><b>Load orders and windows</b><span>every morning, per area</span></li><li><b>Ask for a window</b><span>≥ 2 options from the route planner</span></li>
<li><b>Note to the shipper</b><span>no reply: deliver as planned</span></li><li><b>Deliver, tap the outcome</b><span>A / B / Refused, 2-minute undo</span></li>
<li><b>Flow A · no answer</b><span>chat → 60′ call → +2 h call → CS</span></li><li><b>Flow B · rescheduled</b><span>10 s memo → ASR → mask → JSON</span></li>
<li><b>Save the appointment</b><span>context card for the next attempt</span></li><li><b>CS decides</b><span>a person labels and returns</span></li>
</ol>
{sub("4.2", "Hard rules, enforced by the policy guard in code")}
{table(["Rule", "Value"], [["Call hours", "08:00–20:30 only; later calls move to the next morning"], ["Calls per cycle", "at most 2"], ["Redeliveries", "at most 2, inside Shopee’s 5-day frame"], ["Auto-apply", "only when every field has confidence ≥ 0.85; otherwise confirm in chat or send to CS"], ["Refused at the door", "no buyer contact; straight to CS"], ["Labels and returns", "suggested by the agent, approved by a person"], ["Opt-out", "“stop” ends all contact"], ["Recordings", "notice in the opening line; raw audio kept 30 days"]])}
""")

c5 = chapter(5, "The product", "Four screens and one agent, kept in sync on a fast-forward clock.", table(["Surface", "Who uses it", "What it does"], [
 ["Shipper app", "Shipper, on a phone", "One tap (No answer · Rescheduled · Refused), 10-second voice memo, context card for the next attempt"],
 ["Buyer channel", "Buyer, on a laptop in the demo", "Chat with quick replies; the AI call"],
 ["Ops console", "Dispatcher and CS, on an iPad", "Live case, extracted fields with confidence, audit trail, label approval"],
 ["Hub dashboard", "Hub lead", "A simulated 4,000-order day: rescue pipeline by step, failures by hour, policy guard, 20 routes, CS queue"],
]) + sub("5.1", "Demo scenarios on route R07") + table(["Scenario", "What happens", "Expected outcome"], [
 ["<b>A_main</b>", "No reply; tap A 10:02; chat; AI call 1 at 11:04 answered", "1 Nov 17:00–20:00 (0.94), Tower B security (0.88), wife (0.91); auto-applied"],
 ["<b>B_memo</b>", "Tap B 10:40; 9-second shipper memo", "1 Nov 08:00–10:00 (0.93), Tower A reception (0.90); auto-applied"],
 ["<b>REFUSE</b>", "Tap Refused 11:10", "No buyer contact; suggested label; CS approves the return"],
 ["<b>A_lowconf</b>", "Tap A 12:20; call 1 gets a vague answer", "0.52 / 0.41; confirm in chat; CS applies 14:00–17:00"],
 ["<b>A_noanswer</b>", "Tap A 14:30; calls at 15:32 and 17:32 missed", "Escalated after two calls; no third call"],
]) + sub("5.2", "The simulated day behind the dashboard") + kf([(f"{DAY['orders']:,}", "orders", "fixed seed · Simulated"), (str(fa['total']), f"failed first time · A {fa['A']} · B {fa['B']} · refused {fa['C']}", "Simulated"), (str(DAY['rescheduled_with_card']), "rescued with a context card", "Simulated"), (str(DAY['cs_queue']['total']), "handed to customer service", "Simulated")]))

c6 = chapter(6, "Architecture", "An agent layer between the buyer and the carrier. It replaces nothing and fails open.", """
<div class="arch">
  <div class="col"><h4>Carrier + buyer</h4><div>Route planner · SPX</div><div>Order system · SPX</div><div>Shipper tap</div><div>Buyer chat · Shopee / Zalo</div><div>AI call · GPT-Live-1 over SIP</div></div>
  <div class="core"><h4>alodi · agent layer</h4><div><b>Alodi Agent</b> · GPT-6.1 Terra, Agents SDK</div><div><b>Triage</b> · Decisions API on GPT-6 Luna</div><div><b>Policy guard</b> · rules in code, masks PII</div><div><b>Scheduler</b> · Temporal timers</div><p>PostgreSQL · Redis · MinIO · gpt-oss-20b fallback</p></div>
  <div class="col"><h4>Back to the carrier</h4><div>Context card → shipper</div><div>CS queue → a person</div><div>Ops dashboard</div></div>
</div>
""" + table(["Component", "Demo (31 Oct)", "Production (per area)"], [
 ["Clients", "Next.js PWA on a phone, iPad console, laptop buyer view", "SPX driver app, a screen in the SPX dashboard, Shopee Chat / Zalo"],
 ["API + realtime", "FastAPI, REST + WebSocket", "FastAPI behind Caddy"],
 ["Agent", "State machine + tool calling", "GPT-6.1 Terra on the Agents SDK; workers on a Temporal queue"],
 ["Models", "OpenAI API, OpenAI TTS, AssemblyAI", "GPT-Live-1, Decisions API (GPT-6 Luna), GPT-6.1 Terra; gpt-oss-20b and PhoWhisper locally"],
 ["Data", "SQLite, recordings folder", "PostgreSQL, Redis, Temporal, MinIO (encrypted, 30-day TTL)"],
 ["Hosting", "One VM, Docker Compose", "OpenAI cloud + one workstation with two 16 GB GPUs per area; Kubernetes per region at scale"],
]) + note("Source: PRD §16, §16.7, §18.8. The same interfaces run in demo and production; only implementations swap."))

c7 = chapter(7, "OpenAI at the core", "GPT-Live-1 talks to the buyer, the Decisions API triages, GPT-6.1 Terra orchestrates. Codex builds it.", f"""
<p>With OpenAI’s stack, Alodi talks to buyers through <b>GPT-Live-1</b>, OpenAI’s full-duplex voice model, so the call feels like a conversation rather than
an IVR. Every incoming signal is first sorted by the <b>Decisions API on GPT-6 Luna</b>: which case it is, which window the buyer chose, and how confident that
is. Once the information is classified and trimmed, <b>GPT-6.1 Terra</b> orchestrates the workflow between the order data, the buyer and the shipper in the
shortest time, applies company policy through the guard, and cuts the back-and-forth between buyer and shipper to a single context card.</p>
{table(["Component", "Role in Alodi", "Endpoint · price", "Demo", "Production"], [
 ["<b>GPT-Live-1</b>", "Real-time voice calls with the buyer; listens while it speaks and delegates reasoning to the Terra agent", "v1/live/sessions · $0.05 a minute", "In-browser call + TTS", "AI calls over the SIP line"],
 ["<b>Decisions API</b> on <b>GPT-6 Luna</b>", "Triage of every message: case type, chosen window, confidence (predicate, choice and score questions with probabilities)", "/v1/decisions · $0.10 per 1M input tokens", "–", "First step for every signal"],
 ["<b>GPT-6.1 Terra</b>", "Orchestration and extraction for escalated cases (~20% of traffic, estimate); Structured Outputs for the card", "Responses API · $1 / $5 per 1M tokens", "OpenAI API", "Agent brain"],
 ["<b>Agents SDK</b>", "One run per order: tools, CS handoff, guardrails, tracing", "Python SDK", "State machine", "Framework around Terra"],
 ["<b>gpt-oss-20b</b>", "Offline fallback on the area server (~16 GB with MXFP4)", "vLLM or Ollama · open weights", "–", "Fallback"],
 ["<b>Evals</b>", "Graders on the held-out set; gate every prompt, schema or model change", "OpenAI platform", "Codex loop", "Release gate"],
 ["<b>Codex</b>", "Specify, build, parallelise, review, evaluate", "CLI · cloud · GitHub", "Yes", "Yes"],
], "oa")}
{sub("7.1", "Distributed agent")}
<p>One orchestrator (Terra) hands work to six workers: triage (Decisions API), voice (GPT-Live-1), window question, rescue chat, extractor and guardrails.
Each worker is a task on the Temporal queue, so a restart never loses a case, and every call passes the policy guard first. Agents SDK traces go to the events
log next to the audit trail.</p>
{sub("7.2", "Open points")}
<ul><li>OpenAI’s GPT-Live-1 model page does not list supported languages, so Vietnamese call quality is tested before the pilot; PhoWhisper and the local fallback stay until it passes.</li>
<li>Call audio is personal data that cannot be masked; the GPT-Live-1 path needs a transfer impact assessment under the PDPL before production.</li></ul>
""")

c8 = chapter(8, "Data, privacy and rules", "Text to the cloud is masked; calls run only after the recording notice.", """<ul class="cols">
<li>Phone numbers, names and house numbers are masked before any text reaches GPT-6.1 Terra, the Decisions API or the local fallback.</li>
<li>AI calls run on GPT-Live-1 only after the buyer hears the recording notice; refusal ends the call and continues by chat or CS.</li>
<li>Raw audio and transcripts are encrypted with a 30-day TTL; every change to an order’s context is versioned with the actor and time.</li>
<li>Opt-out is checked before every scheduled job; no real number is dialled in the demo (TEST-0001 … TEST-2000).</li>
<li>Constraints: Vietnam PDPL (from 1 Jan 2026), Decree 53/2022 on data location, Shopee’s 2–3 contacts within 5 days.</li>
<li>Cross-border transfer: call audio to OpenAI requires a transfer impact assessment; the offline fallback keeps the area working without the cloud.</li></ul>
<h3><span>8.1</span>Data classification and retention</h3>
<table><thead><tr><th>Data</th><th>Class</th><th>Where</th><th>Retention</th><th>Leaves the trusted zone?</th></tr></thead><tbody>
<tr><td>Buyer phone, name, address</td><td>Personal</td><td>orders (phone encrypted)</td><td>Carrier policy</td><td>Masked only</td></tr>
<tr><td>Live call audio</td><td>Personal, sensitive</td><td>GPT-Live-1 session</td><td>Session only</td><td>Yes, to OpenAI after the recording notice</td></tr>
<tr><td>Recorded call and memo audio</td><td>Personal, sensitive</td><td>Recordings store (MinIO)</td><td>30 days</td><td>No</td></tr>
<tr><td>Masked transcript and chat text</td><td>Pseudonymised</td><td>recordings, events</td><td>30 days</td><td>To the Decisions API and GPT-6.1 Terra</td></tr>
<tr><td>Extracted JSON, context card</td><td>Operational</td><td>rescue_result</td><td>Order lifetime</td><td>Yes, to the shipper app and SPX</td></tr>
<tr><td>Event log and traces</td><td>Operational</td><td>events</td><td>Monthly partitions</td><td>Aggregates only</td></tr>
</tbody></table>
<h3><span>8.2</span>Rights and controls</h3>
<ul class="cols"><li><b>Consent.</b> The recording notice is the first line of every call; declining ends the call.</li><li><b>Opt-out.</b> “Stop” cancels every pending message and call for the order.</li>
<li><b>Audit.</b> Every write to the order context records who changed what and when.</li><li><b>Minimisation.</b> Models receive the masked fields they need, nothing else.</li></ul>
<p class="note">Source: PRD §16.6, §17.3, updated for the GPT-Live-1 call path.</p>""")

c9 = chapter(9, "Evaluation and outcomes", "Three numbers measured on stage, one projected.", kf([("< 10 s", "time-to-context, median", "event log · Measured"), ("≥ 0.90", "extraction F1 per field", "held-out set · Measured"), ("< 2%", "wrong auto-applies", "eval replay · Measured"), ("0", "labels, returns or calls out of hours without a person", "Measured")]) + table(["Eval item", "Spec"], [
 ["Starting set", "47 dev samples (35 templated, 12 hard cases)"], ["Final set", "≥ 200 samples: chat 45%, call 30%, memo 25%; 30% held out by a different teammate"],
 ["Scoring", "Precision, recall, F1 per field; calibration: ≥ 95% correct above 0.85 confidence"], ["Loop", "Codex proposes one change per round; keep it if F1 rises without hurting calibration; stop when held-out stalls"],
 ["Safe-autonomy run", f"Replay every sample plus the simulated day; simulation: {DAY['extraction']['auto_applied']} auto-applied of {fa['total']} failures"],
]) + sub("9.1", "Acceptance criteria for the demo") + table(["ID", "Given → then"], [
 ["AC-01", "4,000 orders and no opt-outs → every buyer gets 4 windows plus “can’t receive today”"], ["AC-04", "Rescue chat at 10:04, no reply → call 1 at 11:04, call 2 at 13:04"], ["AC-05", "A call due at 20:42 → no call; moved to 08:00 next day; policy_block logged"],
 ["AC-06", "Buyer replies while call 1 is pending → call cancelled, extraction runs on the reply"], ["AC-07", "Fields at 0.94 / 0.88 / 0.91 → auto-applied, card on the shipper app within 10 s"],
 ["AC-08", "Any field below 0.85 → confirm in chat; still unclear → CS queue, low_confidence"], ["AC-09", "Shipper taps Refused → no buyer contact; suggested label not applied"],
 ["AC-12", "Buyer writes “stop” → all pending contact cancelled"], ["AC-14", "Any model request → no unmasked phone or house number in the logged prompt"],
]) + note("Source: PRD §2.3, §23, §24 (AC-01 to AC-15). Numbers on today’s /metrics page are mock until the eval runs."))

sc = [("Conservative", CONS), ("Base", BASE), ("Best-in-class", BEST)]
cost_rows = [[e(k), m(v, 2)] for k, v in BEST["cost_items"].items()] + [["<b>Total running cost</b>", f"<b>{m(BEST['cost_month'], 1)}</b>"]]
c10 = chapter(10, "Economics", f"One area loses {m(MID)} a month. Alodi costs {m(BEST['cost_month'], 1)} a month to run.", f"""
<div class="cols2">
<div>{sub("10.1", "Monthly running cost per area")}{table(["Item", "~Per month"], cost_rows)}</div>
<div>{sub("10.2", "Savings by scenario")}{table(["Scenario", "~Conservative", "~Base", "~Best"], [
 ["Rescue after a failed attempt", "40%", "45%", "65%"],
 ["Gross saving"] + [m(r["gross_month"], 1) for _, r in sc],
 ["Running cost"] + [m(r["cost_month"], 1) for _, r in sc],
 ["<b>Net saving</b>"] + [f"<b>{m(r['net_month'], 1)}</b>" for _, r in sc],
 ["Share of the loss"] + [f"{r['net_pct']:.0%}" for _, r in sc],
 ["Net a year"] + [f"₫{r['net_year'] / 1e9:.2f}B" for _, r in sc],
 ["Server pays back in"] + [f"~{r['hardware_payback_months'] * 4.35:.0f} weeks" for _, r in sc],
])}</div>
</div>
{kf([("416", "CS calls a day by the agent", "≈ 28 staff-hours · Projected"), ("96", "fewer wasted trips a day", "Projected"), ("24 min", "back per shipper a day", "Projected"), (f"{m(R['hardware_one_time'][0])}–{m(R['hardware_one_time'][1])}", "one-time area server", "Listed price + estimate")])}
{note(f"OpenAI lines use list prices from developers.openai.com (31 Oct 2026); the 20% Terra escalation share is an estimate. Best-in-class uses the top of Shipsy’s 50–65% range (vendor). The AWS-managed alternative costs {m(AWS['cost_month'], 1)} a month. All savings are projected until a pilot measures Alodi’s own rescue rate; every formula is in alodi-numbers.pdf.")}
""")

comp = json.loads(subprocess.run(["node", "-e", "const t=require('fs').readFileSync(process.argv[1],'utf8');const m=t.match(/export const COMPETITORS = (\\{[\\s\\S]*?\\n\\});/);console.log(JSON.stringify(eval('('+m[1]+')')))", str(ROOT / "web/src/lib/content.ts")], capture_output=True, text=True, check=True).stdout)
c11 = chapter(11, "Competitive landscape", "Others reach the buyer. Alodi starts with a meaningful tap and hands back typed context.", table([""] + comp["columns"], [[f"<b>{e(r['label'])}</b>"] + [e(c) for c in r["cells"]] for r in comp["rows"]], "comp") + note("Competitor figures are vendor claims from their own sites; not independently verified."))

c12 = chapter(12, "Roadmap", "From a stage demo to a national rollout.", table(["Phase", "When", "Content", "Exit criteria"], [
 ["MVP demo", "31 Oct 2026", "Four screens on mock data", "AC-01 to AC-15 pass in rehearsal"], ["Full build", "Nov 2026", "Server engine, real call audio, ≥ 200 eval samples", "Measured metrics on /metrics"],
 ["Shadow mode", "Q1 2027", "One area, real events, no buyer contact", "Agent vs CS decisions compared; thresholds tuned; DPIA done"], ["Controlled channels", "Q2 2027", "Real chat and GPT-Live-1 calls for risky orders", "0 rule violations; rescue rate measured"],
 ["Region", "H2 2027", "5–20 hubs", "Cost per case and latency on target"], ["National", "2028", "20–100 hubs, second region", "Break-even; 99.9% availability"],
]) + sub("12.1", "What a pilot needs from a carrier partner") + table(["Need", "Why", "When"], [
 ["One area: 20 shippers, about 4,000 orders a day", "Shadow mode compares agent and CS decisions on real events", "Q1 2027"],
 ["Routing and order APIs (read)", "Feasible windows and today’s orders", "Q1 2027"],
 ["Driver-app integration for the tap and the card", "The shipper never leaves the app they already use", "Q1 2027"],
 ["Shopee Chat API and approved Zalo ZNS templates", "Real buyer messages for risky orders", "Q2 2027"],
 ["A SIP trunk with a verified brand name", "Buyers answer calls they can identify", "Q2 2027"],
 ["OpenAI organisation access: GPT-Live-1, Decisions API, GPT-6.1 Terra", "The production stack", "Q1 2027"],
 ["CS time to label shadow-mode cases", "Ground truth for thresholds and evals", "Q1 2027"],
 ["Data protection impact and transfer assessments", "PDPL and Decree 53 before any buyer contact", "Before Q2 2027"],
]) + note("Source: PRD §26, §28."))

c13 = chapter(13, "Risks and assumptions", "What could make the numbers wrong, and what we do about it.", '<div class="cols2"><div>' + table(["Risk", "Mitigation"], [
 ["Buyers ignore unknown callers", "Chat first; verified brand name; call only after silence"], ["GPT-Live-1 Vietnamese quality unproven", "Test before the pilot; PhoWhisper and local fallback stay"],
 ["ASR mishears Vietnamese addresses", "Read-back confirmation; 0.85 threshold"], ["Wrong auto-applied appointment", "Threshold plus calibration; shipper can still call; audit log"],
 ["Wrong label harms a buyer", "Labels only by a person"], ["Cross-border personal data", "Masked text only; transfer impact assessment for call audio"],
 ["Mock numbers shown as results", "Labels mock, simulated, projected everywhere"],
]) + '</div><div>' + table(["Key assumption", "Status"], [["One area = 20 shippers, 4,000 orders a day", "Estimate; check with shipper interviews"], ["8% first-attempt failure", "VECOM low end · Sourced"], ["25% baseline rescue", "Shipsy · Vendor"], ["Alodi lifts rescue to 65%", "Projected; measured only in a pilot"], ["20% of LLM traffic escalated to Terra", "Estimate; measured in shadow mode"], ["₫26,000 = $1", "Estimate"]]) + '</div></div>' + note("Source: PRD §26, §27."))

c14 = chapter(14, "Team and project assets", "Team Develarper: four people, one agent, built with Codex.", table(["Name", "Role", "Focus"], [["Nomura Yoshio", "Team Lead · Project Presenter", "Team, demo script, pitch"], ["Long Quan Ton", "Product Manager · AI Engineer", "Product, research, voice agent"], ["Khanh Tuong Huynh", "Applied AI Software Engineer", "Context extractor, ASR, policy guard"], ["Thanh Loi Tran", "Data Engineer · Backend", "Order Context Object, APIs, metrics log"]]) + sub("14.1", "Project assets") + table(["Asset", "Where", "What it holds"], [
 ["Landing page, demo and dashboard", "web/", "Next.js app: landing, four-screen demo, hub dashboard, metrics"],
 ["Product requirements", "prep/02-technical/PRD.md", "Business analysis, UML, API, architecture, OpenAI stack, cost model, eval, risks"],
 ["Cost model", "prep/02-technical/cost-model/cost_model.py", "Every money figure in this report, with typed inputs"],
 ["Numbers proof", "alodi-numbers.pdf", "Formulas, inputs and sources for the loss and the savings"],
 ["Mock data pack", "prep/02-technical/mock-data/", "One fictional hub: 20 shippers, 4,000 orders, scenarios, eval samples"],
 ["Survey instrument", "prep/06-survey/", "Codebook in Vietnamese and English; response files"],
 ["Pitch deck and film", "prep/01-pitch/", "12-slide deck, two-minute demo film, scripts"],
 ["Brand kit and design system", "prep/03-design/, prep/04-brand/", "Tokens, components, logos, marks, fonts"],
]) + sub("14.2", "How we work") + "<p>Every change goes through a pull request with lint and build checks in CI. Codex helps specify, build and review; a person merges. Figures are generated from code (cost model, mock data, survey files), so the landing page, the deck and this report cannot drift apart.</p>")

SRC = [
 ("Shopee Return & Refund Policy §7.1–7.2", "Seller pays return shipping on failed orders; none when the carrier is at fault", "help.shopee.vn/portal/4/article/77251", "Verified 31 Oct 2026 (republished 30 Oct 2026, effective 6 Nov 2026; no amount stated)"),
 ("GHN, who pays for Shopee returns", "₫40,000 cap per order since 1 Apr 2025 (₫20,000 express)", "ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi", "Verified; secondary source"),
 ("Nguoi Lao Dong, 19 Jul 2025", "VECOM 8–12%, up to 20% remote; Tran Anh Tung 10–15%, 25–30% in sale season", "tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm", "Verified"),
 ("Shopee Help Center 79559 · 79569 · 79196", "No delivery-time choice · 2–3 contacts, 5 days · COD lock after 3 failures in 90 days", "help.shopee.vn/portal/4/article/…", "Verified"),
 ("GHN, shipper pay per order", "₫6,000–8,000 per delivered order (average)", "ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien", "Verified; not an official Shopee figure"),
 ("Shipsy, NDR management", "Industry rescue 20–30%, best-in-class 50–65%", "shipsy.ai/insights/what-is-ndr-non-delivery-report-management", "Verified; vendor claim"),
 ("Metric, e-commerce report 2025", "₫429.7T across four marketplaces; +34.75%", "via daibieunhandan.vn, vneconomy.vn", "Verified via press; single provider"),
 ("OpenAI, GPT-Live-1 model page", "gpt-live-1; v1/live/sessions; $0.05 a minute; delegates to a backend agent", "developers.openai.com/api/docs/models/gpt-live-1", "Verified 31 Oct 2026; languages not listed"),
 ("OpenAI, GPT-6.1 Terra model page", "gpt-6.1-terra; 1.05M context; $1 / $5 per 1M tokens; Responses API", "developers.openai.com/api/docs/models/gpt-6.1-terra", "Verified 31 Oct 2026"),
 ("OpenAI, Decisions API", "/v1/decisions on gpt-6-luna; predicate, choice, score questions; $0.10 per 1M input tokens", "openai.com/index/decisions-api · Vercel AI Gateway listing", "Verified via listings; official page not machine-readable"),
 ("OpenAI, gpt-oss-20b", "Runs within 16 GB with MXFP4", "Azure AI catalog · vLLM recipes", "Verified"),
 ("Glints, Phong Vu, Viettel reseller, oazns.vn, EVN", "Shipper income, GPU prices, SIP, ZNS and power tariffs", "see PRD §18.8", "Listed prices, checked by the team"),
]
c15 = chapter(15, "Sources and verification", "Every external figure, where it comes from, and how far we checked it.", table(["Source", "What we use", "Where", "Check"], [[f"<b>{e(a)}</b>", e(b), f"<span class=url>{e(c)}</span>", e(d)] for a, b, c, d in SRC], "src") + note("31 Oct 2026: ₫40,000 recited to Shopee §7.1 plus GHN; OpenAI stack and running cost updated."))

CSS = font_css + """
@page { size: A4; margin: 20mm 18mm 20mm;
  @bottom-left { content: "Alodi · Project report · v0.5"; font-family: 'Geist'; font-size: 7.5pt; color: #8a91a6; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: 'Geist'; font-size: 7.5pt; color: #8a91a6; }
  @top-right { content: "Team Develarper · 31 Oct 2026"; font-family: 'Geist'; font-size: 7.5pt; color: #b0b5c3; }
}
@page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } @top-right { content: none; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Geist', sans-serif; color: #1f2a44; font-size: 10pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
b { font-weight: 600; }
.cover { width: 210mm; height: 297mm; background: #121a2c; color: #f6f3f1; padding: 22mm 20mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.ev-sea { height: 11mm; display: block; }
.ctop { display: flex; justify-content: space-between; align-items: center; }
.ctop svg { height: 12mm; width: auto; }
.ey { font-size: 9pt; letter-spacing: .1em; text-transform: uppercase; color: #f05a00; font-weight: 600; }
h1 { font-family: 'Be Vietnam Pro'; font-size: 64pt; line-height: 1; letter-spacing: -0.04em; margin: 5mm 0 0; }
.tag { font-size: 20pt; margin: 3mm 0 0; color: #f6f3f1; } .abs { font-size: 11.5pt; color: #c9cfdc; max-width: 140mm; margin-top: 8mm; }
.meta { margin: 0; border-top: 1px solid rgba(255,255,255,.18); } .meta div { display: grid; grid-template-columns: 34mm 1fr; padding: 2.6mm 0; border-bottom: 1px solid rgba(255,255,255,.1); }
.meta dt { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #8a91a6; } .meta dd { margin: 0; font-size: 9.5pt; color: #e3e6ee; }
h2 { font-weight: 600; font-size: 20pt; letter-spacing: -0.02em; line-height: 1.15; margin: 9mm 0 2mm; padding-top: 4.5mm; border-top: 1.5px solid #1f2a44; break-after: avoid; }
h2 span { color: #f05a00; margin-right: 3mm; } h2.plain { border-top: 0; padding-top: 0; margin-top: 0; }
.front h2.plain:not(:first-child) { margin-top: 8mm; }
h3 { font-size: 11.5pt; font-weight: 600; margin: 5.5mm 0 2mm; break-after: avoid; } h3 span { color: #c94b00; margin-right: 2mm; font-weight: 500; }
h4 { margin: 0 0 2mm; font-size: 7.6pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7183; }
.lead { font-size: 12.5pt; line-height: 1.4; color: #4a5268; margin: 0 0 4.5mm; break-after: avoid; }
p { margin: 0 0 3mm; }
.toc { columns: 3; font-size: 11pt; padding-left: 5mm; margin: 2mm 0 0; line-height: 1.75; }
ul { padding-left: 5mm; margin: 0 0 3mm; } li { margin-bottom: 1.8mm; }
.cols { columns: 2; column-gap: 8mm; } .cols p, .cols li { break-inside: avoid; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; align-items: start; }
table { width: 100%; border-collapse: collapse; margin: 2.5mm 0 4mm; font-size: 9pt; break-inside: avoid; }
th { text-align: left; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7183; padding: 2mm 2.2mm; border-bottom: 1px solid #1f2a44; }
td { padding: 2mm 2.2mm; border-bottom: 1px solid #e6e2df; vertical-align: top; } td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tbody tr:nth-child(even) td { background: #faf8f6; }
table.comp { font-size: 8pt; } table.src, table.oa { font-size: 8.4pt; } .url { color: #6b7183; word-break: break-all; }
.note { font-size: 9pt; color: #6b7183; border-left: 2px solid #f05a00; padding-left: 3.5mm; margin: 3mm 0 4mm; }
.kf { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #1f2a44; border-bottom: 1px solid #e6e2df; margin: 3mm 0 5mm; break-inside: avoid; }
.cols2 .kf { grid-template-columns: 1fr 1fr; }
.kf div { padding: 3.2mm 3.2mm 3.2mm 0; } .kf div + div { padding-left: 3mm; border-left: 1px solid #e6e2df; }
.cols2 .kf div:nth-child(3) { border-left: 0; padding-left: 0; border-top: 1px solid #e6e2df; } .cols2 .kf div:nth-child(4) { border-top: 1px solid #e6e2df; }
.kf b { display: block; font-size: 19pt; font-weight: 500; letter-spacing: -0.02em; } .kf span { display: block; font-size: 9.6pt; margin-top: 1mm; } .kf i { display: block; font-style: normal; font-size: 8pt; color: #8a91a6; margin-top: 1mm; }
.steps8 { display: grid; grid-template-columns: repeat(4, 1fr); padding: 0; list-style: none; counter-reset: s; border-top: 1px solid #1f2a44; margin: 1mm 0 3mm; break-inside: avoid; }
.steps8 li { counter-increment: s; padding: 3mm 3.2mm 3mm 0; border-bottom: 1px solid #e6e2df; margin: 0; } .steps8 li::before { content: "0" counter(s); color: #f05a00; font-size: 7.6pt; font-weight: 600; display: block; }
.steps8 b { display: block; font-size: 10.6pt; } .steps8 span { font-size: 9.2pt; color: #6b7183; }
.arch { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 4mm; margin: 2mm 0 3mm; break-inside: avoid; }
.arch .col div { border: 1px solid #cecac8; border-radius: 2.5mm; padding: 2.4mm 3.2mm; margin-bottom: 1.8mm; font-size: 9pt; background: #fbf9f7; }
.arch .core { background: #121a2c; color: #f6f3f1; border-radius: 3.5mm; padding: 3.5mm; } .arch .core h4 { color: #f05a00; font-family: 'Be Vietnam Pro'; text-transform: none; font-size: 12pt; letter-spacing: -0.02em; }
.arch .core div { background: rgba(255,255,255,.07); border-radius: 2mm; padding: 2.3mm 3.2mm; margin-bottom: 1.8mm; font-size: 8.8pt; } .arch .core p { font-size: 7.6pt; color: #a7aec0; margin: 2mm 0 0; }
.ch { break-before: page; }
.ch > h2 { margin-top: 0; }
.status { font-size: 9.4pt; padding: 3.5mm 4mm; border-radius: 2.5mm; background: #e7f3ec; margin: 1mm 0 3mm; } .status.warn { background: #fbe3d4; }
"""

doc = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Alodi · Project report</title><style>{CSS}</style></head><body>{cover}{contents}{c1}{c2}{c3}{c4}{c5}{c6}{c7}{c8}{c9}{c10}{c11}{c12}{c13}{c14}{c15}</body></html>"
doc = doc.replace("courier", "shipper").replace("Courier", "Shipper")
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
