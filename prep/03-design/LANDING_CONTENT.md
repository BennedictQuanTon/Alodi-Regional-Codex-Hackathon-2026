# Landing page content

Every piece of copy on the landing page, in page order, ready to paste into the rebuild. Layout and motion for each section are specified in [`DESIGN.md`](DESIGN.md) §9. Reference screenshots: `screenshots/landing-*.png`.

Page order: Announcement bar → Nav → Hero → Sources strip → Problem → Approach → What Alodi is → How Alodi works → Why Alodi → Expected outcomes → Tech stack → Roadmap → Competitors → Team → FAQ → Closing CTA → Sources → Footer.

## 0. Announcement bar

- Text: **MVP demo on 31 October. Three screens, one rescue, all mock data.**
- Button: **Read the script** → `/script`
- Close button: ×

## 1. Navigation

- Logo: alodi wordmark (mark C) → `/`
- Links: **Problem** `#problem` · **Approach** `#approach` · **Product** `#how-it-works` · **Competitors** `#competitors` · **Team** `#team`
- Buttons: **Dashboard ›** (dark) → `/console` · **Watch demo ›** (orange) → `/demo`
- Mobile: **Menu / Close** toggle

## 2. Hero

- H1: **Failed Deliveries, Rescued in One Tap**
- Sub: *Alodi messages and calls the buyer the moment a delivery fails, then hands the next courier structured context — so the second drop lands.*
- Buttons: **Watch the demo** (dark) → `/demo` · **See the dashboard** (ghost) → `/console`
- Pipeline diagram:
  - Inputs (left pills): Any order · No answer · Rescheduled · Refused · Route planner · Voice memo · Carrier OMS
  - Chips travelling on input lines: EVENT · TAP A · TAP B · REFUSED · SLOTS · MEMO · EVENT
  - Hub: Alodi mark C, with four blocks around it: **CHAT · CALL · EXTRACT · GUARD**
  - Outputs (right pills): Courier card · Dispatcher · CS queue · Order context · Metrics log; chips: CONTEXT

## 3. Sources strip

- Label: **Built on public figures from**
- Logos (in order): Shopee · VECOM · Metric · Giao Hang Nhanh · Shipsy · VTV · Nguoi Lao Dong · AssemblyAI · VinAI

## 4. Problem  `#problem`

- Eyebrow: **The problem**
- H2: **Every failed delivery is a time negotiation that happens outside the system, then disappears.**

### Four hero numbers

| Tag | Number | Text | Source line |
| --- | --- | --- | --- |
| What it costs | **₫40,000** | return shipping the seller pays on every failed order (maximum) | Shopee Return & Refund Policy §7.1 · VTV |
| How often | **8–12%** | of orders are refused nationwide; up to 20% in remote areas and 25–30% in sale season | VECOM and Tran Anh Tung (UEF), Nguoi Lao Dong |
| Root cause | **0** | delivery windows the buyer can choose. Time is negotiated outside the system | Shopee Help Center, article 79559 |
| Modelled | **₫31–46M** | lost per day at a 10,000-order depot; the sourced share alone is ≈ 31M VND | Team model from Shopee fees, GHN courier pay, Shipsy benchmarks |

### Four charts

1. **How often orders are refused in Vietnam** — range bars: Nationwide 8–12% · Today (expert) 10–15% · Remote areas up to 20% · Sale season 25–30%.
   Note: *This measures buyers refusing at the door, so it describes the scale of the problem.* Source: VECOM (nationwide, remote); Tran Anh Tung (today, sale season), Nguoi Lao Dong, Jul 2025
2. **A day at a 10,000-order depot** — bar of 10,000 with 800 failing (8%); then 800 split into 200 delivered later / 600 returned.
   Labels: *10,000 deliveries in a day · 800 fail first time (8%) · Of the 800 failed orders · 200 delivered on a later attempt (baseline ~25%, industry average per Shipsy) · Alodi targets the orange part: turn returns into deliveries · The lower bar is drawn 6× larger than the upper bar for readability.*
   Note: *8% is a conservative mark below the VECOM range. The 20–30% baseline rescue rate is a vendor figure.* Source: Team assumptions; baseline rescue rate from Shipsy
3. **Daily loss per depot (million VND)** — stacked bars Low 24 + 7.2 + 6 = 37.2 · High 24 + 9.6 + 12 = 45.6. Legend: *Return fees 600 × 40K = 24M · Redelivery 7.2–9.6M · Hub / CS 6–12M (estimate)*.
   Note: *Redelivery: 800 orders × ~1.5 attempts × 6,000–8,000 VND courier pay.* Source: Shopee return fee policy; GHN courier earnings; hub/CS cost is a team estimate
