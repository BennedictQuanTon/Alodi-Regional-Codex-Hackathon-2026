"""Build the Alodi numbers proof (HTML → PDF): every figure on the landing page, with its formula, inputs and source.

Usage (from the repo root):
    python3 -I prep/02-technical/cost-model/build_proof.py
Renders an HTML page, prints it to prep/02-technical/cost-model/alodi-numbers.pdf with headless Chrome
and copies the PDF to web/public/alodi-numbers.pdf. All numbers come from cost_model.py and the mock-data pack,
so the document can never drift from the model.
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
spec = importlib.util.spec_from_file_location("cost_model", HERE / "cost_model.py")
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


def m(v, d=1):
    return f"₫{v / 1e6:,.{d}f}M"


def e(s):
    return html.escape(str(s))


def read_csv(p):
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------- survey
shippers = read_csv(ROOT / "prep/06-survey/couriers.csv")
customers = read_csv(ROOT / "prep/06-survey/customers.csv")
summary = read_csv(ROOT / "prep/06-survey/summary_MOCK.csv")
codebook = read_csv(ROOT / "prep/06-survey/codebook.csv")
status = Counter(r["data_status"] for r in shippers + customers)
companies = Counter(r["company"] for r in shippers)
segments = Counter(r["persona_segment"] for r in customers)
KEY_Q = ["q01_courier_called_while_busy", "q02_missed_courier_call", "q03_called_back_courier_unreachable", "q06_had_to_remind_courier",
         "q10_want_to_choose_window", "q12_ok_with_automated_call", "q16_would_use_alodi_like_service",
         "q01_calls_to_buyers_per_day", "q02_unanswered_call_pct", "q12_would_like_alodi_like_system",
         "q13_expected_minutes_saved_per_day"]
questions = [q for k in KEY_Q for q in codebook if q["column"] == k]
is_placeholder = status.get("REAL", 0) == 0

# ---------------------------------------------------------------- inputs table
INPUTS = [
    ("Orders a day, one area", f"{cm.ORDERS_PER_DAY:,}", "Estimate", "Team sizing: 20 shippers × 200 stops"),
    ("First-attempt failure rate", f"{cm.FAIL_RATE:.0%}", "Sourced", "VECOM 8–12% nationwide, low end (Nguoi Lao Dong, 19 Jul 2025)"),
    ("Rescued today (baseline)", f"{cm.BASELINE_RESCUE:.0%}", "Vendor", "Shipsy: industry rescue rate 20–30%"),
    ("Return fee per failed order", f"₫{cm.RETURN_FEE:,}", "Sourced", "Shopee Return & Refund Policy §7.1 (seller pays on failed orders); cap ₫40,000 since 1 Apr 2025, GHN"),
    ("Extra attempts per failed order", f"{cm.EXTRA_ATTEMPTS}", "Estimate", "Inside Shopee’s 2–3 contact attempts (Help Center 79569)"),
    ("Shipper pay per attempt", "₫6,000–8,000", "Sourced", "GHN blog, shipper earnings per order"),
    ("Shipper income a month", "₫8–15M", "Sourced", "Glints Vietnam, full-time shipper income"),
    ("Shipper hours a month", f"{cm.COURIER_HOURS_MONTH}", "Estimate", "26 days × 9 hours"),
    ("Door time lost per failure", f"{cm.DOOR_MIN_PER_FAIL} min", "Estimate", "Two calls plus waiting at the door"),
    ("CS calls per failure × minutes", f"{cm.CS_CALLS_PER_FAIL} × {cm.CS_MIN_PER_CALL} min", "Estimate", "Team assumption"),
    ("CS cost per hour", f"₫{cm.CS_COST_HOUR:,}", "Estimate", "Team assumption"),
    ("Days a month · exchange rate", f"{cm.DAYS} · ₫{cm.FX:,}/$", "Estimate", "Prices checked 31 Oct 2026"),
]

failed = L["failed_per_day"]
returned = L["returned_per_day"]
items = L["items"]
LOSS_LINES = [
    ("Return fees paid by sellers", f"{failed:.0f} failed × 75% not rescued = {returned:.0f}/day × ₫40,000 × 30", items["Return fees paid by sellers"]),
    ("Shipper pay for redelivery", f"{failed:.0f} × {cm.EXTRA_ATTEMPTS} attempts × ₫6,000–8,000 × 30", items["Shipper pay for redelivery attempts"]),
    ("Shipper time at unanswered doors", f"{failed:.0f} × {cm.DOOR_MIN_PER_FAIL} min × (₫8–15M ÷ {cm.COURIER_HOURS_MONTH} h) × 30", items["Shipper time lost when the buyer doesn't answer"]),
    ("CS calling buyers back", f"{failed:.0f} × {cm.CS_CALLS_PER_FAIL} calls × {cm.CS_MIN_PER_CALL} min × ₫35,000/h × 30", items["Hub / CS staff calling buyers back"]),
]


def rng(v):
    lo, hi = v
    return m(lo) if abs(lo - hi) < 1 else f"{m(lo)}–{m(hi)}"


SAVE_FORMULA = {
    "Return fees avoided": "320 × extra rescue points × ₫40,000 × 30",
    "Redelivery attempts avoided": "320 × (1.5 − attempts after) × ₫7,000 × 30",
    "Shipper door time saved": "attempts saved × 5 min × ₫49k/h × 30",
    "CS calls handled by the agent": "320 × 2 × 4 min × ₫35,000/h × agent share × 30",
}

# ---------------------------------------------------------------- html
LOGO = (ROOT / "prep/04-brand/logo/alodi-wordmark-navy.svg").read_text()
LOGO_WHITE = (ROOT / "prep/04-brand/logo/alodi-wordmark-white.svg").read_text()
FONTS = {
    "Geist": ROOT / "prep/01-pitch/charts/fonts/Geist.ttf",
    "Be Vietnam Pro": ROOT / "prep/04-brand/fonts/BeVietnamPro-ExtraBold.ttf",
}
font_css = "\n".join(f"@font-face {{ font-family: '{k}'; src: url('{v.as_uri()}'); }}" for k, v in FONTS.items())
TOTAL_PAGES = 8


def page(n, title, body, dark=False):
    foot = "" if n == 1 else f'<footer><span class="mini">{LOGO}</span><span>The numbers behind Alodi · {e(title)}</span><span>{n} / {TOTAL_PAGES}</span></footer>'
    return f'<section class="page{" dark" if dark else ""}">{body}{foot}</section>'


def tag(t):
    return f'<span class="tag t-{t.lower().replace(" ", "-")}">{e(t)}</span>'


cover = page(1, "Cover", f"""
<div class="cover-top"><span class="logo">{LOGO_WHITE}</span><span class="mono dim">Team Develarper · Sea × OpenAI Regional Codex Hackathon · 31 Oct 2026</span></div>
<div class="cover-mid">
  <div class="mono orange">Proof document</div>
  <h1>The numbers<br>behind Alodi</h1>
  <p class="lead">How one area of 20 shippers and 4,000 orders a day loses {m(MID, 0)} a month to failed deliveries,
  and how Alodi cuts {BEST['net_pct']:.0%} of it. Every input, formula and source, in one place.</p>
