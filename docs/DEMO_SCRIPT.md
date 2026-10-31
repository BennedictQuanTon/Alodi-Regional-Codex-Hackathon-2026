# Alodi demo script · 31 October 2026

The team's editable copy. The `/script` page in the app shows the same content (data in `web/src/lib/script.ts`); keep both in sync.

Everything runs in the browser on mock data with a **fast-forward demo clock** (60 minutes ≈ 6 seconds at 1x). No real phone numbers are called.

## 0. Set up the recording machine

| Task | How |
| --- | --- |
| Run the app | `cd web && npm run dev`, then open `http://localhost:3000` |
| Three-screen stage | `/demo`: courier app, buyer phone and CS console side by side |
| Record each screen separately | Open `/demo/shipper`, `/demo/buyer`, `/demo/console` in three windows. They **stay in sync** (BroadcastChannel); press Play in any of them. `H` hides the controls for a clean frame |
| Shortcuts | `Space` play/pause · `→` next step · `R` reset |
| Auto-tap | On for the trailer (the engine taps buttons itself after a few seconds). Off for the live demo so the presenter taps |
| Sound | Turn on “Sound” for the ringtone and the call dialogue via the browser’s English TTS voice |
| Captions | Turn on “Captions” on `/demo` to show the step caption at the bottom of the frame |

## 1. Trailer, 90 seconds (pre-recorded)

| Time | Screen | Action | Voice-over |
| --- | --- | --- | --- |
| 0:00–0:06 | Logo motion | Orange dot blinks on navy → ring expands → orange fills the frame, cut (variant A of the branding sheet) | Every day, a 10,000-order depot sees about 800 deliveries fail on the first try. |
| 0:06–0:18 | Landing · The problem | Slow scroll across the four hero numbers; hold on 40,000 VND and 0 windows | Sellers pay up to forty thousand dong to ship each one back. And the delivery time — the thing that decides whether a buyer accepts — is negotiated outside the system. |
| 0:18–0:26 | `/demo/shipper` | 10:02, the courier calls, no answer. Close-up of tapping “A · No answer” | With Alodi, the courier taps one button. |
| 0:26–0:36 | `/demo/buyer` | The message lands with quick replies. Clock fast-forwards 10:02 → 11:02 | The agent messages at once, while the buyer is watching their phone. Sixty silent minutes later, it calls. |
| 0:36–0:56 | `/demo/buyer`, call | Incoming call under a verified name. Answer, let the audio run with captions | (Call audio) “Tomorrow after five, please. Leave it with security in Tower B — or call my wife.” |
| 0:56–1:08 | `/demo/console` | Fields appear with confidence bars; the JSON bumps a version and the changed block lights up | The answer becomes structured data, each field with its own confidence. Confident enough, it applies itself. Ambiguous, it goes to a person. |
| 1:08–1:20 | `/demo/shipper` | The context card slides in. Cut to the next day, 17:22, tap Delivered | Seconds later the context card is in the courier’s app. The next day, the parcel reaches the right person, at the right time. |
| 1:20–1:30 | Landing · Team → logo | Glide past Team Develarper, end on the logo | Alodi. Make the second drop land. |

## 2. Live demo, 3 minutes (on stage)

| Time | Speaker | Line | Action |
| --- | --- | --- | --- |
| 0:00 | Nomura Yoshio | A depot handling 10,000 orders a day sees about 800 fail on the first attempt. Each return costs the seller up to forty thousand dong. And Shopee still doesn’t let buyers choose a delivery time. | Problem slide (or landing · The problem) |
| 0:30 | Nomura Yoshio | Three screens: the courier app, the buyer’s phone, and the customer-service console. The demo clock fast-forwards: sixty minutes become six seconds. | Open `/demo`, scenario “A · No answer”, Auto-tap off, Play |
| 0:45 | Long Quan Ton | The courier arrives, calls, no answer. Instead of typing a note, he taps one button. | Tap A in the courier app |
| 1:00 | Long Quan Ton | The agent messages right away. The buyer stays silent, so exactly sixty minutes later it calls — after the policy guard checks the time. | Point at the “Call hours 08:00–20:30 · inside” chip |
| 1:15 | Khanh Tuong Huynh | The buyer answers like people really do: time, drop-off and a stand-in receiver in one breath. The extractor splits it into fields, each with a confidence score. | Tap Answer on the buyer’s phone |
| 1:50 | Thanh Loi Tran | Everything is above 0.85, so the agent applies it. The Order Context Object gets a new version, and the audit log shows who changed what. | Point at the highlighted JSON block and the audit log |
| 2:05 | Long Quan Ton | Four seconds after hang-up, the context card is in the courier’s app. The next day, delivered. | Let it run to Delivered (or `→`) |
| 2:20 | Khanh Tuong Huynh | And when a buyer refuses at the door, the agent doesn’t call. It only suggests a label; a person decides. | Pick “Refused”, 2x, Play |
| 2:40 | Nomura Yoshio | Two numbers are measured: accuracy and safe autonomy. Savings are always projected. Alodi — make the second drop land. | Open `/metrics` |