4. **E-commerce grows faster than call teams can hire** — columns 2024 ~318.9 · 2025 429.7; side numbers **+34.75%** (*trillion VND, 4 marketplaces, 2025 vs 2024*) and **≈ 13 callers** (*to phone 800 buyers a day (800 × 2 calls × 4 min)*).
   Note: *2024 derived from the 34.75% growth. Q1 2026 grew a further 46.6%. 13 callers is a team estimate.* Source: Metric, E-commerce Report 2025 (Shopee, TikTok Shop, Lazada, Tiki)

### Three supporting facts

- **3 failed COD orders in 90 days** — and Shopee switches COD off for the buyer. Buyers lose too.  
  Source: Shopee Help Center, article 79196
- **2–3 contacts, reschedule within 5 days** — is Shopee’s redelivery process. Alodi runs entirely inside it.  
  Source: Shopee Help Center, article 79569
- **Exception §7.2** — when the carrier is at fault, the seller doesn’t pay. Structured context settles who is responsible.  
  Source: Shopee Return & Refund Policy §7.2

## 5. Approach  `#approach`

- Eyebrow: **Our approach**
- H2: **Autonomous where the rules are clear. Human where they aren’t.**
- Chapters (pinned, scroll-driven):
  1. **The rules already exist** — *Shopee’s redelivery process fixes the frame: 2–3 contacts, reschedule within 5 days. Alodi plays entirely inside it.*
     Visual: stat tiles **2–3** contacts per order · **5** days to reschedule · **40K** VND lost per failure; two timelines — *Day 0 · rescue cycle 1*: Courier tap 10:02 → Chat sent 10:02 → AI call 1 11:02 → AI call 2 13:02; *Days 1–5 · still inside Shopee’s window*: Cycle 2 (day 1) → Hand to CS (after cycle 2) → Hard limit (day 5). Source: Shopee Help Center, article 79569 · Return & Refund Policy §7.1
  2. **A hard autonomy boundary** — *The agent messages, calls and applies confident context. Anything that touches money or a buyer’s record goes to a person.*
     Visual: two lanes. **Agent acts**: Ask for a delivery window · Call between 08:00 and 20:30 · Apply context ≥ 0.85. **Human decides**: Label a refusal “suspected bomb” · Return to seller · Resolve conflicting answers. Caption: *The line in the middle is enforced by the policy guard, not by the prompt.*
  3. **Evals, not vibes** — *Codex changes one thing per round against a held-out set. The curve is the proof, scored next to safe autonomy.*
     Visual: loop Held-out set → Codex edit → Per-field F1 → Keep best; held-out F1 rising 0.59 → 0.68 → 0.75 → 0.81 → 0.86 → 0.88 → 0.88 (v0–v6). Caption: *One prompt or schema change per round. Stop when held-out F1 stops rising. Illustrative curve until the real eval runs.*

## 6. What Alodi is  `#product`

- Eyebrow: **What Alodi is**
- H2: **An agent layer between the buyer and the carrier.**
- Lead: *Alodi reads failed-delivery events, talks to the buyer, and writes structured context back into the carrier’s own systems. It replaces nothing the carrier already runs.*
- Diagram: rebuild as the three-column, eight-step architecture (`../02-technical/diagrams/alodi-architecture.pdf`), spec in `../03-design/DESIGN.md` §7.6 and content in [`../02-technical/PRD.md`](../02-technical/PRD.md) §5.1 and §16.3. (The current site still shows the earlier C4 layer view.)

## 7. How Alodi works  `#how-it-works`

- H2: **How Alodi Works**
- Tall card **One-Tap Rescue Pipeline** — *One agent with four tools runs as a state machine per order. The courier’s tap starts it; the policy guard decides when it stops.*
  Animated chain: Courier tap (Trigger · A) → *Always* → Rescue chat (Agent) → *Silent 60 min* → Voice call (Agent) → *Answered* → Extractor (JSON + confidence) → OR → **Auto-apply** (all fields ≥ 0.85) / **Human review** (low or conflicting)
- **In-Flight Context Extraction** — *Turn a 74-second call into four typed fields before the courier reaches the next stop. Every field carries its own confidence.*
  Visual: quote “Tomorrow after five, please. Leave it with security in Tower B — or call my wife.” → time_window *Sun 1 Nov · 17:00–20:00* (0.94) · drop_location *Security desk, Tower B* (0.88) · alt_receiver *Wife · 0903 *** 214* (0.91)
- **Rule-Based Escalation** — *Quiet hours, contact caps and confidence thresholds are rules, not prompts. Anything high-stakes is routed to a person.*
  Visual: *Policy guard rules* — call_hours only between 08:00 20:30 · max_calls per cycle is 2 · confidence below 0.85 → human review · trigger equals REFUSED → CS, no contact
