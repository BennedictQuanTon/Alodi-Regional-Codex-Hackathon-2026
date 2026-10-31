# 3 · Demo video — 2:00 motion film

A two-minute product film in English that tells the whole pitch on its own. It moves through hook → problem → product on four screens → OpenAI at the core → output. It is also the backup if the live demo fails.

Charts used in the film: [`charts/`](charts/) (light and dark, SVG + PNG). Brand: [`../04-brand/`](../04-brand/). Source logos: [`../05-assets/logos/sources/`](../05-assets/logos/sources/). Team portraits: [`../05-assets/team/`](../05-assets/team/). Photos the team supplies on 31 October are marked **[USER IMAGE n]**.

---

## 1. Brief

| | |
| --- | --- |
| Length | **2:00** (120 s), plus a 0:45 vertical cut for social |
| Format | Master 16:9, 1920 × 1080, 30 fps; vertical cut 1080 × 1920 (the references are 720 × 1280 at 30 fps) |
| Tempo | Music at **120 BPM**: 1 beat = 0.5 s = **15 frames**, 1 bar = 2 s. The whole film is 60 bars, and every cut lands on a beat |
| Language | English voice-over and on-screen text |
| Tone | Calm, precise, quietly confident: a product film, not an ad |
| One idea per shot | Never more than **6 words** on screen at once (source lines excepted) |

## 2. What we take from the reference videos

The five clips in the repository root were studied frame by frame, and their audio was measured (tempo, onset density, time to the first sound).

| Reference (creator) | What it does | What we take |
| --- | --- | --- |
| `2041c933…` (@thejimmy.vision) · 56.6 s · 112 BPM · 5.1 sounds/s | Persistent question caption on top (“What if your ad…”); kinetic words on black (“You just got”, “But|” with a caret); light product dashboards panned and zoomed; nodes connecting; counters (“177 leads → 35 calls”); closes on “Start your … today” | The **persistent question caption** for the vertical cut; **word-by-word type with a caret**; **counters between two numbers**; ending on a short imperative |
| `6997df2f…` (@thekevin.mp4) · 37.1 s · 108 BPM · 4.3 sounds/s | One glowing word on black; **hairlines that draw themselves** into a node graph; a big ring; a prompt box (“What will we build?”); code lines that turn green with checks; a tree that grows | **Self-drawing hairline diagrams** for the architecture; **rules turning “pass” one by one**; a single ring as the hero shape (our mark is a ring) |
| `f91ce5ae…` (@themilesholden) · 18.0 s · 92 BPM · 3.0 sounds/s | Split screen: a **wireframe sketch on the left becomes polished UI on the right**; prices count; a line chart draws; ends with a word typed letter by letter | **Sketch → real UI morph** for the four screens; **typed endings** |
| `8d7913bb…` (@nickmotionstudio) · 17.0 s · 123 BPM · 4.4 sounds/s | A tiny story told in **message bubbles** (“Brother I’m starving” → “Try UberEats”), then search, choices, a map route, the logo | Open the problem with a **chat-bubble micro-story** on the buyer’s phone |
| `63393f96…` (@mcvisuals.fx) · 14.9 s · 144 BPM · 4.8 sounds/s | Phone UI scenes (dynamic island, meeting title typed, checklists, call controls with a red hang-up, glowing audio bars); the edit timeline shows **dense layered SFX**, nearly one per visual change | **One sound per visual event**; **audio bars as the call visual**; call controls |

Measured audio in common:
- **The first sound lands within 0.07–0.77 s.** Never open silent.
- **3–5 distinct sounds per second** in the busy sections.
- **Tempo 92–144 BPM**, centred on about 110–125.

We pick **120 BPM** because it divides cleanly into frames (15 per beat).

## 3. Style guide

