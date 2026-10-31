# 4 · Slides — design and content

The pitch deck: 10 slides plus a backup appendix. This file holds the deck design, every slide’s layout and content, and the data behind it: official figures, the money model, competitors, team and sources. It replaces the earlier `PITCH`, `STATS`, `COMPETITORS`, `TEAM`, `QA_PREP` and `SOURCES` notes; the Q&A now lives in [`2-PITCH-SCRIPT.md`](2-PITCH-SCRIPT.md) §5.

Charts: [`charts/`](charts/), rendered by `charts/make_charts.py` from the cost model and the survey files, in light and dark, SVG and PNG.

---

## 1. Deck design

### 1.1 Canvas and grid

| | |
| --- | --- |
| Size | 16:9, 1920 × 1080 (Keynote, Google Slides or Figma) |
| Margins | 96 px left/right, 80 px top, 72 px bottom |
| Grid | 12 columns, 24 px gutters; content sits on columns 1–12, charts on 1–12 or 1–8 with a 4-column callout |
| Baseline | 8 px |
| Footer | Source line at 72 px from the bottom, Geist Mono 18 px, slate; page number right, Geist Mono 18 px |

### 1.2 Colour

| Role | Hex |
| --- | --- |
| Day background (default) | `#F6F3F1` parchment |
| Night background (title, demo, architecture, close) | `#121A2C` deep navy |
| Ink | `#1F2A44` navy on day · `#F6F3F1` on night |
| Secondary ink | `#5A6173` · `#B8BFCF` on night |
| Accent | `#F05A00` orange, **one per slide**: the number or element the slide is about |
| Charts | Blue `#3F5FAE` (day) / `#6D8AD6` (night) + orange for the highlighted series; validated for colour-blind separation |

### 1.3 Type

Same family as the demo UI and the film, so slides, charts and video read as one system.

| Use | Font | Size | Weight |
| --- | --- | --- | --- |
| Slide title | Geist | 64 px | 500, tracking −2 % |
| Hero number | Geist | 180–240 px | 600, tracking −3 % |
| Body (max 2 lines) | Geist | 32 px | 400 |
| Labels, eyebrows | Geist Mono | 20 px, uppercase, +4 % | 400 |
| Source line | Geist Mono | 18 px | 400 |
| Wordmark | Be Vietnam Pro ExtraBold (outlined SVG from `04-brand/`) | — | — |

Money is written **“186M VND”**, because Geist has no “₫” glyph.

### 1.4 Rules

- One idea per slide, at most 12 words of body text. The voice carries the rest.
- Every number has a label (*sourced*, *modelled*, *projected*, *mock*) and a plain-text source line. No [1] markers or superscripts.
- Glyphs: Alodi marks (ring + dot / check / sound bars / square) and plain arrows only. Real logos only to name real companies (sources strip, tech).
- No stock photos of couriers unless they are the team’s own **[USER IMAGE]**; no AI-generated people.
- Builds: one element per click, matching the film’s motion (out-expo, 0.4 s). No spins, bounces or flies.

## 2. Slide by slide