- **Deploy Your Way** — *Browser demo today, shadow mode at one depot next, a regional on-prem gateway when the data has to stay in-house.*
  Visual: three cards Demo (Browser only · Mock data · Fast-forward clock) · Pilot (Shadow mode · One depot · No buyer contact) · On-prem (Regional gateway · PII stays in · Fine-tuned ASR)

## 8. Why Alodi  `#features`

- H2: **Why Alodi**

1. **One tap instead of an error code** — The courier picks No answer, Rescheduled, or Refused. The agent does the rest.
2. **Ask for a window before delivery** — Send two or more slots from the route planner as quick replies. Only for risky orders: high COD, past failures.
   *Rebuild copy (new flow):* **Ask for a window every morning** — Four slots from the route planner; the buyer picks at least two, or says they can’t receive today and why.
3. **Message first, call if silent** — Chat goes out the moment the courier taps. 60 minutes of silence triggers call one, two hours later call two. Calls only 08:00–20:30.
4. **A ten-second voice memo** — Buyer rescheduled on the phone? The courier repeats it aloud; speech-to-text turns it into structured data.
5. **Extraction with confidence** — Window, drop-off, alternate receiver, address fix: each field is JSON with a confidence score. Low confidence goes to a person.
6. **Policy guard** — Quiet hours, contact caps, “stop” means stop, recording consent before every call.
7. **Order Context Object** — Versioned context with an audit log: who changed what, and when, across agent, buyer, courier and CS.
8. **Refusals go straight to CS** — Never spend effort calling a buyer who refused at the door. A “suspected bomb” label is only a suggestion; a person approves it.

## 9. Expected outcomes  `#metrics`

- Eyebrow: **Expected outcomes**
- H2: **Four problem numbers. Four output metrics. The story closes the loop.**
- Lead: *Accuracy and Safe autonomy are measured on stage. Time-to-context is the best moment of the demo. Money always carries the word “projected”.*

| Problem | Metric | How it is measured | Badge | Target | Target note |
| --- | --- | --- | --- | --- | --- |
| 0 windows: context lives outside the system | **Time-to-context** | From the tap to the card appearing for the courier and dispatcher. Chat and call paths measured separately. | Measured | < 10 s | chat path, after the buyer replies |
| 8–12% refused, context lost in phone calls | **Extraction accuracy** | Per-field F1 across three sources: chat, call transcript, voice memo. Hand-written held-out set. | Measured | F1 ≥ 0.90 | goal after the Codex loop, vs. baseline v0 |
| Scale beyond people (≈13 callers per depot) | **Safe autonomy** | % of cases handled alone, error rate inside that group, zero high-stakes actions without approval, zero calls outside hours. | Measured | 0 breaches | quiet hours and autonomy boundary |
| 40,000 VND per order, 31–46M VND per depot per day | **Money** | Return fees avoided plus CS hours saved, against agent cost per case. | Projected | VND/case | agent cost measured, extra rescue rate assumed |

## 10. Tech stack  `#tech`

- Eyebrow: **Tech stack**
- H2: **A Stack That Runs Today, and Scales In-House**
- Lead: *The demo runs in the browser on mock data and a fast-forward clock. In production the model gateway moves on-prem per region and Vietnamese ASR is fine-tuned for regional accents.*
- Legend: *Inner orbit · demo, 31 Oct* · *Outer orbit · production*
- Button: **Explore the demo** → `/demo`

| Demo (top marquee) | Note | Icon |
| --- | --- | --- |
| Next.js | Three-screen stage | `siNextdotjs` |
| TypeScript | Scenario engine | `siTypescript` |
| Tailwind CSS | Design tokens | `siTailwindcss` |
| Motion | Transitions | `siFramer` |
| FastAPI | Agent API | `siFastapi` |
| SQLite | Demo state | `siSqlite` |
| OpenAI | Structured Outputs · Realtime | `siOpenai` |
| Codex | Eval loop | `siOpenai` |
| AssemblyAI | Vietnamese ASR | `/logos/assemblyai-mark.svg` |
| ~~LangGraph~~ → **WebRTC** | In-browser AI call | `siWebrtc` — LangGraph is not in the new architecture |
| Docker | Compose, one VM | `siDocker` |