### 3.1 Colour (the product UI palette; no new colours)

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Night background | deep navy | `#121A2C` | Hook, architecture, end card |
| Day background | parchment | `#F6F3F1` | Problem receipts, output charts |
| Ink on day | navy | `#1F2A44` | All text on parchment |
| Ink on night | parchment | `#F6F3F1` | All text on navy |
| Secondary ink | slate | `#5A6173` / `#B8BFCF` | Sub-lines, source lines |
| **Accent (one per frame)** | orange | `#F05A00` | The single thing the eye must hit: the tapped button, the saved number, the active wire |
| Data (charts only) | chart blue | `#3F5FAE` day / `#6D8AD6` night | Bars and lines; palette validated for colour-blind separation |

Rules:
- Orange appears **once per frame**.
- Never use gradients, glows on everything, neon, purple or rainbow.
- The only “glow” allowed is a 12 % orange bloom on the logo’s sound bars at the drop.

### 3.2 Type (the demo’s font, not the landing page’s)

| Use | Font | Size at 1080p | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Display words (kinetic) | **Geist** | 96–140 px | 500 | −2 % |
| Big numbers | **Geist** | 160–220 px | 600 | −3 %; proportional figures |
| Sub-lines | **Geist** | 36–44 px | 400 | 0 |
| Labels, timestamps, source lines, code | **Geist Mono** | 22–28 px | 400 | +2 %, uppercase for labels |
| Wordmark | Be Vietnam Pro ExtraBold (outlined SVG in `04-brand/logo/`) | — | — | — |

- Not used: Source Serif 4 (landing only), Playfair (dashboard only), any coding-style monospace other than Geist Mono.
- Geist has no “₫” glyph, so money is written **“187M VND”**.
- Sentence case. No exclamation marks. Words enter one at a time.

### 3.3 Logo in motion (mark C: ring + sound bars)

| Moment | Animation |
| --- | --- |
| Drop (0:30) | The ring draws clockwise in 12 frames (stroke on, out-expo). The four sound bars rise from 0 to their heights with a 3-frame stagger and overshoot 6 %. The wordmark slides 24 px up from behind a mask |
| During the AI call | The sound bars **become the call waveform**: bar heights follow the voice amplitude (RMS of the TTS track, smoothed over 3 frames) |
| Pass marks | A **ring + check** (brand mark B) stamps beside each policy rule as it passes. It is the only “check” glyph used |
| End sting | The bars pulse three times on the last three beats, settle to rest, then hold 1 s of silence |

### 3.4 Motion language

| Parameter | Value |
| --- | --- |
| Entrances | Out-expo `cubic-bezier(0.16, 1, 0.3, 1)`, 12–18 frames, 24–40 px travel plus fade from 0 |
| Transitions | In-out `cubic-bezier(0.65, 0, 0.35, 1)`, 15 frames (one beat) |
| Word stagger | 3 frames per word (two words a beat at 120 BPM) |
| Counters | 18–30 frames, out-expo, digits in tabular figures only while counting, proportional at rest |
| Camera on UI | Slow 2.5D push-in, 100 → 106 % over a shot; 4–6° tilt only on the four-screen hero shot; 180° shutter motion blur on fast moves |
| Line drawing | Hairlines 2 px; stroke-dashoffset draw at 40–60 frames per full path; nodes pop with a 2-frame scale overshoot |
| Masks | Text reveals through a rectangular mask (slide up), never a fade-only |
| Cuts | On the beat, always; hard cuts inside a section, a one-beat in-out move between sections |
| Holds | Every key number holds **at least 1.5 s (3 beats)** after landing |

### 3.5 Anti-slop rules (the film fails review if any appear)

- No stock 3D robots, brains, glowing chips, holograms, sparkles, “AI” stars or wand icons.
- No floating gradient blobs, lens flares, particle fields, bokeh.
- No emoji, no clip-art icons. Glyphs are the Alodi marks and plain arrows only (→ ↓ ›). Real logos only where they name a real company (Shopee, OpenAI, VinAI, sources).
- No more than two easing curves in the whole film.
- No drop shadow over 8 % opacity, no bevels, no outer glows.
- No typewriter effect on long sentences. The caret is used on 2–4 words at most.
- No fake numbers: every number on screen carries its label (*projected*, *mock*, *measured*) and a source line in Geist Mono for at least 2 s.
- No citation markers like [1] or superscripts. Sources are a plain text line.