## 3. AI call dialogue (main flow)

For voicing the call if you don’t use the browser TTS. Assistant: warm female TTS voice; greeting and consent are pre-recorded. Mr. Minh: a real person, natural and a little rushed.

1. **Assistant** *(pre-recorded)*: Hello Mr. Minh, this is the automated delivery assistant calling about your air fryer. This call is recorded so we get the delivery right — is that okay?
2. **Mr. Minh**: Sure, go ahead.
3. **Assistant** *(TTS)*: Our courier missed you this morning. Tomorrow we have 8 to 12, or 5 to 8 in the evening. Which works for you?
4. **Mr. Minh**: Tomorrow after five, please. I’m out until late, so leave it with security in Tower B. Or call my wife, 0903 xxx 214.
5. **Assistant** *(TTS)*: Confirming: Sunday 1 November, 5 to 8 pm, left with Tower B security, and your wife on 0903 xxx 214 if needed. Is that right?
6. **Mr. Minh**: That’s right.
7. **Assistant** *(pre-recorded)*: Thank you, Mr. Minh. Have a good afternoon.

Extracted: window 1 Nov 17:00–20:00 (0.94) · drop-off Tower B security (0.88) · alternate receiver wife 0903 xxx 214 (0.91) → auto-applied.

## 4. The five scenarios in the engine

| Scenario | What happens | Talking point |
| --- | --- | --- |
| A · No answer | Chat → 60′ → AI call 1 → extraction → context card → delivered next day | The main flow and the Time-to-context moment |
| B · Rescheduled | Courier’s 10-second voice memo → ASR → same schema → context card | No need to record the courier’s personal calls |
| Refused | No buyer contact, “suspected bomb” label suggested, CS approves | The autonomy boundary; no effort wasted on refusals |
| A · Low confidence | Vague answer (0.52 / 0.41) → review queue → CS confirms | The agent knows when to stop |
| A · Two missed calls | Missed at 11:02 and 13:02 → handed to CS, call-backs route to the hotline | Hard rule: at most two calls per cycle |

## 5. Checklist before demo day

- [ ] Test the browser’s English TTS voice on the recording machine.
- [ ] Open three 1080p windows for the trailer and check they stay in sync.
- [ ] Auto-tap on for the trailer, off for the live demo.
- [ ] Silence OS notifications, speed 1x, press `R` before every take.
- [ ] Record a backup video of the full main flow.
- [ ] Replace the mock numbers on `/metrics` with real eval results (`web/src/components/dash/metrics.tsx`).
- [ ] Know the five FAQ answers on the landing page by heart.

## 6. Q&A prep

- **Does the demo call real numbers?** No. The call runs in the browser. Production uses a branded call line.
- **Why doesn’t the agent label “suspected bomb” itself?** The label counts toward the buyer’s 3-orders-in-90-days COD lock, so a person must approve.
- **Personal data?** Raw audio and transcripts stay in a trusted zone with a deletion window; only extracted JSON leaves it; phone numbers and addresses are masked before cloud model calls.
- **Fine-tuning?** Not for the hackathon. In production: ASR for regional accents and address vocabulary first, then distil the extractor.
- **How is this different from ClickPost or Shipsy?** They start from the carrier’s NDR code and the Indian market. Alodi starts from one meaningful courier tap, speaks Vietnamese, returns structured context with confidence, and draws a clear human-approval line.