| Production (bottom marquee) | Note | Icon |
| --- | --- | --- |
| PostgreSQL | Order context | `siPostgresql` |
| Temporal | Durable timers | `siTemporal` |
| ~~Apache Kafka~~ → **Shopee** | Chat API | `siShopee` — orders now come from the SPX order API, not CDC |
| Redis | Rate limits | `siRedis` |
| Hugging Face | Open-weight 7–14B | `siHuggingface` |
| NVIDIA | Regional GPU gateway | `siNvidia` |
| PhoWhisper | On-prem ASR | `/logos/vinai-mark.png` |
| Zalo | OA + ZNS | `siZalo` |
| Asterisk | Branded SIP trunk | `siAsterisk` |
| MinIO | Audio vault · 30-day TTL | `siMinio` |
| Grafana | Metrics dashboard | `siGrafana` |
| Kubernetes | Per-region deploy | `siKubernetes` |

Icons: `si*` keys are from the `simple-icons` package — exported SVGs in `../05-assets/logos/tech/`.

## 11. Roadmap  `#roadmap`

- H2: **What Comes After the Demo**

1. **MVP demo** · *31 Oct 2026* — Three screens running side by side on mock data and a fast-forward clock. Accuracy and Safe autonomy measured on a held-out eval set.
2. **Shadow mode at one depot** · *Q4 2026* — The agent runs alongside CS without contacting real buyers. Compare its labels to human decisions to tune confidence thresholds.
3. **Real channels, controlled** · *Q1 2027* — In-app marketplace chat with the carrier, Zalo OA + ZNS for other carriers, a branded call line. Risky orders only.
4. **Data stays in-house** · *Q2 2027* — On-prem model gateway per region, ASR fine-tuned for regional accents and address vocabulary, extractor distilled to a small model.
5. **More carriers, more context** · *Then* — Courier call transcripts via in-app VoIP (with recording notice), and integrations with more domestic carriers.

## 12. Competitors  `#competitors`

- Eyebrow: **Competitive landscape**
- H2: **AI delivery rescue exists in India. Nobody builds it for Vietnamese buyers, starting from one courier tap.**
- Table: see [`../01-pitch/4-SLIDES.md`](../01-pitch/4-SLIDES.md) §4
- Source line under the table: *ClickPost NDR Management and Parth (Angel One); Shipsy NDR guide and last-mile page; AfterShip exception agent; Ringg AI failed-delivery recovery; Shiprocket contact-buyer docs; GHTK scheduled delivery. Vendor figures are self-reported. “Not disclosed” means we found nothing on the official pages as of October 2026.*

## 13. Team  `#team`

- Eyebrow: **The team**
- H2: **Team Develarper**
- Lead: *Four builders from UTS × HCMUT.*

- **Nomura Yoshio** — Team Lead · Project Presenter
- **Long Quan Ton** — AI Engineer · Solution Architect
- **Khanh Tuong Huynh** — AI Engineer · Deployment Engineer
- **Thanh Loi Tran** — Data Engineer · Backend Developer

## 14. FAQ  `#faq`

- H2: **Frequently Asked Questions**

**Does the demo call real phone numbers?**  
No. The AI call runs in the browser. In production it uses a branded call line: fixed phrases are pre-recorded, dynamic parts use TTS, and calls stay under about 90 seconds.

**Why doesn’t the agent label “suspected bomb” orders itself?**  
That label counts toward the buyer’s 3-orders-in-90-days COD lock. The agent suggests; a person decides. That is the autonomy boundary.

**How is personal data handled?**  
Raw audio and transcripts stay inside a trusted zone with a deletion window. Only extracted JSON leaves it. Phone numbers and addresses are masked before any cloud model call.

**Do you need to fine-tune a model?**  
Not for the hackathon: Structured Outputs, good prompts and a Codex-run eval loop are enough. In production, fine-tune ASR for regional accents and address vocabulary first, then distill the extractor.

**Does Alodi replace the courier app or route planner?**  
No. Alodi reads orders and events, talks to the buyer, and writes structured context back into the carrier’s own systems.

## 15. Closing CTA

- H2 (display size): **Make the second drop land.**
- Sub: *One courier tap, one well-timed conversation, one context card for the next attempt.*
- Buttons: **Watch the demo** (dark) → `/demo` · **Open dashboard ›** (orange) → `/console`

## 16. Sources  `#sources`

- Eyebrow: **Sources** — unnumbered list of every link in [`../01-pitch/4-SLIDES.md`](../01-pitch/4-SLIDES.md) §7, each as *Label — detail*.

## 17. Footer

- Logo + *Failed-delivery rescue for Vietnamese e-commerce. MVP demo on mock data.*
- **Project**: Problem · Approach · Product · Competitors
- **Demo**: Demo stage · Dashboard · Metrics · Script
- **Team**: Develarper · FAQ · Sources
- Bottom row: *© 2026 Team Develarper. All rights reserved.* · *Demo data is simulated.*