## 4. Sound

### 4.1 Music

| | |
| --- | --- |
| Tempo / key | 120 BPM, F minor → A♭ major lift at the output section |
| Character | Minimal electronic: soft plucks, deep sub kick, crisp closed hats, sidechained pad. Think a product keynote, not EDM |
| Structure | Bars 1–4 sparse (hook) · bars 5–15 tension with a filtered riser (problem) · **bar 16 drop** (0:30, the product) · bars 34–45 half-time breakdown (OpenAI core) · bars 46–56 full energy with the major lift (output) · bars 57–60 outro, final hit, 1 s silence |
| Loudness | Music bed −20 LUFS under voice-over, −14 LUFS integrated for the master (web/YouTube); duck music 6 dB under voice |

How to get it:
1. **Generate it with Stable Audio Open 1.0.** The Stability AI Community License allows commercial use under 1M USD a year in revenue. Generate stems in 10–20 s blocks and arrange them in a DAW.
   - Prompt A (bed): *“minimal electronic product film music, 120 BPM, F minor, soft plucked synth arpeggio, deep sub bass, crisp closed hi-hats, sidechained warm pad, clean, modern, no vocals”*
   - Prompt B (drop): *“same track, full energy section, punchy kick on every beat, bright plucks, wide stereo, 120 BPM, no vocals”*
   - Prompt C (riser): *“4-second filtered white-noise riser into impact, cinematic, clean”*
2. **Or license a track** from Pixabay Music or Mixkit. Both allow commercial use without attribution (check each file’s licence page). Search: *“minimal tech 120 bpm”*, *“product launch electronic”*.
3. MusicGen is **not** used: its weights are under a non-commercial licence.

### 4.2 Sound effects (one sound per visual event)

| Event | Sound | Free source and search term | Licence |
| --- | --- | --- | --- |
| Word lands | Soft tick, short and dry | Kenney “Interface Sounds” (`tick`, `click`) | CC0 |
| Caret blink / typing | Light key taps | Freesound, CC0 filter: “keyboard single key soft” | CC0 (check each clip) |
| Button tap (A / B / C, Approve) | Tight click + low thud for haptics | Kenney Interface Sounds + Mixkit “mouse click” | CC0 / Mixkit free |
| Chat bubble | Soft pop, pitched up per bubble (+1 semitone) | Mixkit “bubble pop”, Pixabay “ui pop” | Mixkit free / Pixabay |
| Window chips (4) | Four rising pops on beats | same as above, pitched | — |
| Undo ring / timer | Clock tick that accelerates during fast-forward | Freesound CC0 “clock tick”, time-stretched | CC0 |
| Phone ring | **Synthesised** dual-tone ring, not a branded ringtone | Make it in the DAW (two sine tones, 440 + 480 Hz) | Own |
| Transcript words | Very soft typing under the voice | Freesound CC0 | CC0 |
| Fields fly into the card | Whoosh (short) + soft chime on arrival | Mixkit “whoosh”, Kenney “confirmation” | Mixkit free / CC0 |
| Card slides into the phone | Swish + “glass” tap | Pixabay “swoosh”, Kenney | Pixabay / CC0 |
| Pass mark (ring + check) | Short bright blip | Kenney Interface Sounds | CC0 |
| Lines drawing | Very low granular hiss that follows stroke length | Freesound CC0 “paper swipe soft” | CC0 |
| Number lands | Sub “boom” (40–60 Hz) + tick | Pixabay “cinematic boom” (trimmed) | Pixabay |
| Section change | Reverse cymbal into a hard cut | Pixabay “reverse cymbal” | Pixabay |
| Drop / logo | Impact + bars “bloop” chord | Stable Audio Open prompt: *“short warm synth impact with sub, product logo sting”* | Stability Community |

