"""Build the Alodi project write-up (HTML → PDF): five pages in the project report's template.

Usage (from the repo root):
    python3 -I prep/02-technical/report/build_brief.py
Writes prep/02-technical/report/alodi-brief.pdf and copies it to submission/. Cover, three pages answering the judging
criteria, one page of sources. Money comes from cost_model.py; screenshots live in prep/02-technical/report/shots.
"""
import base64
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location("cost_model", ROOT / "prep/02-technical/cost-model/cost_model.py")
cm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cm)

R = cm.run()
MID = R["loss_mid"]
BEST = next(r for r in R["rows"] if (r["setup"], r["messaging"], r["scenario"]) == ("local_first", "risky_only", "best_in_class"))
AFTER = (round(MID / 1e6) - round(BEST["net_month"] / 1e6)) * 1e6  # rounded like the landing page and the deck
SUBMISSION = ROOT / "submission/Develarper_Alodi_Sea-OpenAI-Regional-Codex-Hackathon-2026_Brief.pdf"

# Flip to True once the team has confirmed the Codex section against how they actually used Codex.
CODEX_CONFIRMED = False


def m(v):
    return f"₫{v / 1e6:,.0f}M"


def shot(name):
    return (HERE / "shots" / f"{name}.png").as_uri()


def person(name):
    return (ROOT / f"web/public/people/{name}.svg").as_uri()


def kf(items):
    return '<div class="kf">' + "".join(f"<div><b>{v}</b><span>{l}</span></div>" for v, l in items) + "</div>"


def src(t):
    return f'<p class="src">Source: {t}</p>'


def head(n, title, crit):
    return f'<div class="hd"><h2><span>{n}</span>{title}</h2></div>'


LOGO = (ROOT / "prep/04-brand/logo/alodi-wordmark-on-navy.svg").read_text().split(">", 1)
LOGO = LOGO[0] + ">" + LOGO[1].replace('fill="#1F2A44"/>', 'fill="none"/>', 1)
FONTS = {"Geist": ROOT / "prep/01-pitch/charts/fonts/Geist.ttf", "BVP": ROOT / "prep/04-brand/fonts/BeVietnamPro-Medium.ttf"}
font_css = "\n".join(f"@font-face {{ font-family: '{k}'; src: url('{v.as_uri()}'); }}" for k, v in FONTS.items())

cover = f"""
<section class="cover">
  <div class="ctop"><span class="logo">{LOGO}</span></div>
  <div>
    <h1>Make the second<br><i>drop land.</i></h1>
    <p class="abs">Alodi is the agentic recovery system for last-mile delivery in Vietnam. One shipper tap starts chat and voice outreach, and the next attempt arrives knowing when, where and who. The model proposes, and backend rules decide what is applied.</p>
  </div>
  <img class="hero" src="{shot('start')}">
  <dl class="meta">
    <div><dt>Team</dt><dd>Develarper</dd></div>
    <div><dt>Result</dt><dd>Top 3 Overall</dd></div>
    <div><dt>Event</dt><dd>Sea × OpenAI Regional Codex Hackathon, Ho Chi Minh City, 31 October 2026</dd></div>
    <div><dt>Build direction</dt><dd>Autonomous &amp; Adaptive AI · Deep Domain AI</dd></div>
  </dl>
</section>"""

