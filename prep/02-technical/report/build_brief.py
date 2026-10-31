"""Build the Alodi submission write-up (HTML → PDF): a two-page brief in the project report's template.

Usage (from the repo root):
    python3 -I prep/02-technical/report/build_brief.py
Writes prep/02-technical/report/alodi-brief.pdf and copies it to submission/. Answers the form's four points: problem,
solution, build direction, use of Codex. Money comes from cost_model.py, as in the report and the numbers PDF.
"""
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
SUBMISSION = ROOT / "submission/Develarper_Alodi_Sea-OpenAI-Regional-Codex-Hackathon-2026_Brief.pdf"

# Flip to True once the team has confirmed section 4 against how they actually used Codex.
CODEX_CONFIRMED = False


def m(v, d=0):
    return f"₫{v / 1e6:,.{d}f}M"


def kf(items):
    return '<div class="kf">' + "".join(f"<div><b>{v}</b><span>{l}</span><i>{s}</i></div>" for v, l, s in items) + "</div>"


LOGO_W = (ROOT / "prep/04-brand/logo/alodi-wordmark-white.svg").read_text()
FONTS = {"Geist": ROOT / "prep/01-pitch/charts/fonts/Geist.ttf", "Be Vietnam Pro": ROOT / "prep/04-brand/fonts/BeVietnamPro-ExtraBold.ttf"}
font_css = "\n".join(f"@font-face {{ font-family: '{k}'; src: url('{v.as_uri()}'); }}" for k, v in FONTS.items())

head = f"""
<header class="band">
  <div class="bt"><span class="logo">{LOGO_W}</span><span class="ey">Project write-up</span></div>
  <p class="tag">Make the second drop land.</p>
  <p class="abs">An AI agent that rescues failed deliveries for Vietnamese e-commerce. One tap from the courier starts it. The next attempt gets the
  time, place and person it needs. Decisions about money or a buyer’s record stay with people.</p>
  <p class="by">Team Develarper · Sea × OpenAI Regional Codex Hackathon, Ho Chi Minh City · 31 October 2026</p>
</header>"""

s1 = f"""
<section><h2><span>1</span>The problem</h2>
<p class="lead">A failed delivery is a time negotiation that happens off the system.</p>
<p>Shopee buyers cannot choose a delivery window, so buyer and courier settle the time over the phone. When the call is missed, everything that would
fix the next attempt shrinks into one error code. The second attempt repeats the first, and the seller pays for the return.</p>
{kf([("₫40,000", "return fee per failed order, paid by the seller", "Shopee §7.1 · GHN · Sourced"), ("8–12%", "of orders refused at the door, nationwide", "VECOM · Sourced"), ("0", "delivery windows a buyer can choose", "Shopee 79559 · Sourced"), (f"≈ {m(MID)}", "lost a month in one area of 20 couriers and 4,000 orders a day", "Team cost model · Modelled")])}
</section>"""

s2 = f"""
<section><h2><span>2</span>The solution we built</h2>
<p class="lead">The courier taps one button. Alodi does the rest, inside Shopee’s rules, and hands back structured context.</p>
<ol class="flow">
<li><b>Tap</b><span>No answer, Rescheduled or Refused</span></li>
<li><b>Reach</b><span>Chat at once; calls if silent, only 08:00–20:30</span></li>
<li><b>Extract</b><span>When, where and who, as a context card</span></li>
<li><b>Decide</b><span>Clear answers apply; the rest goes to a person</span></li>
<li><b>Redeliver</b><span>The courier’s next attempt carries the card</span></li>
</ol>
<table><thead><tr><th>Working today</th><th>What it does</th></tr></thead><tbody>
<tr><td><b>Workflow backend</b></td><td>FastAPI and SQLite: morning availability, courier outcomes, rescue policy, customer-service decisions and a durable scheduler that survives restarts, on 4,000 synthetic orders. 193 automated tests pass, with AI providers simulated.</td></tr>
<tr><td><b>Voice and memo</b></td><td>GPT-Live-1 over WebRTC holds the buyer call, GPT Transcribe reads the courier’s voice memo, and GPT-6.1 Terra extracts the fields. Consent gates, a 180-second call cap and a memo limit are built in. Runs in stub or live mode, through the integrated workspace.</td></tr>
<tr><td><b>Demo stage</b></td><td>Courier, buyer and operations views side by side, plus an SPX-style hub dashboard. These run a scripted scenario on mock data, so the story stays reliable on stage.</td></tr>
</tbody></table>
<p class="note"><b>Projected value.</b> At best-in-class rescue rates (vendor benchmark) Alodi would save {m(BEST['net_month'], 1)} a month per area, {BEST['net_pct']:.0%} of the loss, after a running cost of {m(BEST['cost_month'], 1)}. Not yet measured. The production design adds Decisions API triage on GPT-6 Luna and local speech and PII services, which are not in this build.</p>
</section>"""