| # | Slide | Background | Layout | Content | Chart / asset | Source line |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | **Title** | Night | Lockup centred, team name below | Alodi mark C + wordmark · “Make the second drop land.” · Team Develarper | `04-brand/lockup/alodi-lockup-make-the-second-drop-land-dark.svg` | — |
| S2 | **Hook** | Night | One question, centred, word build | “Have you ever missed the courier’s call in the middle of a meeting?” | Buyer phone screenshot with two missed calls (`/buyer`) | — |
| S3 | **What people told us** | Day | Two charts side by side (cols 1–7 and 8–12) | Buyers: pain frequency · Couriers: would you like it? | `charts/06-problem-survey-buyers-MOCK-light` + `07-problem-survey-couriers-MOCK-light` → **replace with real results** | “Alodi buyer survey (n = …) and courier interviews (n = …), Oct 2026” |
| S4 | **The real cost** | Day | Three hero numbers in a row + refusal chart below | **40,000 VND** per failed order · **8–12%** refused · **0** ways to pick a time | `charts/01-problem-refusal-rates-light` | “Shopee Return & Refund Policy §7.1 · VECOM, Nguoi Lao Dong 19 Jul 2025 · Shopee Help Center 79559” |
| S5 | **One area, one month** | Day | Chart cols 1–8, hero number cols 9–12 | **473M VND** lost a month (≈ 5.7B VND a year) · 20 couriers · 4,000 orders a day | `charts/02-problem-monthly-loss-light` | “Modelled: Shopee §7.1, VECOM 8%, Shipsy 25% (vendor), GHN, Glints — PRD §18.8” |
| S6 | **Alodi in one picture** | Day | Flow left → right: tap → chat → call → extract → card, with the human lane below | “One tap. One conversation. One card for the next courier.” | Simplified `02-technical/diagrams/alodi-flow.png` | — |
| S7 | **Live demo** | Night | Four labelled frames (01 courier, 02 ops, 03 buyer, 04 control) | Switch to the devices | Screens from the build | — |
| S8 | **OpenAI at the core** | Night | System diagram, hairlines; OpenAI logo once | GPT-Live-1 · Decisions API (GPT-6 Luna) · GPT-5.6 Terra · Structured Outputs · OpenAI TTS · API fallback for the hard 10% · policy guard in code | PRD §18.8.2 diagram, restyled | “PRD §16, §18.8” |
| S9 | **What it delivers** | Day | Before/after chart cols 1–8; three tiles below or right | **−186M VND a month (39%)** · ≈ 2.2B VND a year · costs 4% of the loss · **6 s** to context · **65%** handled alone | `charts/03-output-before-after-light`, `05-output-cost-share-light`, `08-output-three-numbers-light` | “Projected: Shipsy best-in-class 50–65% (vendor), PRD §18.8. 6 s and 65%: target until measured” |
| S10 | **Team + ask** | Night | Four portraits, names, roles; one ask line | “Next: shadow mode at one area.” | `05-assets/team/` | — |

Backup slides (appendix):
- B1 Scenarios: `charts/04-output-scenarios`.
- B2 Cost breakdown.
- B3 Competitors.
- B4 The rules.
- B5 Architecture (`02-technical/diagrams/alodi-architecture.png`).
- B6 Sources.

## 3. Official figures

Labels:
- **Sourced** = quoted from a public document.
- **Derived** = simple arithmetic on sourced numbers.
- **Modelled** = sourced numbers combined with stated assumptions.
- **Estimate** = team assumption.
- **Vendor** = a company’s own claim.
- **Mock** = placeholder until measured.

### 3.1 Problem

| Figure | Meaning | Type | Source |
| --- | --- | --- | --- |
| **40,000 VND** | Maximum return-shipping fee the seller pays per failed Shopee delivery (20,000 VND for express) | Sourced | Shopee Return & Refund Policy §7.1; GHN (cap since 1 Apr 2025) |
| **8–12%** | Orders refused nationwide; up to 20% remote; 25–30% in sale season; 10–15% today (expert) | Sourced | VECOM and Tran Anh Tung (UEF), Nguoi Lao Dong, 19 Jul 2025 |
| **0** | Delivery windows a Shopee buyer can choose | Sourced | Shopee Help Center 79559 |
| **2–3 contacts, ≤ 5 days** | Shopee’s redelivery frame (Alodi runs inside it) | Sourced | Shopee Help Center 79569 |
| **3 failed COD orders in 90 days** | Shopee disables COD for that buyer, which is why labels need a person | Sourced | Shopee Help Center 79196 |
| **429.7T VND** | 2025 sales on Shopee, TikTok Shop, Lazada, Tiki (+34.75%) | Sourced | Metric via Brands Vietnam |

### 3.2 One area, one month (20 couriers, 4,000 orders a day)

| Item | Per month | Type | Basis |
| --- | --- | --- | --- |
| Return fees | 288M VND | Derived | 4,000 × 8% = 320 failed a day; 75% returned (Shipsy 25% rescue, vendor) × 40,000 VND × 30 |
| Courier pay for redelivery | 86–115M VND | Derived | 320 × 1.5 attempts × 6–8k VND (GHN) |
| Courier time at unanswered doors | 27–51M VND | Modelled | 320 × 5 min × courier income 8–15M VND a month (Glints) |
| CS calling buyers back | 45M VND | Estimate | 320 × 2 calls × 4 min × 35,000 VND/h |
| **Total loss** | **447–499M VND (≈ 473M)**; ≈ 5.7B VND a year | Modelled | PRD §18.8 |

### 3.3 Alodi’s economics (local-first server per area)