p2 = f"""
<section class="pg">
{head(1, "The problem", "Problem &amp; Solution Fit")}
<p class="lead">Delivery scheduling happens outside the system, and the failure context is lost with it.</p>
<p>Shopee does not let buyers select a delivery window, so scheduling depends on a phone call between buyer and shipper. When that call fails, the reason the delivery could not be completed is reduced to a single status code. The next attempt runs under the same conditions, and the return cost falls on the seller.</p>
{kf([("₫40,000", "return fee per failed order, paid by the seller"), ("8–12%", "of orders refused at the door, nationwide"), ("0", "delivery windows a Shopee buyer can choose"), ("≈ 5", "full-time callers an area needs to phone 320 buyers twice a day")])}
<div class="srv"><div class="sh"><b>Survey of buyers and shippers</b><span>Placeholder values until the interview export lands</span></div>
<div class="sg"><div><b>86%</b>of buyers want to choose a delivery window</div><div><b>66%</b>of buyers called back and couldn’t reach the shipper</div><div><b>27%</b>of shippers’ calls to buyers go unanswered</div><div><b>83%</b>of shippers would use an Alodi-like system</div></div>
<div class="sn">100 buyers · 12 shippers from 6 carriers</div></div>
<div class="loss"><div class="ll"><b>{m(MID)}</b> lost a month in one area of 20 shippers and 4,000 orders a day</div>
<div class="sb"><i style="flex:288;background:#f05a00"></i><i style="flex:101;background:#1f2a44"></i><i style="flex:45;background:#7d8fb5"></i><i style="flex:39;background:#c9d4ea"></i></div>
<div class="lg"><span><i style="background:#f05a00"></i>Return fees ₫288M</span><span><i style="background:#1f2a44"></i>Redelivery pay ₫101M</span><span><i style="background:#7d8fb5"></i>CS call-backs ₫45M</span><span><i style="background:#c9d4ea"></i>Door time ₫39M</span></div></div>
{src("Shopee Return &amp; Refund Policy §7.1; GHN; VECOM via Nguoi Lao Dong, 19 Jul 2025; Shopee Help Center 79559; team cost model (modelled).")}
{head(2, "The solution", "Problem &amp; Solution Fit")}
<p class="lead">One tap in. One context card out.</p>
<ol class="flow">
<li><b>Tap</b><span>No answer, Rescheduled or Refused</span></li>
<li><b>Reach</b><span>Chat at once; a voice call if silent, 08:00–20:30 only</span></li>
<li><b>Understand</b><span>The answer becomes when, where and who</span></li>
<li><b>Decide</b><span>Clear answers apply; the rest goes to a person</span></li>
<li><b>Redeliver</b><span>The next attempt carries the card</span></li>
</ol>
<figure class="fit"><img src="{shot('demo')}"><figcaption>The rescue from the judges’ demo: shipper’s app, buyer’s call and operations, in sync.</figcaption></figure>
</section>"""

confirm = "" if CODEX_CONFIRMED else '<div class="status"><b>Draft.</b> The team confirms this section against what actually happened, then removes this line.</div>'

p3 = f"""
<section class="pg">
{head(3, "The product", "Build Quality")}
<p class="lead">Three working surfaces on one rescue workflow.</p>
<div class="g2"><figure><img src="{shot('console')}"><figcaption>Hub dashboard, on a simulated day: pipeline by business step, failures by hour, policy guard.</figcaption></figure>
<figure><img src="{shot('live')}"><figcaption>Live stage, ready to start: the shipper uses a real phone; customer, dashboard and agent run sync here.</figcaption></figure></div>
<div class="g2 r2"><figure><img src="{shot('integrated')}"><figcaption>Backend workspace: real orders, business timers, calls issued by policy, and the order’s evidence.</figcaption></figure>
<div class="tile rules"><b>Hard rules, enforced in code</b><ul><li>Calls only 08:00–20:30</li><li>At most two calls a cycle</li><li>Applies alone only at confidence ≥ 0.85</li><li>“Stop” ends all contact</li><li>Shippers can undo a tap for 2 minutes</li><li>A person approves every label and return</li></ul></div></div>
<table><thead><tr><th>Component</th><th>What runs today</th></tr></thead><tbody>
<tr><td><b>Workflow backend</b></td><td>FastAPI and SQLite with migrations: morning availability, shipper outcomes, rescue policy, customer-service decisions and a durable scheduler that survives restarts, on 4,000 synthetic orders. <b>255 automated tests pass</b>, with AI providers simulated, and CI checks every change.</td></tr>
<tr><td><b>End-to-end path</b></td><td>On the running backend: a No answer tap opens a rescue case, the 60-minute timer fires, and the policy-checked call is issued.</td></tr>
<tr><td><b>Voice and memo</b></td><td>GPT-Live-1 over WebRTC, GPT Transcribe and GPT-6.1 Terra extraction, with consent gates, a 180-second call cap and memo limits. Stub and live modes.</td></tr>
<tr><td><b>Interfaces</b></td><td>Landing, a judges’ demo with a scripted scenario, an SPX-style dashboard on mock operational data, and the live stage with its shipper phone screen, whose backend connection is the next step.</td></tr>
</tbody></table>
{head(4, "What is different", "Insight &amp; Originality")}
<div class="g3">
<div class="tile"><b>Context, not routing</b><p>Route optimisers fix the path. The failure sits in a phone call. Alodi captures what that call loses and gives it to the next attempt.</p></div>
<div class="tile"><b>The tap is the trigger</b><p>ClickPost and Shipsy start from a carrier NDR code. Alodi starts from a shipper’s one meaningful tap, so each path gets the right response.</p></div>
<div class="tile"><b>A hard line in code</b><p>The agent asks and calls. Refusals, labels and returns go to a person. Hours, contact limits and the 0.85 threshold sit in code, not in a prompt.</p></div>
</div>
</section>"""