s3 = """
<section class="pb"><h2><span>3</span>Build direction</h2>
<p class="lead">Primary: <b>Autonomous &amp; Adaptive AI</b>. Also: <b>Deep Domain AI</b>.</p>
<div class="cols2">
<div class="dir"><h4>Autonomous &amp; Adaptive AI</h4><p>An operations agent that runs a rescue from tap to context card without a dispatcher. It adapts to silence, a restart or a low-confidence answer, a policy guard keeps its actions inside hard limits, and it escalates when it should not act alone.</p></div>
<div class="dir"><h4>Deep Domain AI</h4><p>Alodi reflects how last-mile work actually runs: courier outcomes as the trigger, route cut-offs, Shopee’s 2–3 contacts within 5 days, permitted calling hours, and the line between asking a buyer and labelling one.</p></div>
</div>
</section>"""

confirm = "" if CODEX_CONFIRMED else '<div class="status warn"><b>Draft, not for upload.</b> The team confirms this section against what actually happened, then removes this line.</div>'
s4 = f"""
<section><h2><span>4</span>How we used Codex</h2>
<p class="lead">Codex helps specify, build and review. A person merges.</p>
{confirm}
<table><thead><tr><th>Stage</th><th>How Codex is used</th><th>Surface</th></tr></thead><tbody>
<tr><td><b>Specify</b></td><td>The PRD and business rules become scripts and acceptance checks</td><td>ChatGPT + Codex</td></tr>
<tr><td><b>Build</b></td><td>Pair-programming on the workflow, voice and interface code</td><td>Codex CLI · IDE</td></tr>
<tr><td><b>Parallelise</b></td><td>One task, one branch, one pull request</td><td>Codex cloud</td></tr>
<tr><td><b>Review</b></td><td>Every pull request is reviewed and passes lint, build and test checks in CI before merge</td><td>Codex in GitHub</td></tr>
<tr><td><b>Evaluate</b></td><td>Planned loop: one prompt or schema change per round, kept only if held-out F1 rises. Target F1 ≥ 0.90</td><td>Codex + Evals</td></tr>
</tbody></table>
</section>"""

foot = """
<section class="close"><div class="cols2">
<div><h4>Team Develarper</h4><table class="team"><tbody>
<tr><td><b>Nomura Yoshio</b></td><td>Team Lead · Presenter</td></tr>
<tr><td><b>Long Quan Ton</b></td><td>AI Engineer · Solution Architect</td></tr>
<tr><td><b>Khanh Tuong Huynh</b></td><td>AI Engineer · Deployment</td></tr>
<tr><td><b>Thanh Loi Tran</b></td><td>Data Engineer · Backend</td></tr>
</tbody></table></div>
<div><h4>What comes next</h4><table class="team"><tbody>
<tr><td><b>Nov 2026</b></td><td>Full build; connect the demo views to the backend</td></tr>
<tr><td><b>Q1 2027</b></td><td>Shadow mode at one area, no buyer contact</td></tr>
<tr><td><b>Then</b></td><td>Controlled real channels, then a region</td></tr>
<tr><td><b>By 2028</b></td><td>National rollout</td></tr>
</tbody></table></div>
</div></section>
<p class="src">Sources: Shopee Return &amp; Refund Policy §7.1; Shopee Help Center 79559, 79569; GHN seller guidance; VECOM via Nguoi Lao Dong, 19 Jul 2025; Shipsy NDR benchmark (vendor claim); OpenAI model pages, Oct 2026. Full derivations are in the project report and the numbers PDF.</p>"""