Density rules from the references:
- **3–5 sounds per second** in the product section.
- **1–2 per second** in the problem section.
- **A 0.5 s pocket of silence** before each headline number.

Keep a sound log (file, source URL, licence) in the project folder for any CC-BY sound.

### 4.3 Voice-over

- Record with a teammate in a quiet room, or use OpenAI `gpt-4o-mini-tts` with voice “coral” and instructions *“warm, clear, unhurried product narrator”*.
- Keep it to about 210 words for 2:00 (≈ 105 wpm, leaving room for music moments).

## 5. Shot list (60 bars at 120 BPM)

Timecodes are mm:ss:ff at 30 fps. **Bold** text is on screen. *Italic* text is voice-over (VO).

### 5.1 Hook — bars 1–4 (00:00:00 – 00:08:00), night background

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 00:00:00 | Black navy. A caret blinks at centre | — | — | Kick + key tap (first sound at frame 2) |
| 00:00:15 | Words type in, one per half-beat | **Have you ever** | *Have you ever…* | Tick per word |
| 00:01:15 | Line 2 replaces line 1 (mask up) | **missed the courier’s call** | *missed the courier’s call…* | Ticks |
| 00:02:15 | Line 3 | **in the middle of a meeting?** | *…in the middle of a meeting?* | Ticks, low thud on “meeting” |
| 00:04:00 | Cut to the **buyer phone** (`/buyer`, real UI): a lock-screen notification slides in: “Missed call · Courier” ×2 | Notification text (UI) | — | Two muted vibration buzzes |
| 00:05:15 | Chat-bubble micro-story (as @nickmotionstudio): “Your parcel is being returned to the seller.” | Bubble (UI) | *Then your parcel goes back.* | Soft pop, then a descending two-note “miss” |
| 00:07:00 | The bubble greys out; the screen pushes away | — | — | Reverse cymbal into the cut |

Vertical cut: a persistent caption sits on top for the whole film, as in the references: **“What if a missed call didn’t mean a missed delivery?”**

### 5.2 Problem — bars 5–15 (00:08:00 – 00:30:00), day background

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 00:08:00 | Chart 06 (buyer survey) builds from the centre line outwards, one row per beat | **We asked 100 buyers.** | *We asked a hundred buyers.* | Tick per row |
| 00:11:00 | The top row’s “often” share counts up | **[real %] often called while busy** | *[real line]* | Boom on landing |
| 00:12:15 | Chart 07: the 12 courier dots pop one by one, orange for “yes” | **…and 12 couriers.** → **[real] want it. [real] said no.** | *And twelve couriers.* | 12 pops, pitched up |
| 00:16:00 | **Receipt 1**: a browser frame with a screenshot of the Shopee Return & Refund Policy page **[USER IMAGE 1]**; an orange underline wipes under the fee | **40,000 VND** counts 0 → 40,000 · source line | *Every failed order can cost the seller forty thousand dong.* | Wipe hiss, boom |
| 00:20:00 | **Receipt 2**: the Nguoi Lao Dong headline **[USER IMAGE 2]** → chart 01 bars grow | **8–12% refused** · **25–30% in sale season** | *Eight to twelve percent are refused at the door.* | Ticks, boom |
| 00:24:00 | **Receipt 3**: Shopee Help Center 79559; the sentence types in Geist Mono: “Shopee does not yet support choosing a specific delivery time.” | **0 ways to pick a time** | *And buyers have no way to pick a time.* | Typing, then silence |
| 00:27:00 | Chart 02: bars fill, then the title number rolls | **One area loses 473M VND a month** | *One area loses four hundred seventy million dong a month.* | 4-s riser starts at 00:26:00 |
| 00:29:15 | Hold, then **0.5 s of silence** | — | — | Silence pocket |