STACK = [
    ("GPT-Live-1", "Natural voice calls that listen while speaking and hand reasoning to the agent", "v1/live/sessions", "In this build"),
    ("GPT-6.1 Terra", "Orchestrates each case under policy and writes the card with Structured Outputs", "v1/responses", "In this build"),
    ("GPT Transcribe", "Turns the shipper’s 10-second memo into text", "v1/audio/transcriptions", "In this build"),
    ("Decisions API on GPT-6 Luna", "Triages every message cheaply: which case, which window, how sure", "v1/decisions", "Production"),
    ("Agents SDK and Evals", "Tools, handoffs and traces; held-out evals gate every prompt or model change", "Responses API", "Production"),
    ("gpt-oss-20b", "Offline fallback on the area server when the network drops", "Local", "Production"),
]
stack_rows = "".join(f"<tr><td><b>{a}</b></td><td>{b}</td><td class=ep>{c}</td><td><span class=\"tag {'on' if d != 'Production' else ''}\">{d}</span></td></tr>" for a, b, c, d in STACK)
W_AFTER = AFTER / MID * 100

p4 = f"""
<section class="pg">
{head(5, "OpenAI at the core", "Build Quality")}
<table><thead><tr><th>Model or API</th><th>Job in production</th><th>Endpoint</th><th>Status</th></tr></thead><tbody>{stack_rows}</tbody></table>
<p class="cap">The OpenAI API costs about ₫7.2M a month for one area in our cost model. Names, phones and house numbers are masked before text reaches a model.</p>
{head(6, "Who benefits, and how much", "Real-World Value")}
<div class="g2 val">
<div class="panel"><div class="pl">Saved a month, one area · projected</div><div class="pn hl">{m(BEST['net_month'])}</div>
<div class="cl">Lost today <b>{m(MID)}</b></div><div class="cb"><i style="width:100%;background:#1f2a44"></i></div>
<div class="cl">With Alodi <b>{m(AFTER)}</b></div><div class="cb"><i style="width:{W_AFTER:.1f}%;background:#1f2a44"></i><i style="flex:1;background:#f05a00;margin-left:2px"></i></div>
<p>{BEST['net_pct']:.0%} of the loss, after {m(BEST['cost_month'])} running cost, at a best-in-class rescue rate.</p></div>
<div class="panel"><div class="pl">From answer to card · target</div><div class="pn">&lt; 10 s</div>
<div class="cl">0 s <b>10 s</b></div><div class="cb"><i style="width:100%;background:#1f2a44"></i></div>
<div class="who"><span><img src="{person('shipper')}"><b>Shippers</b> skip repeat trips</span><span><img src="{person('buyer')}"><b>Buyers</b> are asked, not chased</span><span><img src="{person('seller')}"><b>Sellers</b> pay fewer return fees</span><span><img src="{person('ops')}"><b>Carriers</b> scale without callers</span></div></div>
</div>
{src("Team cost model, numbers PDF; Shipsy rescue range (vendor claim). Not yet measured in a pilot.")}
<div class="g2 low">
<div>{head(7, "Build direction", "Alignment")}
<p><b>Autonomous &amp; Adaptive AI:</b> an operations agent runs a rescue without a dispatcher, adapts to silence, restarts and unclear answers, and escalates when it should not act alone.</p>
<p><b>Deep Domain AI:</b> shipper outcomes, route cut-offs, Shopee’s 2–3 contacts in 5 days and calling hours shape every decision.</p>
<p class="next"><b>Next:</b> full build Nov 2026 · shadow mode at one area Q1 2027 · real channels Q2 · region H2 · national 2028.</p></div>
<div>{head(8, "How we used Codex", "Use of Codex")}
{confirm}
<ul class="cx"><li><b>Specify:</b> PRD and rules into scripts and acceptance checks</li><li><b>Build:</b> pair-programming on workflow, voice and interface code</li><li><b>Review:</b> pull requests checked by lint, build and test CI; a person merges</li><li><b>Evaluate:</b> one change a round, kept only if held-out F1 rises, target ≥ 0.90</li></ul></div>
</div>
</section>"""

