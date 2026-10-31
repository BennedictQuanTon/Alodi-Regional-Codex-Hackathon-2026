# Alodi · Competition prep kit

Everything needed to **pitch Alodi** and to **rebuild it from zero** — landing page, demo, dashboard, backend — without opening the current codebase.

Team Develarper · MVP demo on **31 October 2026**.

> **Make the second drop land.** Alodi rescues failed deliveries: the shipper taps one button, the agent messages and calls the buyer at the right time, then hands back structured context for the next attempt. High-stakes decisions stay with people.

---

## How this folder is organised

| Folder | Use it for | Start with |
| --- | --- | --- |
| [`01-pitch/`](01-pitch/) | The pitch in four files: live demo on four screens, pitch script (to fill), 2-minute demo film, slide design with all figures, competitors, team and sources; charts for slides and film | [`1-LIVE-DEMO.md`](01-pitch/1-LIVE-DEMO.md), then [`4-SLIDES.md`](01-pitch/4-SLIDES.md) |
| [`02-technical/`](02-technical/) | How it works: one PRD with the full BA spec, architecture (demo and production cloud), data flow, data model, API, three-device live demo, demo-day tech stack, build plan, eval; mock data pack for a 20-courier, 2,000-order hub | [`PRD.md`](02-technical/PRD.md) |
| [`03-design/`](03-design/) | How it looks: the complete design system to rebuild every page, original reference specs, CSS tokens, screenshots of the current build | [`DESIGN.md`](03-design/DESIGN.md) |
| [`04-brand/`](04-brand/) | Alodi identity (mark C, sound bars — the one on the landing page): outlined SVG wordmarks, marks, app icons, favicon, lockups with taglines, PNG exports, Be Vietnam Pro font | [`BRAND.md`](04-brand/BRAND.md) |
| [`05-assets/`](05-assets/) | Team portraits, source logos (Shopee, VECOM, Metric…), tech logos (Next.js, FastAPI, OpenAI…) | [`ASSETS.md`](05-assets/ASSETS.md) |
| [`06-survey/`](06-survey/) | **Mock** survey data (100 customers, 12 shippers) with codebook and summary, to build the EDA charts before the real interviews | [`SURVEY.md`](06-survey/SURVEY.md) |

## Full file map

```
prep/
├── README.md                         ← you are here
├── 01-pitch/
│   ├── 1-LIVE-DEMO.md                four screens (phone /courier, iPad /ops, laptop /buyer, /control), flow, run of show, checklist
│   ├── 2-PITCH-SCRIPT.md             timing and beats with blank lines to fill, approved numbers, Q&A, who says what
│   ├── 3-DEMO-VIDEO.md               2-minute motion film: reference study, style, sound, shot list, prompts, tools
│   ├── 4-SLIDES.md                   deck design, slide by slide, official figures, money model, competitors, team, sources
│   └── charts/                       8 charts × light/dark × SVG/PNG + make_charts.py + Geist fonts
├── 02-technical/
│   ├── cost-model/                   cost_model.py + output: AWS cost vs savings for one hub (PRD §18.8)
│   ├── PRD.md                        THE technical document: BA spec (FR, NFR, rules, use cases), UML (use case, class,
│   │                                 ERD, state, sequences), API, architecture, data flow, production cloud design for
│   │                                 a 20-courier / 2,000-order hub, live demo, mock data, demo-day stack with code,
│   │                                 build plan, eval, acceptance, traceability, risks
│   ├── mock-data/                    fictional hub: 20 shippers, 2,000 orders, simulated day, 7 stage scenarios,
│   │                                 utterances, 47 eval samples, 20 test cases, generate.py
│   ├── requirements.txt              backend Python dependencies
│   ├── package.json.example          frontend dependencies
│   ├── .env.example                  every secret and setting the build needs
│   └── diagrams/
│       ├── alodi-architecture.pdf / .png     current architecture (8 steps, demo vs production)
│       └── alodi-flow.pdf / .png             current business flow
├── 03-design/
│   ├── LANDING_CONTENT.md            all landing-page copy, section by section (moved from 01-pitch)
│   ├── DESIGN.md                     THE design system: tokens, type, every component, every section, motion
│   ├── references/                   the three original specs, copied in full and unedited
│   │   ├── LANDING-monad-DESIGN.md
│   │   ├── DEMO-UI-shadcn-DESIGN.md
│   │   └── DASHBOARD-ember-DESIGN.md
│   ├── tokens/
│   │   ├── globals.css               the complete production stylesheet (tokens + utilities + motion)
│   │   └── tokens.json               the same tokens as JSON (for Figma / slides / other stacks)
│   └── screenshots/                  41 captures of the current build (landing, demo, dashboard light/dark, mobile)
├── 04-brand/
│   ├── BRAND.md
│   ├── logo/  mark/  app-icon/  lockup/  favicon/      SVG, text converted to outlines
│   ├── png/                          PNG exports of all of the above
│   ├── source/                       alodi-app-icon-original.png (the designer’s original icon)
│   └── fonts/                        Be Vietnam Pro ExtraBold + Medium (OFL licence)
├── 05-assets/
│   ├── ASSETS.md
│   ├── team/                         four portraits
│   └── logos/
│       ├── sources/                  logos of the organisations we cite
│       └── tech/                     33 technology logos (colour + mono) + INDEX.md
└── 06-survey/                       MOCK data until the real interviews replace it
    ├── SURVEY.md
    ├── customers.csv            100 buyers: profile tags + 16 questions
    ├── couriers.csv             12 shippers from SPX, GHN, J&T, BEST, GHTK, Viettel Post
    ├── codebook.csv                  questions in English and Vietnamese, types, values
    ├── summary_MOCK.csv              headline shares for slides
    └── generate_mock_survey.py
```

## Ground rules that apply to everything here

These come from the project rules and should survive the rebuild:

1. **English everywhere** — UI copy, docs, script.
2. **No citation markers** like `[4]` or superscripts. Attribute data with a plain line: `Source: Shopee Help Center, article 79559`.
3. **No JetBrains Mono** or other coding fonts. The only monospace face is **Geist Mono**.
4. **No decorative AI icons.** Glyphs are the Alodi marks (ring + dot / check / sound bars / square) and plain arrows. Real logos only where they identify a real company or technology.
5. **Honesty labels**: anything not measured is marked *projected*, *estimate*, *mock* or *vendor figure*.

## What is official vs what is mock

| Kind | Where | Status |
| --- | --- | --- |
| Problem figures (40,000 VND, 8–12%, 0 windows, 473M VND a month per area) | `01-pitch/4-SLIDES.md` §3 | Sourced from public documents; models are labelled |
| Money saved (187M VND a month, 40%, best-in-class) | `02-technical/PRD.md` §18.8 | **Projected** (vendor rescue range) |
| Survey results | `06-survey/` | **Mock** until the real interviews replace them |
| Output metrics on `/metrics` and the dashboard KPIs | current web build | **Mock** until the eval runs — replace with real numbers before showing them as results |
| Demo case (Minh Hoang, air fryer, Tower B…) | demo engine | Fictional data |
