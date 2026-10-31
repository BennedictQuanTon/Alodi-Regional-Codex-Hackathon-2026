# 2 · Pitch script (to fill)

The words are left blank on purpose; the team writes them. The structure, timing, slides, screens and the approved numbers are already fixed. Every number you say must come from §3 below, with its label (*sourced*, *projected*, *mock*).

---

## 1. Structure and timing

Total: **5:00** = 2:00 talk + 3:00 live demo (or play the 2-minute video if the demo fails).

| # | Time | Beat | Speaker | Slide (`4-SLIDES.md`) | Screen | Line (write here) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0:00–0:15 | Hook: “Have you ever…?” | Nomura Yoshio | S1 Title → S2 Hook | — | |
| 2 | 0:15–0:35 | What buyers and shippers told us (survey) | Nomura Yoshio | S3 Survey | — | |
| 3 | 0:35–0:55 | The real cost (research numbers) | Nomura Yoshio | S4 Problem numbers | — | |
| 4 | 0:55–1:10 | Why it doesn’t fix itself | Nomura Yoshio | S5 Loss per area | — | |
| 5 | 1:10–1:25 | Alodi in one sentence | Long Quan Ton | S6 How it works | — | |
| 6 | 1:25–4:25 | **Live demo** (run of show in `1-LIVE-DEMO.md` §3) | Long Quan Ton, Khanh Tuong Huynh, Thanh Loi Tran | S7 Demo | Phone · iPad · Laptop | see `1-LIVE-DEMO.md` |
| 7 | 4:25–4:35 | OpenAI at the core | Long Quan Ton | S8 Architecture | — | |
| 8 | 4:35–4:50 | What it delivers (money + two numbers) | Nomura Yoshio | S9 Output | iPad output view | |
| 9 | 4:50–5:00 | Ask and close | Nomura Yoshio | S10 Team + ask | Laptop lockup | |

## 2. Beat notes (what each beat must achieve)

| Beat | The judge should believe afterwards | Must mention | Must not say |
| --- | --- | --- | --- |
| Hook | “This has happened to me.” | One concrete moment (a missed shipper call) | Statistics yet |
| Survey | Real people feel it often | One buyer number and the shipper answer | Mock numbers as findings — use the real survey results |
| Problem numbers | The cost is real and paid by someone | 40,000 VND, 8–12%, 0 windows | “Billions” without the area basis |
| Loss per area | It is big at the level of one area | 473M VND a month, 20 shippers, 4,000 orders | That the 473M is all recoverable |
| Alodi | One tap, one conversation, one card | Shipper tap, chat, AI call, context card | “Fully automatic” |
| Demo | It works, live, on four screens | — | — |
| OpenAI core | The agent is real and safe | gpt-oss-20b runs locally; Structured Outputs; the policy guard is code | “Runs locally” for the demo if it calls cloud APIs |
| Output | It pays for itself | 187M VND a month (40%), costs 6% of the loss, 6 s, 65% | Money as measured — it is *projected* |
| Close | What happens next | Shadow mode at one area | Promises about dates you can’t keep |

## 3. Numbers you may say

| Say | Exact figure | Label | Source line (for the slide) |
| --- | --- | --- | --- |
| “Up to forty thousand dong per failed order” | 40,000 VND | Sourced | Shopee Return & Refund Policy §7.1, effective 11 Mar 2026 |
| “Eight to twelve percent of orders are refused” | 8–12% (up to 20% remote, 25–30% sale season) | Sourced | VECOM; Tran Anh Tung (UEF), Nguoi Lao Dong, 19 Jul 2025 |
| “Buyers have zero ways to pick a time” | 0 | Sourced | Shopee Help Center 79559 |
| “One area loses about 470 million dong a month” | 473M VND (447–499M), ≈ 5.7B VND a year | Modelled | PRD §18.8: Shopee §7.1, VECOM, Shipsy, GHN, Glints |
| “Alodi costs about 27 million a month to run, six percent of what is lost” | 27.3M VND a month; one-time server 75–98M VND | Estimate | PRD §18.8: Phong Vu, Viettel SIP, Zalo ZNS, EVN |
| “At best-in-class rescue, it saves about 187 million a month, 40 percent” | 187.4M VND a month; ≈ 2.25B VND a year | **Projected** | Shipsy best-in-class 50–65% (vendor); PRD §18.8 |
| “The shipper’s card appears six seconds after the buyer answers” | 6 s | **Mock / target** until measured in the demo | Demo event log |
| “Two out of three failed deliveries are resolved without a person, with zero calls out of hours” | 65%; 0 | **Mock / target** until the eval run | Eval report |
| Survey lines | from `../06-survey/` | **Fill with the real results** | Alodi buyer survey (n = …) and shipper interviews (n = …), Oct 2026 |

## 4. Words to use and avoid

| Use | Avoid |
| --- | --- |
| “one agent with tools” | “multi-agent system” |
| “structured context”, “context card” | “AI magic”, “fully automatic” |
| “projected” for money | showing mock numbers as results |
| “runs on a server at each area; the cloud is only a fallback” | “runs locally” about the demo if it uses cloud APIs |
| “buyer preference” for windows | “guaranteed time” |
| “suspected bomb — suggested, a person approves” | “the AI blacklists buyers” |

## 5. Q&A — short answers

**Is 8–12% real?** VECOM’s nationwide range, reported by Nguoi Lao Dong in July 2025. Our model uses 8%, the low end.

**Who pays?** On Shopee the seller pays up to 40,000 VND return shipping per failed order (policy §7.1); if the carrier is at fault, the seller doesn’t (§7.2).

**Where does 473M a month come from?** One area, 4,000 orders a day, 8% fail, 75% of those return: 288M in return fees, plus redelivery pay, shipper time and CS calls. Every input has a source in PRD §18.8.

**Is 40% realistic?** It assumes Alodi reaches the best-in-class rescue rate Shipsy publishes (65%). The base case is 20%. All money figures are projected until a pilot measures them.

**Why can’t Shopee just add a time picker?** It helps the first attempt only. It doesn’t capture “leave it with security” or “call my wife”, and buyers rarely open an app after a missed call.

**When does the agent call?** Only after 60 minutes of silence after the chat, only 08:00–20:30, at most twice per cycle. A reply cancels the pending call.

**What if the buyer is vague?** Every field needs confidence ≥ 0.85 to apply; otherwise the agent asks in chat, then a person reviews.

**What will the agent never do alone?** Label a buyer, return goods, accept an address outside the area, or contact a buyer who refused or said stop.

**Which models?** gpt-oss-20b (OpenAI’s open-weight model) and PhoWhisper run on a server at each area; OpenAI API is the fallback and the demo voice.

**Personal data?** Audio and transcripts stay on the area server for 30 days; only masked text can go to a cloud fallback.

**Is it one agent or many?** One agent running a per-order state machine with tools; the policy guard is code.

**What’s next?** Shadow mode at one area: the agent runs beside CS without contacting buyers, and we compare decisions.

**If you don’t know:** “We haven’t measured that yet. Our plan is …” Never invent a number.

## 6. Who says what

| Segment | Speaker |
| --- | --- |
| Hook, survey, problem, output, close | Nomura Yoshio |
| Alodi in one sentence, shipper tap, chat, timer, OpenAI core | Long Quan Ton |
| AI call, extraction, refusal boundary | Khanh Tuong Huynh |
| Context card, audit log, data | Thanh Loi Tran |