Every receipt shows its source line in Geist Mono for at least 2 s: `Source: Shopee Return & Refund Policy §7.1 · 11 Mar 2026` etc.

### 5.3 The product on four screens — bars 16–33 (00:30:00 – 01:06:00)

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 00:30:00 | **Drop.** The Alodi mark draws (ring, then the sound bars), the wordmark rises | **Alodi** → **Make the second drop land.** | — | Impact + logo sting, music drop |
| 00:33:00 | Sketch → UI (as @themilesholden): four wireframes in a 2 × 2 grid morph into the real screens with a slight 2.5D tilt; Geist Mono labels pop beside them | **01 COURIER · 02 OPS · 03 BUYER · 04 CONTROL** | *One agent. Four screens. All live.* | Four pops on beats |
| 00:36:00 | Clock flips to 06:30 on the iPad; the buyer chat gets the window question; four chips pop | **Every morning, ask first.** | *Every morning, Alodi asks each buyer for two windows.* | Rising pops |
| 00:40:00 | Phone close-up: thumb taps **A · No answer** (orange); the undo ring sweeps | **One tap. No typing.** | *If it still fails, the courier taps once.* | Click + haptic thud, ticking |
| 00:44:00 | Chat bubble “We just missed you…” on the laptop; the iPad timer “AI call 1 in 60:00” fast-forwards | **Chat first. Call on silence.** | *Alodi messages straight away, and calls if there’s silence…* | Pop; ticking accelerates |
| 00:48:00 | Policy line appears with a ring + check: “08:00–20:30 · call 1 of 2” | **Inside the rules.** | *…only inside the rules.* | Blip |
| 00:50:00 | The laptop rings; the logo’s sound bars become the call waveform; the buyer’s words appear as they speak | Transcript line | Buyer (recorded): *“Tomorrow after five… security in Tower B… or call my wife.”* | Synth ring, voice, soft typing |
| 00:56:00 | The sentence splits into three fields that fly into a card; confidence bars fill 0.94 / 0.88 / 0.91; stamp “Auto-applied” with ring + check | **One sentence → three fields** | *One sentence becomes structured context.* | Whoosh ×3, chime |
| 01:00:00 | The card slides into the courier’s phone; jump to “Sun 17:22” → **Delivered** | **Second drop: landed.** | *The next courier knows when, where and who.* | Swish, glass tap, boom |
| 01:03:00 | Tap **C · Refused** → iPad CS queue “Suggested label · needs a person” → a hand taps **Approve** | **High stakes stay human.** | *And anything high-stakes goes to a person.* | Click, blip |

### 5.4 OpenAI at the core — bars 34–45 (01:06:00 – 01:30:00), night background, half-time

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 01:06:00 | Hairlines draw the system (as @thekevin.mp4): Courier tap → **Alodi Agent** → tools (chat · call · extract) → **Policy guard** → Card | Node labels in Geist Mono | *Under the hood, one agent runs every order.* | Granular hiss following the lines |
| 01:10:00 | Agent node expands: **gpt-oss-20b** with the OpenAI logo (real logo, once) and the tag “runs on the area server” | **OpenAI gpt-oss-20b · on site** | *OpenAI’s open-weight model makes the decisions, on a server at each area.* | Low pulse |
| 01:14:00 | The extract tool opens: the strict JSON schema types out key by key, values fill from the call | `time_window` · `drop_location` · `alt_receiver` | *Structured Outputs turn speech into strict JSON.* | Typing |
| 01:18:00 | The voice node: the assistant line with the waveform; tag “OpenAI TTS” | **The assistant’s voice** | *OpenAI’s voice speaks to the buyer.* | Waveform tone |
| 01:21:00 | The policy guard: rules turn “pass” one by one with ring + check marks: call hours · max 2 calls · 5-day frame · consent · 0.85 confidence · refused → no contact | Rule list | *Every action passes a guard written in code, not in a prompt.* | Blip per rule (6, on half-beats) |
| 01:26:00 | Fallback wire to “OpenAI API · masked text · hard 10 %” lights in orange, then dims | **Cloud only for the hard cases** | *The cloud only sees masked text, for the hardest ten percent.* | Riser into the output |