SOURCES = [
    ("Shopee Return &amp; Refund Policy §7.1", "Seller pays return shipping on failed orders", "help.shopee.vn/portal/4/article/77251"),
    ("GHN, who pays return shipping", "₫40,000 cap per order since 1 Apr 2025", "ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi"),
    ("Nguoi Lao Dong, 19 Jul 2025", "VECOM: 8–12% of orders refused nationwide", "tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm"),
    ("Shopee Help Center 79559", "No specific delivery time can be chosen", "help.shopee.vn/portal/4/article/79559"),
    ("Shopee Help Center 79569", "2–3 contact attempts, reschedule within 5 days", "help.shopee.vn/portal/4/article/79569"),
    ("GHN, shipper pay per order", "₫6,000–8,000 per delivered order", "ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien"),
    ("Shipsy, NDR management", "Rescue 20–30% industry, 50–65% best-in-class (vendor claim)", "shipsy.ai/insights/what-is-ndr-non-delivery-report-management"),
    ("OpenAI, GPT-Live-1", "v1/live/sessions; $0.05 a minute", "developers.openai.com/api/docs/models/gpt-live-1"),
    ("OpenAI, GPT-6.1 Terra", "Responses API; $1 / $5 per 1M tokens", "developers.openai.com/api/docs/models/gpt-6.1-terra"),
    ("OpenAI, Decisions API", "v1/decisions on gpt-6-luna; $0.10 per 1M input tokens", "openai.com/index/decisions-api"),
    ("Team cost model", "One area: every input, formula and result", "Numbers PDF, submitted with this write-up"),
    ("Alodi project report", "Full design, data, privacy, competitors and roadmap", "Report PDF, submitted with this write-up"),
    ("Competitor comparison", "ClickPost, Shipsy and others, from public product pages", "Report PDF, chapter 11"),
    ("Notionists by Zoish", "Illustrated people in the product (CC0)", "dicebear.com/styles/notionists"),
]
TEAM = [("nomura-yoshio", "Nomura Yoshio", "Team Lead<br>Project Presenter"), ("long-quan-ton", "Long Quan Ton", "Product Manager<br>AI Engineer"), ("khanh-tuong-huynh", "Khanh Tuong Huynh", "Applied AI<br>Software Engineer"), ("thanh-loi-tran", "Thanh Loi Tran", "Data Engineer<br>Backend Developer")]


def portrait(k):
    return (HERE / "portraits" / f"{k}.jpg").as_uri()


p5 = f"""
<section class="pg last">
<div class="hd"><h2>Sources</h2></div>
<table class="srct"><thead><tr><th>Source</th><th>What we use</th><th>Where</th></tr></thead><tbody>
{''.join(f'<tr><td><b>{a}</b></td><td>{b}</td><td class=ep>{c}</td></tr>' for a, b, c in SOURCES)}
</tbody></table>
<p class="cap"><b>How to read our numbers.</b> Sourced figures come from the public documents above, checked 31 October 2026. Survey values are placeholders until the interview export lands. The monthly loss is modelled from them with stated assumptions. Savings are projected until a pilot measures them, and ten seconds is a target. Dashboard figures in the screenshots are simulated.</p>
<div class="hd" style="margin-top:3mm"><h2>Team Develarper</h2></div>
<div class="team">{''.join(f'<div><img src="{portrait(k)}"><b>{n}</b><span>{r}</span></div>' for k, n, r in TEAM)}</div>
</section>"""

