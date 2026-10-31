# Alodi

**Make the second drop land.**

Team **Develarper**'s project for the
[Sea × OpenAI Regional Codex Hackathon, Vietnam](https://codexhackathon.sea.com/)
(31 October 2026, Ho Chi Minh City).

Alodi rescues failed deliveries for Vietnamese e-commerce. The courier taps one
button, the agent messages and calls the buyer at the right time, then hands
back structured context for the next attempt. High-stakes decisions stay with
people.

## How it works

1. A delivery fails and the courier taps one button:
   - **A · No answer**: the agent chats the buyer at once; after 60 minutes of
     silence it places an AI call, and a second call 2 hours later.
   - **B · Rescheduled**: the courier records a 10-second voice memo of what
     the buyer said.
   - **Refused**: straight to customer service, no buyer contact.
2. The agent extracts the time window, drop-off point and alternate receiver as
   structured JSON with a confidence score per field.
3. Every field at 0.85 or above is applied automatically and the next courier
   gets a context card; anything lower is confirmed in chat or sent to a person.
4. Hard rules hold throughout: calls only 08:00–20:30, at most two calls per
   cycle, labels such as "suspected bomb" applied only by a person.

## Run

The local backend foundation uses Python 3.12 and runs without AI keys:

```bash
uv sync --frozen --python 3.12
uv run --frozen --python 3.12 alodi-api  # http://localhost:8000/health
```

First demo startup migrates SQLite and seeds 4,000 fictional orders on 20 routes
with seven scenario fixtures. Existing data is retained on restart. See
[`api/README.md`](api/README.md) for Windows startup, configuration, database
commands and checks. Workflow writes, WebSockets and AI adapters are subsequent
increments; the frontend below still uses its scripted demo engine.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/demo` | Demo stage: courier app, buyer phone and operations panel side by side |
| `/demo/shipper` · `/demo/buyer` · `/demo/console` | One screen per window; tabs stay in sync |
| `/console` | Operations dashboard: KPIs, rescue trend, failure reasons, exception queue, case detail |
| `/metrics` | Output metrics and a projected-savings calculator |
| `/script` | Demo script |

Numbers on `/metrics` and the dashboard are *mock* until the eval runs;
savings are *projected*.

## Repository

```
web/                  Next.js app (landing, demo, dashboard)
  src/lib/demo/       scenario engine: state machine, fast-forward clock, scenarios
api/                  FastAPI backend foundation, migrations and tests
scripts/              local startup helpers (Windows PowerShell)
prep/
  01-pitch/           live demo plan, pitch script, slides, charts, demo film
  02-technical/       PRD, architecture and flow diagrams, cost model, mock data pack
  03-design/          design system, tokens, screenshots
  04-brand/           logo, marks, app icons, fonts
  05-assets/          team portraits, source and tech logos
  06-survey/          survey codebook and mock responses
docs/                 demo script, C4 architecture diagram
CLAUDE.md             project rules (type, colour, language, banned patterns)
```

Start with [`prep/02-technical/PRD.md`](prep/02-technical/PRD.md) for the full
specification.

## Team

- Yoshio Nomura
- Ton Long Quan
- Huynh Khanh Tuong
- Tran Thanh Loi