### 5.5 Output — bars 46–56 (01:30:00 – 01:52:00), day background, major lift

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 01:30:00 | Headline types in | **We tested it on [N] real cases.** *(fill after the eval; otherwise “on 47 test conversations”)* | *[fill]* | Ticks |
| 01:33:00 | Eval numbers count up | **F1 [measured] · 0 calls out of hours · 0 labels without approval** | *[fill with measured numbers]* | Boom on each |
| 01:37:00 | Chart 03: the “Today” bar (473M) stands; the “With Alodi” bar drops to 286M; the orange cost sliver appears | **−187M VND a month** | *At best-in-class rescue, one area saves about a hundred eighty-seven million dong a month…* | Silence pocket, then boom |
| 01:42:00 | The counter rolls to the year | **≈ 2.25B VND a year · 40% of the loss** | *…two point two five billion a year.* | Boom |
| 01:45:00 | Chart 05: the cost bar fills to 5.8 % | **27M VND a month to run · 6% of the loss** | *It costs six percent of what is lost.* | Tick |
| 01:48:00 | Chart 08 tiles 2 and 3 flip in | **6 s to context · 65% handled alone** | *Six seconds from answer to card. Two in three cases handled alone.* | Two blips |
| 01:51:00 | Label line | `Money projected · Shipsy best-in-class (vendor) · PRD §18.8` | — | — |

### 5.6 End — bars 57–60 (01:52:00 – 02:00:00), night background

| TC | Visual | On screen | VO | Sound |
| --- | --- | --- | --- | --- |
| 01:52:00 | Four team portraits slide in on beats (`05-assets/team/`) **[USER IMAGE 3–6 if newer]** | Names + roles in Geist Mono | *We’re Team Develarper.* | Four ticks |
| 01:55:00 | Lockup: mark C + wordmark + tagline | **Alodi — Make the second drop land.** | *Alodi. Make the second drop land.* | Logo sting: bars pulse three beats |
| 01:58:00 | Hold, then cut to black | — | — | Final hit, 1 s silence |

## 6. Assets

| Asset | Where |
| --- | --- |
| Screen recordings of `/courier`, `/ops`, `/buyer`, `/control` | Record at 2× scale (Screen Studio, OBS or QuickTime) from the live build; 60 fps; hide the cursor, add a touch dot in the edit |
| Charts 01–08 | [`charts/`](charts/): use the SVGs for crisp scaling; dark versions on night backgrounds |
| Brand marks, wordmark, lockups | `../04-brand/` (outlined SVG) |
| Source logos | `../05-assets/logos/sources/` |
| Tech logos (OpenAI, VinAI) | `../05-assets/logos/tech/` (real logos only where they name the company) |
| Receipts | **[USER IMAGE 1–2]** screenshots of the Shopee policy page and the Nguoi Lao Dong article, plus Help Center 79559, captured in a clean browser window at 2× |
| Team portraits | `../05-assets/team/` or **[USER IMAGE 3–6]** |
| Fonts | Geist, Geist Mono (`charts/fonts/`, SIL OFL); Be Vietnam Pro for the wordmark only |

## 7. Tools

| Need | Pick | Why |
| --- | --- | --- |
| Motion | **Motion Canvas** (code, TypeScript; renders with our tokens and Geist) or **After Effects** | Remotion would need a company licence: its free tier is for teams of up to 3 people, and we are 4 |
| Edit and mix | DaVinci Resolve (free) or Premiere | Beat markers at 120 BPM, Fairlight for ducking and loudness |
| Music | Stable Audio Open 1.0 + a DAW, or a Pixabay or Mixkit track | §4.1 |
| SFX | Kenney Interface Sounds (CC0), Freesound (CC0 filter), Mixkit, Pixabay | §4.2 |
| Export | H.264, 1080p30, 12–16 Mbps, AAC 320 kbps, −14 LUFS; plus a ProRes master | — |