CSS = font_css + """
@page { size: A4; margin: 13mm 15mm 14mm;
  @bottom-left { content: url("__FOOT_LOGO__"); vertical-align: middle; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: 'Geist'; font-size: 8pt; color: #5a6173; }
}
@page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Geist', sans-serif; color: #1f2a44; font-size: 10.4pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
b { font-weight: 600; }
p { margin: 0 0 2.2mm; }
.cover { width: 210mm; height: 297mm; background: #121a2c; color: #f6f3f1; padding: 18mm 18mm 15mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
.ctop { display: flex; justify-content: space-between; align-items: center; } .ctop svg { height: 12mm; width: auto; display: block; }
.ey { font-size: 9pt; letter-spacing: .1em; text-transform: uppercase; color: #ff7a2e; font-weight: 600; }
h1 { font-family: 'BVP'; font-weight: 400; font-size: 46pt; line-height: 1.06; letter-spacing: -.03em; margin: 0; } h1 i { font-style: normal; color: #ff7a2e; }
.abs { font-size: 13pt; line-height: 1.42; color: #dfe3ec; margin: 5mm 0 0; }
.hero { width: 100%; border-radius: 3.5mm; display: block; }
.meta { margin: 0; border-top: 1px solid rgba(255,255,255,.25); } .meta div { display: grid; grid-template-columns: 36mm 1fr; padding: 2.4mm 0; border-bottom: 1px solid rgba(255,255,255,.14); }
.meta dt { font-size: 8.4pt; text-transform: uppercase; letter-spacing: .06em; color: #aeb5c6; } .meta dd { margin: 0; font-size: 10pt; color: #f6f3f1; }
.pg { break-after: page; } .pg.last { break-after: auto; }
.hd { display: flex; justify-content: space-between; align-items: baseline; border-top: 1.5px solid #1f2a44; padding-top: 2.4mm; margin: 4.6mm 0 1.4mm; break-after: avoid; } .pg > .hd:first-child { margin-top: 0; }
h2 { font-weight: 600; font-size: 16pt; letter-spacing: -.02em; line-height: 1.15; margin: 0; } h2 span { color: #e25400; margin-right: 2.5mm; }
.hd em { font-style: normal; font-size: 8.4pt; font-weight: 600; color: #c94b00; background: #fff1e7; padding: .6mm 2.4mm; border-radius: 3mm; white-space: nowrap; }
.lead { font-size: 12.5pt; line-height: 1.3; color: #3a4358; margin: 0 0 2.2mm; }
.kf { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #1f2a44; border-bottom: 1px solid #d5d9e2; margin: 2.5mm 0; }
.kf div { padding: 2.4mm 2.6mm 2.4mm 0; } .kf div + div { padding-left: 2.6mm; border-left: 1px solid #d5d9e2; }
.kf b { display: block; font-size: 18pt; font-weight: 500; letter-spacing: -.02em; white-space: nowrap; } .kf span { display: block; font-size: 9.4pt; line-height: 1.32; margin-top: .8mm; }
.srv { background: #f6f3f1; border-radius: 2.2mm; padding: 2.2mm 3mm; font-size: 9.4pt; line-height: 1.3; }
.sh { display: flex; justify-content: space-between; align-items: baseline; font-size: 10.2pt; } .sh span { font-size: 8.4pt; color: #4a556e; }
.sg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 1.2mm; } .sg b { display: block; font-size: 17pt; font-weight: 500; color: #e25400; }
.sn { font-size: 8.4pt; color: #4a556e; margin-top: 1mm; }
.fit img { height: 70mm; object-fit: cover; object-position: top; }
.loss { margin-top: 2.4mm; } .ll { font-size: 10.6pt; } .ll b { font-size: 13pt; color: #e25400; }
.sb { display: flex; gap: 1px; height: 6mm; margin-top: 1.6mm; border-radius: 1.2mm; overflow: hidden; } .sb i { display: block; }
.lg { display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 9.2pt; margin-top: 1.4mm; } .lg i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; margin-right: 1.2mm; vertical-align: -.2mm; }
.src { font-size: 8.4pt; line-height: 1.35; color: #4a556e; margin: 1.6mm 0 0; }
.cap { font-size: 9.6pt; color: #3a4358; margin: 1.8mm 0 0; }
.flow { list-style: none; counter-reset: s; display: grid; grid-template-columns: repeat(5, 1fr); padding: 0; margin: 0 0 2.6mm; border-top: 1px solid #1f2a44; border-bottom: 1px solid #d5d9e2; }
.flow li { counter-increment: s; padding: 2mm 2.4mm 2.2mm 0; } .flow li + li { padding-left: 2.4mm; border-left: 1px solid #d5d9e2; }
.flow li::before { content: "0" counter(s); color: #c94b00; font-size: 8pt; font-weight: 600; display: block; } .flow b { display: block; font-size: 11pt; } .flow span { display: block; font-size: 9.2pt; line-height: 1.3; }
figure { margin: 0; } figure img { width: 100%; display: block; border-radius: 2.2mm; border: 1px solid #d5d9e2; } figcaption { font-size: 8.8pt; line-height: 1.3; color: #3a4358; margin-top: 1.2mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.6pt; line-height: 1.36; margin: 1.5mm 0 0; }
th { text-align: left; font-weight: 600; font-size: 8.2pt; text-transform: uppercase; letter-spacing: .04em; color: #4a556e; padding: 1.2mm 2mm 1.2mm 0; border-bottom: 1px solid #1f2a44; }
td { padding: 1.6mm 2.4mm 1.6mm 0; border-bottom: 1px solid #e3e5ea; vertical-align: top; } td:first-child { white-space: nowrap; }
.ep { font-size: 8.8pt; color: #3a4358; }
.tag { display: inline-block; font-size: 8pt; font-weight: 600; padding: .3mm 2mm; border-radius: 2mm; background: #e9eef8; white-space: nowrap; } .tag.on { background: #fff1e7; color: #c94b00; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; } .g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 1.5mm; }
.tile { background: #f6f3f1; border-radius: 2.4mm; padding: 3mm 3.4mm; font-size: 9.8pt; line-height: 1.38; } .tile b { display: block; font-size: 11pt; margin-bottom: 1mm; } .tile p { margin: 0; }
.panel { border: 1px solid #d5d9e2; border-radius: 2.6mm; padding: 3.2mm 4mm; } .panel p { font-size: 9.4pt; margin: 1.6mm 0 0; }
.pl { font-size: 8.4pt; text-transform: uppercase; letter-spacing: .05em; color: #4a556e; } .pn { font-size: 27pt; font-weight: 500; letter-spacing: -.03em; line-height: 1.15; margin-bottom: 1mm; } .hl { color: #e25400; }
.cl { display: flex; justify-content: space-between; font-size: 9.2pt; margin-top: 1mm; } .cl b { font-weight: 600; } .cb { display: flex; height: 4mm; margin-top: .6mm; } .cb i { display: block; border-radius: .8mm; }
.who { display: grid; grid-template-columns: 1fr; gap: 1mm; margin-top: 2mm; font-size: 9.3pt; } .who span { display: flex; align-items: center; gap: 1.6mm; } .who img { width: 6mm; height: 6mm; border-radius: 50%; } .who b { margin-right: -.6mm; }
.r2 { margin-top: 3mm; } .rules ul { margin: 1mm 0 0; padding-left: 4mm; } .rules li { margin-bottom: 1.2mm; } .tile.rules { font-size: 10.4pt; }
.low .hd { margin-top: 3.4mm; } .low p { font-size: 9.7pt; line-height: 1.38; margin-bottom: 1.5mm; } .next { color: #3a4358; }
.cx { padding-left: 4mm; margin: 1mm 0 0; font-size: 9.7pt; line-height: 1.36; } .cx li { margin-bottom: .8mm; }
.status { font-size: 8.8pt; padding: 1.2mm 2.4mm; border-radius: 1.6mm; background: #fbe3d4; margin: 1mm 0; line-height: 1.3; }
.srct td:first-child { white-space: normal; width: 50mm; } .srct td:nth-child(2) { width: 62mm; } .ep { word-break: break-word; }
.team { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 2.5mm; } .team img { width: 27mm; height: 27mm; object-fit: cover; border-radius: 2.4mm; display: block; } .team b { display: block; margin-top: 1.4mm; font-size: 10.6pt; } .team span { font-size: 9.2pt; color: #3a4358; line-height: 1.25; display: block; }
"""

FOOT_LOGO = (ROOT / "prep/04-brand/logo/alodi-wordmark-navy.svg").read_text().replace('width="563" height="244"', 'width="60" height="26"').encode()
CSS = CSS.replace("__FOOT_LOGO__", "data:image/svg+xml;base64," + base64.b64encode(FOOT_LOGO).decode())
doc = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Alodi · Project write-up</title><style>{CSS}</style></head><body>{cover}{p2}{p3}{p4}{p5}</body></html>"
out_html = HERE / "alodi-brief.html"
out_pdf = HERE / "alodi-brief.pdf"
out_html.write_text(doc, encoding="utf-8")
chrome = next((p for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("google-chrome"), shutil.which("chromium")] if p and Path(p).exists()), None)
if not chrome:
    sys.exit(f"Wrote {out_html}; install Chrome to print the PDF.")
subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", out_html.as_uri()], check=True, capture_output=True)
shutil.copy(out_pdf, SUBMISSION)
out_html.unlink()  # holds absolute local paths; the PDF is the artefact
print(out_pdf)