| Item | Value | Type |
| --- | --- | --- |
| One-time infrastructure | 75–98M VND (2 × RTX 5060 Ti 16 GB, workstation, UPS, 4G router) | Listed price + estimate |
| Running cost | **29.0M VND a month** (6.1% of the loss): GPT-Live-1 calls, Decisions API triage on GPT-6 Luna, GPT-5.6 Terra orchestration, SIP, Zalo ZNS for risky orders, electricity, fibre, backup, 0.1 FTE ops | Estimate (OpenAI list prices) |
| Gross saving, best-in-class | 214.7M VND a month (45%) | Projected |
| **Net saving, best-in-class (headline)** | **185.7M VND a month = 39% of the loss; ≈ 2.23B VND a year**; server pays back in ~2 weeks | Projected |
| Net saving, base / conservative | 90.7M (19%) / 46.5M (10%) a month | Projected |
| vs AWS-managed design | 68.4M VND a month running cost → this design is ~58% cheaper | Estimate |

The best-in-class assumption: today’s 25% rescue rises to 65%. Shipsy reports industry 20–30% and best-in-class 50–65% (vendor). The full model and every input are in PRD §18.8 and `02-technical/cost-model/cost_model.py`.

### 3.4 The two experience numbers

| Number | Meaning | Status |
| --- | --- | --- |
| **6 s** | From the buyer’s answer to the context card on the courier’s phone (time-to-context) | **Mock / target**: measured from the demo event log |
| **65%** | Failed deliveries resolved without a person, with 0 calls out of hours and 0 labels without approval (safe autonomy) | **Mock / target**: measured by the eval run (mock day: 60%) |

Supporting utilisation numbers (projected, per area per day):
- ≈ 416 CS calls handled by the agent (≈ 28 staff-hours).
- ≈ 96 fewer wasted courier trips.
- ≈ 24 minutes back per courier.

### 3.5 Rules (design numbers, not market data)

2-minute undo · chat first · AI call 1 after 60 min of silence · call 2 after +2 h · calls only 08:00–20:30 · max 2 calls per cycle · max 2 redeliveries · 5-day horizon · auto-apply only if every field ≥ 0.85 · refused → no contact · labels and returns need a person · opt-out ends contact · raw audio kept 30 days.

## 4. Competitors (backup slide B3)

**Headline:** *AI delivery rescue exists in India. Nobody builds it for Vietnamese buyers, starting from one courier tap.*

| | **Alodi** | ClickPost | Shipsy | AfterShip Agent | Ringg AI | Shiprocket | GHTK |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Market | Vietnam | India | India | Global | India | India | Vietnam |
| Trigger | Courier taps one meaningful button | NDR code | NDR event | Tracking exception | NDR | Courier marks NDR | Recipient books a slot |
| Reaching the buyer | Marketplace chat → AI call | SMS, email, WhatsApp, IVR, voice | Automated CX agent | Drafts for approval | Voice agent | SMS + IVR | App, hotline |
| Asks for a window before delivery | Yes, from the route planner | Not disclosed | Yes | Not disclosed | Not disclosed | Not disclosed | Yes, half-day |
| Context for the next attempt | JSON with confidence, audit | Reattempt / return | Not disclosed | Suggested fix | Disposition | Reattempt / return | Note |
| Human approval for high stakes | Required | Not disclosed | Not disclosed | Yes | Not disclosed | Seller | Call centre |
| Published results | Projected; measured at the demo | RTO −15–20% (Parth) | Rescue 20–30% industry | −58% resolution time (one customer) | — | — | — |

Source: ClickPost NDR Management and Parth (Angel One); Shipsy NDR guide; AfterShip exception agent; Ringg AI; Shiprocket docs; GHTK “Hẹn giờ giao”. Vendor figures are self-reported.

What makes Alodi different:
1. The trigger is a meaningful tap, not an error code.
2. Vietnamese-first channels: Shopee chat or Zalo first, then a Vietnamese AI call under a verified brand name.
3. Structured context goes back, not just an instruction.
4. A hard human boundary for refusals and labels.
5. It asks before it fails: the morning window question.

## 5. Team (slide S10)

| # | Member | Roles | Owns | Portrait |
| --- | --- | --- | --- | --- |
| 01 | **Nomura Yoshio** | Team Lead · Project Presenter | Product, pitch, demo script | `05-assets/team/nomura-yoshio.jpg` |
| 02 | **Long Quan Ton** | AI Engineer · Solution Architect | Agent, voice call, eval loop | `05-assets/team/long-quan-ton.jpg` |
| 03 | **Khanh Tuong Huynh** | AI Engineer · Deployment Engineer | Extraction, ASR, policy guard, deployment | `05-assets/team/khanh-tuong-huynh.jpg` |
| 04 | **Thanh Loi Tran** | Data Engineer · Backend Developer | Database, context object, APIs, metrics | `05-assets/team/thanh-loi-tran.jpg` |