CSS = font_css + """
@page { size: A4; margin: 13mm 16mm 15mm;
  @bottom-left { content: "Alodi · Project write-up"; font-family: 'Geist'; font-size: 7.5pt; color: #8a91a6; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: 'Geist'; font-size: 7.5pt; color: #8a91a6; }
}
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Geist', sans-serif; color: #1f2a44; font-size: 10pt; line-height: 1.48; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
b { font-weight: 600; }
.band { background: #121a2c; color: #f6f3f1; border-radius: 3.5mm; padding: 5.5mm 7mm 4.5mm; }
.bt { display: flex; justify-content: space-between; align-items: center; } .bt svg { height: 8.5mm; width: auto; display: block; }
.ey { font-size: 8.5pt; letter-spacing: .1em; text-transform: uppercase; color: #f05a00; font-weight: 600; }
.tag { font-size: 17pt; letter-spacing: -0.02em; line-height: 1.15; margin: 3.5mm 0 0; }
.abs { font-size: 10pt; color: #c9cfdc; margin: 1.5mm 0 0; }
.by { font-size: 8.5pt; color: #8a91a6; margin: 2.5mm 0 0; }
h2 { font-weight: 600; font-size: 16pt; letter-spacing: -0.02em; line-height: 1.15; margin: 5mm 0 1.5mm; padding-top: 3mm; border-top: 1.5px solid #1f2a44; break-after: avoid; }
h2 span { color: #f05a00; margin-right: 3mm; }
h4 { margin: 0 0 1.5mm; font-size: 10.5pt; font-weight: 600; }
.lead { font-size: 12pt; line-height: 1.35; color: #4a5268; margin: 0 0 3mm; break-after: avoid; } .lead b { color: #1f2a44; }
p { margin: 0 0 2.5mm; }
.pb { break-before: page; } .pb > h2:first-child { margin-top: 0; } .close { margin-top: 6mm; padding-top: 3.5mm; border-top: 1.5px solid #1f2a44; }
.team { margin: 0; } .team td:first-child { padding-right: 3mm; } .close .cols2 { gap: 7mm; }
.kf { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #1f2a44; border-bottom: 1px solid #e6e2df; margin: 3mm 0 0; }
.kf div { padding: 3mm 3mm 3mm 0; } .kf div + div { padding-left: 3mm; border-left: 1px solid #e6e2df; }
.kf b { display: block; font-size: 17pt; font-weight: 500; letter-spacing: -0.02em; white-space: nowrap; } .kf span { display: block; font-size: 9.2pt; line-height: 1.35; margin-top: 1mm; } .kf i { display: block; font-style: normal; font-size: 7.8pt; color: #6b7183; margin-top: 1mm; }
.flow { list-style: none; counter-reset: s; display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; padding: 0; margin: 0 0 3.5mm; border-top: 1px solid #1f2a44; border-bottom: 1px solid #e6e2df; }
.flow li { counter-increment: s; padding: 2.6mm 3mm 2.8mm 0; margin: 0; } .flow li + li { padding-left: 3mm; border-left: 1px solid #e6e2df; }
.flow li::before { content: "0" counter(s); color: #c94b00; font-size: 7.6pt; font-weight: 600; display: block; }
.flow b { display: block; font-size: 10.6pt; } .flow span { display: block; font-size: 8.8pt; line-height: 1.35; color: #4a5268; margin-top: .6mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 3mm; font-size: 9.2pt; line-height: 1.42; }
th { text-align: left; font-weight: 600; font-size: 7.8pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7183; padding: 1.6mm 2.2mm 1.6mm 0; border-bottom: 1px solid #1f2a44; }
td { padding: 2mm 2.5mm 2mm 0; border-bottom: 1px solid #e6e2df; vertical-align: top; } td:first-child { white-space: nowrap; padding-right: 4mm; }
.note { font-size: 9pt; color: #4a5268; border-left: 2px solid #f05a00; padding-left: 3.5mm; margin: 3mm 0 0; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.dir { background: #f6f3f1; border-radius: 2.5mm; padding: 4.5mm 5mm; font-size: 10.2pt; } .dir p { margin: 0; }
.status { font-size: 9pt; padding: 2.4mm 3.5mm; border-radius: 2mm; background: #fbe3d4; margin: 0 0 2.5mm; }
.src { font-size: 7.8pt; line-height: 1.4; color: #6b7183; margin: 4mm 0 0; }
"""

doc = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Alodi · Project write-up</title><style>{CSS}</style></head><body>{head}{s1}{s2}{s3}{s4}{foot}</body></html>"
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