</div>
<div class="kpis">
  <div><b>{m(MID, 0)}</b><span>lost a month today<br>modelled</span></div>
  <div><b>{m(BEST['gross_month'], 0)}</b><span>recovered a month<br>projected</span></div>
  <div><b>{m(BEST['cost_month'], 0)}</b><span>running cost a month<br>estimate</span></div>
  <div class="hi"><b>{m(BEST['net_month'], 0)}</b><span>net saving, {BEST['net_pct']:.0%}<br>projected</span></div>
</div>
<div class="legend mono dim">Labels · <b>Sourced</b> public document · <b>Vendor</b> company claim · <b>Listed price</b> shop or price list · <b>Estimate</b> team assumption · <b>Projected</b> not yet measured</div>
""", dark=True)

inputs = page(2, "Inputs", f"""
<div class="eyebrow">01 · Inputs</div><h2>Twelve inputs. Each one typed.</h2>
<p class="sub">Every later number is arithmetic on this table. Change an input in <code>cost_model.py</code> and the whole document regenerates.</p>
<table><thead><tr><th>Input</th><th class="r">Value</th><th>Type</th><th>Source</th></tr></thead><tbody>
{''.join(f'<tr><td>{e(a)}</td><td class="r num">{e(b)}</td><td>{tag(c)}</td><td class="src">{e(d)}</td></tr>' for a, b, c, d in INPUTS)}
</tbody></table>
<div class="note">Not counted, so the loss is conservative: the seller’s lost sale, packaging, ad spend, damaged goods, and buyers losing COD after three failed orders in 90 days (Shopee Help Center 79196).</div>
""")

loss = page(3, "Loss", f"""
<div class="eyebrow">02 · What one area loses</div><h2>{rng(L['total'])} a month. Midpoint {m(MID, 1)}.</h2>
<p class="sub">{cm.ORDERS_PER_DAY:,} orders × {cm.FAIL_RATE:.0%} = <b>{failed:.0f} failed a day</b>. Shipsy’s 25% baseline rescues {failed - returned:.0f}; <b>{returned:.0f} go back</b> to the seller.</p>
<div class="steps">
{''.join(f'<div class="step"><div class="k">{e(a)}</div><div class="f mono">{e(b)}</div><div class="v num">{rng(c)}</div></div>' for a, b, c in LOSS_LINES)}
<div class="step total"><div class="k">Total a month</div><div class="f mono">sum of the four lines · midpoint = (low + high) ÷ 2</div><div class="v num">{rng(L['total'])}</div></div>
</div>
<div class="grid2">
  <div class="box"><div class="mono dim">A year</div><b class="big">≈ ₫{MID * 12 / 1e9:.1f}B</b><p>Midpoint × 12.</p></div>
  <div class="box"><div class="mono dim">At VECOM’s 12% upper rate</div><b class="big">≈ {m(L['total'][0] * 1.5, 0)}–{m(L['total'][1] * 1.5, 0)}</b><p>Every line scales by 1.5×. The headline keeps the low end.</p></div>