## 6. Chart files

| File | Slide | Shows |
| --- | --- | --- |
| `01-problem-refusal-rates-{light,dark}` | S4 | Refusal rates by context |
| `02-problem-monthly-loss-{light,dark}` | S5 | 473M VND loss, by item |
| `03-output-before-after-{light,dark}` | S9 | Today vs with Alodi, −186M VND |
| `04-output-scenarios-{light,dark}` | B1 | Conservative / base / best-in-class |
| `05-output-cost-share-{light,dark}` | S9 | Running cost = 6.1% of the loss |
| `06-problem-survey-buyers-MOCK-{light,dark}` | S3 | Buyer pain frequency (mock until real) |
| `07-problem-survey-couriers-MOCK-{light,dark}` | S3 | Courier adoption (mock until real) |
| `08-output-three-numbers-{light,dark}` | S9 | 186M VND · 6 s · 65% |

Re-render after the real survey arrives: `python3 charts/make_charts.py` (needs matplotlib). It reads `../06-survey/customers.csv`, `couriers.csv` and the cost model output.

## 7. Sources

Cite in plain text (“Source: …”), never with numbered markers.

**Problem**
- Shopee Return & Refund Policy §7.1–7.2 (checked 31 Oct 2026): https://help.shopee.vn/portal/4/article/77251
- GHN, who pays for Shopee returns (₫40,000 cap since 1 Apr 2025): https://ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi
- Shopee Help Center 79559 (no delivery-time choice): https://help.shopee.vn/portal/4/article/79559
- Nguoi Lao Dong, 19 Jul 2025 (VECOM 8–12%; UEF 10–15%, 25–30%): https://tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm
- Shopee Help Center 79196 (COD disabled after 3 failures): https://help.shopee.vn/portal/4/article/79196
- Shopee Help Center 79569 (2–3 contacts, 5 days): https://help.shopee.vn/portal/4/article/79569
- Metric via Brands Vietnam, E-commerce 2025: https://www.brandsvietnam.com/congdong/topic/thi-truong-tmdt-viet-nam-nam-2025-nhung-chuyen-dich-dang-chu

**Money model**
- GHN, courier pay per order: https://ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien
- Glints Vietnam, courier income: https://glints.com/vn/blog/muc-luong-shipper/
- Shipsy, NDR rescue rates (vendor): https://shipsy.ai/insights/what-is-ndr-non-delivery-report-management
- Phong Vu, RTX 5060 Ti / 5090 listings: https://phongvu.vn/c/vga-rtx-5060-ti · https://phongvu.vn/c/vga-rtx-5090
- Viettel Mobile SIP trunk: https://viettelnet.vn/tong-dai-ao-tong-dai-noi-bo-sip-trunking-mobile-sip-viettel/
- Zalo ZNS price tables: https://www.oazns.vn/bang-gia-zns/ · https://worldfone.cloud/vi/blog/bang-gia-zalo-zns-tin-cskh-va-quang-cao · official: https://zalo.solutions/zns/pricing
- EVN business tariff: https://www.homecredit.vn/blog/cap-nhat-bang-gia-dien-kinh-doanh-moi-nhat-101
- gpt-oss-20b on 16 GB: https://semaphore.io/blog/gpt-oss
- PhoWhisper (VinAI): https://github.com/VinAIResearch/PhoWhisper

**Competitors**
- ClickPost NDR Management: https://www.clickpost.ai/ndr-management
- Angel One, ClickPost Parth: https://www.angelone.in/news/economy/logistics-firms-deploy-ai-to-reduce-failed-deliveries-and-rtos-by-up-to-20-for-d2c-businesses
- Shipsy last-mile: https://www.shipsy.ai/last-mile-delivery
- AfterShip exception agent: https://www.aftership.com/blog/exception-handling-agent
- Ringg AI: https://www.ringg.ai/use-cases/failed-delivery-recovery
- Shiprocket contact buyer: https://support.shiprocket.in/support/solutions/articles/43000664217-how-does-the-contact-buyer-functionality-work-
- GHTK scheduled delivery: https://ghtk.vn/blog/hen-gio-giao/