Motion Canvas easing to match §3.4:

```ts
import { easeOutExpo, easeInOutCubic } from "@motion-canvas/core";
// entrances: easeOutExpo, 12–18 frames (0.4–0.6 s); transitions: easeInOutCubic, 0.5 s (one beat at 120 BPM)
const BEAT = 0.5; // seconds
```

## 8. Prompts

### 8.1 Director’s brief (paste to an editor or a design assistant)

> Make a 2-minute 16:9 product film for **Alodi**, an AI agent that rescues failed deliveries in Vietnam. The style is minimal, editorial and precise, like an Apple keynote product reel crossed with a Linear launch video. Dark navy `#121A2C` and parchment `#F6F3F1` backgrounds, navy ink `#1F2A44`, **one orange `#F05A00` accent per frame**, chart blue `#3F5FAE` / `#6D8AD6`. Type is **Geist** (500 for display, 600 for numbers) with **Geist Mono** uppercase labels and source lines; no serif, no other fonts. Music is at 120 BPM and every cut lands on a beat (15 frames at 30 fps). Words enter one at a time through a mask, with an out-expo ease and a 3-frame stagger. The real product UI is the hero: four screens (courier phone, carrier iPad dashboard, buyer phone, control). Hairline diagrams draw themselves. Numbers count up and hold for 3 beats with their source line visible. The logo is a ring with four sound bars, and the bars become the call waveform. Use one sound effect per visual event, 3–5 per second in busy parts, with a half-second of silence before each headline number. Forbidden: gradients, glows, particles, lens flares, 3D robots, sparkles, emoji, stock icons, more than two easing curves, and any number without its label.

### 8.2 Scene prompts

| Scene | Prompt |
| --- | --- |
| Hook | *Navy background, a single blinking caret, then “Have you ever / missed the courier’s call / in the middle of a meeting?” word by word through a slide-up mask, one tick per word; cut on the beat to a real phone lock screen receiving two missed-call notifications.* |
| Problem receipts | *Parchment background. A clean browser window slides in holding a policy page screenshot; an orange underline wipes under “40,000”; the number counts from 0 with a sub boom; a Geist Mono source line fades in bottom-left and stays for 2 seconds.* |
| Four screens | *Four wireframe sketches in a 2 × 2 grid morph into the real UI screens in 15 frames each, with a slight 2.5D tilt and soft 6 % shadow; uppercase Geist Mono labels 01–04 pop beside each screen on consecutive beats.* |
| The tap | *Macro push-in on a phone; a thumb taps an orange “A · No answer” button; a thin 2-minute ring sweeps; the iPad in soft focus behind shows the same event appearing as “pending”.* |
| The call | *Laptop rings; the Alodi logo’s four sound bars detach and follow the voice waveform; the transcript appears as spoken in white Geist on navy; the sentence then splits into three labelled fields that fly into a card with confidence bars filling.* |
| OpenAI core | *Hairlines draw a five-node system on navy, 2 px, with nodes popping on the beat; one node expands to show “gpt-oss-20b · on site” with the OpenAI logo; a strict JSON schema types out; six rules each get a ring-and-check stamp.* |
| Output | *Two thin columns: “Today 473M VND” and “With Alodi 286M VND”, with an orange sliver for the running cost; a large “−187M VND a month” counts in, then “≈ 2.25B VND a year · 40%”; the label “projected” stays visible.* |
| End | *Four team portraits slide in on beats; the Alodi lockup forms (the ring draws, the bars rise, the wordmark lifts); the bars pulse three times, then hold in silence.* |