</div>
""")

cost_rows = "".join(f'<tr><td>{e(k)}</td><td class="r num">{m(v, 2)}</td></tr>' for k, v in BEST["cost_items"].items())
hw_rows = "".join(f'<tr><td>{e(k)}</td><td class="r num">{m(v[0], 1)}–{m(v[1], 1)}</td></tr>' for k, v in cm.HARDWARE.items())
running = page(4, "Cost", f"""
<div class="eyebrow">03 · What Alodi costs</div><h2>{m(BEST['cost_month'], 1)} a month to run. {BEST['cost_month'] / MID:.1%} of the loss.</h2>
<p class="sub">Local-first: one workstation per area runs PhoWhisper and the gpt-oss-20b fallback. GPT-Live-1, the Decisions API on GPT-6 Luna and GPT-6.1 Terra run in the cloud, on masked text.</p>
<table><thead><tr><th>Monthly running cost</th><th class="r">VND</th></tr></thead><tbody>{cost_rows}
<tr class="sum"><td>Total</td><td class="r num">{m(BEST['cost_month'], 1)}</td></tr></tbody></table>
<table><thead><tr><th>One-time hardware per area (not in the monthly figures)</th><th class="r">VND</th></tr></thead><tbody>{hw_rows}
<tr class="sum"><td>Total</td><td class="r num">{m(R['hardware_one_time'][0], 1)}–{m(R['hardware_one_time'][1], 1)}</td></tr></tbody></table>
<div class="note">For comparison, the AWS-managed design runs at {m(AWS['cost_month'], 1)} a month, so local-first is about {1 - BEST['cost_month'] / AWS['cost_month']:.0%} cheaper.</div>
""")

sc = [("Conservative", CONS, "15 pts · 1.50 · 40%"), ("Base", BASE, "20 pts · 1.35 · 60%"), ("Best-in-class", BEST, "40 pts · 1.20 · 65%")]
save_rows = "".join(
    f'<tr><td>{e(k)}<div class="f mono">{e(SAVE_FORMULA[k])}</div></td>' + "".join(f'<td class="r num{" hl" if i == 2 else ""}">{m(r["saving_items"][k], 1)}</td>' for i, (_, r, _) in enumerate(sc)) + "</tr>"
    for k in BEST["saving_items"]
)
savings = page(5, "Savings", f"""
<div class="eyebrow">04 · What Alodi saves</div><h2>{m(BEST['net_month'], 1)} net a month = {BEST['net_pct']:.1%} of the loss.</h2>
<p class="sub">The headline assumes today’s 25% rescue rate rises to 65%, the top of Shipsy’s published best-in-class range (vendor, 50–65%). Base and conservative cases are shown next to it.</p>
<table class="sc"><thead><tr><th>Saving item · formula</th>{''.join(f'<th class="r">{e(n)}<div class="f mono">{e(a)}</div></th>' for n, _, a in sc)}</tr></thead><tbody>
{save_rows}
<tr class="sum"><td>Gross saving a month</td>{''.join(f'<td class="r num">{m(r["gross_month"], 1)}</td>' for _, r, _ in sc)}</tr>
<tr><td>− Running cost</td>{''.join(f'<td class="r num">{m(r["cost_month"], 1)}</td>' for _, r, _ in sc)}</tr>
<tr class="sum"><td>Net saving a month</td>{''.join(f'<td class="r num{" hl" if i == 2 else ""}">{m(r["net_month"], 1)}</td>' for i, (_, r, _) in enumerate(sc))}</tr>
<tr><td>Net ÷ monthly loss ({m(MID, 1)})</td>{''.join(f'<td class="r num">{r["net_pct"]:.1%}</td>' for _, r, _ in sc)}</tr>
<tr><td>Net a year</td>{''.join(f'<td class="r num">₫{r["net_year"] / 1e9:.2f}B</td>' for _, r, _ in sc)}</tr>
<tr><td>Hardware pays back in</td>{''.join(f'<td class="r num">{r["hardware_payback_months"] * 4.35:.0f} weeks</td>' for _, r, _ in sc)}</tr>
</tbody></table>
<div class="calc mono">{BEST['net_pct']:.1%} = {m(BEST['net_month'], 1)} ÷ {m(MID, 1)} &nbsp;·&nbsp; {m(BEST['net_month'], 1)} = {m(BEST['gross_month'], 1)} − {m(BEST['cost_month'], 1)}</div>
<div class="note">Columns: extra rescue points · redelivery attempts per failed order after Alodi · share of CS calls the agent handles. Everything on this page is projected until a pilot measures Alodi’s own rescue rate.</div>
""")

survey_rows = "".join(f'<tr><td>{e(r["audience"])}</td><td>{e(r["metric"])}</td><td class="r num">{e(r["value"])}</td><td class="r num">{e(r["n"])}</td></tr>' for r in summary)
q_rows = "".join(f'<tr><td class="mono">{e(q["audience"][:4])}</td><td>{e(q["question_en"])}<div class="vi">{e(q["question_vi"])}</div></td><td class="src">{e(q["values"])}</td></tr>' for q in questions)
survey = page(6, "Survey", f"""
<div class="eyebrow">05 · Survey</div><h2>{len(shippers)} shippers, {len(customers)} buyers.</h2>
<p class="sub">Shippers from {', '.join(f'{k} ({v})' for k, v in companies.most_common())}. Buyers by segment: {', '.join(f'{k.lower()} {v}' for k, v in segments.most_common())}. Instrument in Vietnamese and English (prep/06-survey/codebook.csv, {len(codebook)} coded columns).</p>
<div class="status{' warn' if is_placeholder else ''}"><b>Data status · {', '.join(f'{k} {v}' for k, v in status.items())}.</b> {'The response files in the repository are still the generated placeholders, so the values below are illustrative and are not quoted as findings anywhere. Replace couriers.csv and customers.csv with the interview export (data_status = REAL) and rebuild this document.' if is_placeholder else 'Real interview responses.'}</div>
<table class="tight"><thead><tr><th>Who</th><th>Key questions</th><th>Answers</th></tr></thead><tbody>{q_rows}</tbody></table>
""")

survey_results = page(7, "Survey results", f"""
<div class="eyebrow">05 · Survey · headline values</div><h2>What the survey measures.</h2>
<p class="sub">Shares and means computed from the response files by generate_mock_survey.py / the EDA notebook. {'Shown as placeholders until the interview export replaces them.' if is_placeholder else ''}</p>
<table class="tight"><thead><tr><th>Who</th><th>Headline</th><th class="r">{'Placeholder' if is_placeholder else 'Value'}</th><th class="r">n</th></tr></thead><tbody>{survey_rows}</tbody></table>
""")

fa = DAY["failed_first_attempt"]
sources = page(8, "Simulation and sources", f"""
<div class="eyebrow">06 · The simulated day behind the dashboard</div><h2>One fictional hub, fixed seed 31102026.</h2>
<div class="kgrid">
  <div><b>{DAY['orders']:,}</b><span>orders</span></div><div><b>{DAY['delivered_first_attempt']:,}</b><span>delivered first time</span></div>
  <div><b>{fa['total']}</b><span>failed: A {fa['A']} · B {fa['B']} · refused {fa['C']}</span></div><div><b>{DAY['rescheduled_with_card']}</b><span>rescued with a context card</span></div>
  <div><b>{DAY['cs_queue']['total']}</b><span>to customer service</span></div><div><b>{DAY['calls_placed']}</b><span>AI calls, 0 out of hours</span></div>