### 8.3 Work worth studying (for the bar, not to copy)

- Apple product reels from its keynotes: pacing, holds on numbers, restraint with colour.
- Linear and Raycast launch videos: UI as the hero, hairline diagrams, mono labels.
- Vercel Ship and Stripe Sessions openers: type-led motion, grid discipline.
- Granola (seen in the @mcvisuals.fx reference): sound bars as an identity device.
- The five references in §2: word-level type, sketch-to-UI, bubble stories, SFX density.

## 9. Before export — checklist

- [ ] Every number has its label and a source line on screen for ≥ 2 s.
- [ ] Survey numbers replaced with the real results, or the survey shots removed.
- [ ] The output section uses measured eval numbers, or says “target”.
- [ ] Orange appears once per frame; no font other than Geist, Geist Mono and the wordmark.
- [ ] Cuts on the beat; first sound in the first 3 frames; 0.5 s silence before each headline number.
- [ ] SFX and music licences logged; no branded ringtone.
- [ ] Master at −14 LUFS, peaks ≤ −1 dBTP; captions burned in for the vertical cut.

Sources for licences and tools: Stability AI Community License (Stable Audio Open): https://stability.ai/license · Pixabay Content License: https://pixabay.com/service/license-summary/ · Mixkit licence: https://mixkit.co/license/ · Freesound licences: https://freesound.org/help/faq/ · Kenney assets (CC0): https://kenney.nl/assets · Remotion licence: https://www.remotion.dev/docs/license · Motion Canvas: https://motioncanvas.io

## 10. The built version (`video/`)

A first cut of the film is built from code, so it can be re-rendered after every change. Output: `video/alodi-film.mp4` (1920 × 1080, 30 fps, 2:00).

| Step | File | What it does |
| --- | --- | --- |
| 1 · Voice | `script.json`, `tts.py` | Kokoro-82M (Apache-2.0), run locally. Narrator `af_heart`; call assistant `af_bella`; buyer `am_michael` |
| 2 · UI footage | `capture.cjs` → `build_clips.py` | Records the real demo UI on four screens at once (courier phone 560 × 1000, buyer phone, ops iPad 1280 × 1000, control 1600 × 1000), scenarios A_main and REFUSE, into `clips/` |
| 3 · Timeline | `timeline.py` → `timeline.json` | Scene times, voice starts, 207 sound cues, call-voice loudness for the logo’s bars |
| 4 · Music + SFX | `audio.py` → `audio/` | 120 BPM music bed and every sound effect synthesised in code (no samples, no licences); voice ducking; mix |
| 5 · Picture | `film/index.html` | The film as a page: every frame is a pure function of time, so it renders the same every time |
| 6 · Render | `serve.cjs`, `render.cjs` | Range-capable static server + frame-by-frame capture; then `ffmpeg` muxes `audio/mix.wav` |

Rebuild:

```bash
cd prep/01-pitch/video
python tts.py .                      # Kokoro venv (Python 3.12); Homebrew espeak-ng
node capture.cjs http://localhost:3001 /tmp/ui && python3 build_clips.py /tmp/ui clips   # demo running on :3001
python timeline.py . && python audio.py .
node serve.cjs ../.. 8765 &
node render.cjs http://localhost:8765/01-pitch/video/film/index.html /tmp/frames --from 0 --to 120
ffmpeg -framerate 30 -i /tmp/frames/%05d.jpg -i audio/mix.wav -c:v h264_videotoolbox -b:v 12M -pix_fmt yuv420p -c:a aac -b:a 256k -shortest alodi-film.mp4
```

What is still a placeholder in this cut:
- The survey shot uses **mock** numbers and says so on screen.
- The receipts are drawn cards, not screenshots. Swap in **[USER IMAGE 1–2]** when you have them.
- Money is labelled *projected*.
- The 6 s and 65% tiles are labelled *mock · target*.
- The UI still shows the earlier two-window morning question.