</div>
<p class="sub">Rates are team assumptions for testing the product, not measurements. The landing page’s problem figures do not use this simulation; they use the cost model above.</p>
<div class="eyebrow" style="margin-top:9mm">07 · Sources</div>
<ul class="srcs">
<li>Shopee Return & Refund Policy §7.1–7.2 (checked 31 Oct 2026) — help.shopee.vn/portal/4/article/77251</li>
<li>GHN, who pays for Shopee returns — ₫40,000 cap per order since 1 Apr 2025 (₫20,000 express) — ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi</li>
<li>VECOM and Tran Anh Tung (UEF), Nguoi Lao Dong, 19 Jul 2025 — refusal rates 8–12%, 25–30% in sale season</li>
<li>Shopee Help Center, articles 79559 (no delivery time choice), 79569 (2–3 contacts, 5 days), 79196 (COD lock)</li>
<li>GHN blog — shipper earnings ₫6,000–8,000 per order</li>
<li>Glints Vietnam — shipper income ₫8–15M a month</li>
<li>Shipsy, What is NDR management — industry rescue 20–30%, best-in-class 50–65% (vendor)</li>
<li>Phong Vu listings — RTX 5060 Ti 16 GB ₫16.4–21.0M; Viettel Mobile SIP reseller price list; oazns.vn / worldfone ZNS price tables; EVN business tariff</li>
<li>OpenAI pricing for gpt-5-mini and gpt-4o-mini-tts (third-party price lists, checked 30 Oct 2026)</li>
<li>Model: prep/02-technical/cost-model/cost_model.py · PRD §18.8 · this document: build_proof.py</li>
</ul>
""")

CSS = font_css + """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Geist', sans-serif; color: #1f2a44; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; padding: 18mm 18mm 22mm; position: relative; page-break-after: always; background: #f6f3f1; overflow: hidden; }
.page.dark { background: #121a2c; color: #f6f3f1; display: flex; flex-direction: column; justify-content: space-between; }
.mono, code, .num { font-family: 'Geist', sans-serif; }
.num { font-variant-numeric: tabular-nums; }
.dim { color: #8a91a6; } .orange { color: #f05a00; }
.cover-top { display: flex; justify-content: space-between; align-items: center; font-size: 9pt; }
.logo svg { height: 13mm; width: auto; }
h1 { font-family: 'Geist', sans-serif; font-weight: 500; font-size: 54pt; line-height: 0.98; letter-spacing: -0.035em; margin: 6mm 0 0; }
.lead { font-size: 13pt; line-height: 1.45; max-width: 140mm; color: #c9cfdc; margin-top: 8mm; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid rgba(255,255,255,.15); }
.kpis div { padding: 7mm 4mm 0 0; }
.kpis div + div { padding-left: 5mm; border-left: 1px solid rgba(255,255,255,.15); }
.kpis b { display: block; font-size: 25pt; font-weight: 500; letter-spacing: -0.03em; }
.kpis .hi b { color: #f05a00; }
.kpis span { display: block; margin-top: 2mm; font-size: 8.5pt; color: #a7aec0; line-height: 1.4; font-family: 'Geist', sans-serif; text-transform: uppercase; }
.legend { font-size: 8pt; line-height: 1.6; } .legend b { color: #f6f3f1; font-weight: 400; }
.eyebrow { font-family: 'Geist', sans-serif; font-size: 8.5pt; text-transform: uppercase; color: #c94b00; letter-spacing: .04em; }
h2 { font-weight: 500; font-size: 22pt; letter-spacing: -0.025em; line-height: 1.1; margin: 3mm 0 0; }
.sub { font-size: 10pt; line-height: 1.5; color: #4a5268; margin: 4mm 0 6mm; max-width: 165mm; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0 0 6mm; }
th { text-align: left; font-family: 'Geist', sans-serif; font-weight: 400; font-size: 7.5pt; text-transform: uppercase; color: #6b7183; padding: 2.4mm 2mm; border-bottom: 1px solid #1f2a44; vertical-align: bottom; }
td { padding: 2.3mm 2mm; border-bottom: 1px solid #dcd7d3; vertical-align: top; line-height: 1.35; }
td.r, th.r { text-align: right; } td.src { color: #6b7183; font-size: 8pt; }
tr.sum td { font-weight: 600; border-bottom: 1px solid #1f2a44; }
td.hl { color: #c94b00; font-weight: 600; }
.f { font-size: 7.5pt; color: #8a91a6; margin-top: 1mm; text-transform: none; font-weight: 400; }
.tag { font-family: 'Geist', sans-serif; font-size: 7pt; text-transform: uppercase; padding: .6mm 1.8mm; border-radius: 99px; border: 1px solid; white-space: nowrap; }
.t-sourced { color: #1f8a5b; } .t-vendor { color: #b7791f; } .t-estimate { color: #6b7183; } .t-listed-price { color: #3f5fae; }
.note { font-size: 8.5pt; line-height: 1.5; color: #6b7183; border-left: 2px solid #f05a00; padding-left: 4mm; margin-top: 2mm; }
.steps { border-top: 1px solid #1f2a44; }
.step { display: grid; grid-template-columns: 52mm 1fr 34mm; gap: 4mm; padding: 4mm 0; border-bottom: 1px solid #dcd7d3; align-items: baseline; font-size: 10pt; }
.step .f { font-size: 8.5pt; margin: 0; color: #4a5268; } .step .v { text-align: right; font-size: 11pt; }
.step.total { border-bottom: 1px solid #1f2a44; } .step.total .k, .step.total .v { font-weight: 600; color: #c94b00; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 8mm; }
.box { border: 1px solid #cecac8; border-radius: 4mm; padding: 5mm; } .box p { font-size: 8.5pt; color: #6b7183; margin: 2mm 0 0; }
.big { display: block; font-size: 20pt; font-weight: 500; letter-spacing: -0.02em; margin-top: 2mm; }
.calc { margin-top: 2mm; padding: 4mm 5mm; background: #121a2c; color: #f6f3f1; border-radius: 3mm; font-size: 9.5pt; }
.status { font-size: 8.5pt; line-height: 1.5; padding: 3.5mm 4.5mm; border-radius: 3mm; background: #e7f3ec; margin-bottom: 5mm; }
.status.warn { background: #fbe3d4; }
table.tight { font-size: 8pt; } table.tight td { padding: 1.6mm 2mm; }
.vi { color: #8a91a6; font-size: 7.5pt; margin-top: .5mm; }
.kgrid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #1f2a44; margin-top: 6mm; }
.kgrid div { padding: 4mm 0; border-bottom: 1px solid #dcd7d3; } .kgrid b { font-size: 18pt; font-weight: 500; display: block; } .kgrid span { font-size: 8.5pt; color: #6b7183; }
.srcs { font-size: 8.5pt; line-height: 1.55; color: #4a5268; padding-left: 4mm; margin-top: 3mm; } .srcs li { margin-bottom: 1.5mm; }
footer { position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display: flex; justify-content: space-between; align-items: center; font-family: 'Geist', sans-serif; font-size: 7.5pt; color: #8a91a6; border-top: 1px solid #dcd7d3; padding-top: 3mm; }
footer .mini svg { height: 4.5mm; width: auto; }
"""

doc = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>The numbers behind Alodi</title><style>{CSS}</style></head><body>{cover}{inputs}{loss}{running}{savings}{survey}{survey_results}{sources}</body></html>"
out_html = HERE / "alodi-numbers.html"
out_pdf = HERE / "alodi-numbers.pdf"
doc = doc.replace(">cour<", ">ship<").replace("courier", "shipper").replace("Courier", "Shipper")
out_html.write_text(doc, encoding="utf-8")

chrome = next((p for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("google-chrome"), shutil.which("chromium")] if p and Path(p).exists()), None)
if not chrome:
    sys.exit(f"Wrote {out_html}; install Chrome to print the PDF.")
subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", out_html.as_uri()], check=True, capture_output=True)
shutil.copy(out_pdf, ROOT / "web/public/alodi-numbers.pdf")
out_html.unlink()  # holds absolute local font paths; the PDF is the artefact
print(f"{out_pdf}  ·  net {m(BEST['net_month'])} = {BEST['net_pct']:.1%} of {m(MID)}")
