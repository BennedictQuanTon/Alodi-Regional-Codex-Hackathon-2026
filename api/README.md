# Alodi local backend — foundation increment

This increment implements Part 1's application bootstrap, typed configuration,
versioned SQLite schema, validated fictional seed data, context/audit persistence
and basic read APIs. It follows PRD sections 6, 12, 15 and 20 plus the Part 1
handoff issue. The issue supersedes the PRD's VM/Docker hosting assumptions and
its destructive example seed loader.

The existing frontend is still the scripted BroadcastChannel demo. It is not
connected to this API yet. This increment does not implement courier workflow
writes, business timers, policy decisions, WebSockets, provider adapters or cached
AI replay. No AI performance measurements are produced.

## Run from the repository root

Use Python **3.12** explicitly. `uv` installs/selects that version; the machine's
plain `python` command can point to a different version.

On Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-api.ps1
```

The script preserves an existing root `.env`, creates one from `.env.example`
only when missing, installs the locked dependencies and starts FastAPI. The first
demo startup applies Alembic migrations and seeds an empty database. Later
startups retain the database, context history and demo generation.

The equivalent commands on macOS/Linux, or manually on Windows, are:

```text
uv sync --frozen --python 3.12
uv run --frozen --python 3.12 alodi-api
```

Defaults also work without an `.env` file or provider credentials. If merging
settings into an existing `.env`, use the new root `.env.example`; preserve local
secret values. The older template under `prep/02-technical/` describes a different
hosting setup.

Start the existing web app in a second terminal from the repository root:

```text
pnpm --dir web install
pnpm --dir web dev
```

Check the backend with PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod "http://localhost:8000/orders?route_id=HCM-BTH-R07&date=2026-10-31"
Invoke-RestMethod http://localhost:8000/orders/SPXVN0123456789
```

The expected health counts are 4,000 orders, 20 routes and seven scenario
fixtures. The R07 list has 200 stops, sorted by stop index. API documentation is
at `http://localhost:8000/docs`. Routes have no `/api` prefix.

This Windows procedure still needs execution on Khanh's Windows machine. Checks
run on a different OS do not establish that machine's Python, firewall or
microphone configuration.

## Configuration behavior

- Root `.env` loading is explicit; process environment values take precedence.
  Paths in `DATABASE_URL`, `MOCK_PACK_DIR` and `RECORDINGS_DIR` resolve against the
  repository root, regardless of the shell's working directory.
- Only the local `sqlite+aiosqlite` database driver is supported in this increment.
  SQLite foreign keys, WAL and a busy timeout are enabled on every connection;
  transaction boundaries are explicit. Datetimes are stored in UTC and returned
  in the configured timezone, default `Asia/Ho_Chi_Minh`. See the
  [SQLAlchemy SQLite transaction guidance](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html#enabling-non-legacy-sqlite-transactional-modes-with-the-sqlite3-or-aiosqlite-driver).
- `AI_MODE=stub` needs no credentials. `OFFLINE_MODE=true` selects the replay
  mode setting and overrides live provider calls. `AUTO_BUYER` is independent.
  The adapters/simulator themselves are deferred; `/health` explicitly reports
  `ai_adapters_ready=false` and `provider_calls_enabled=false`.
- `AI_MODE=live` requires OpenAI and AssemblyAI credentials in configuration, and
  application startup refuses live mode until Part 2 adapters are registered.
  It never silently substitutes simulated AI for live behavior.
- `ASSEMBLY_API_KEY` aliases `ASSEMBLYAI_API_KEY`. Different populated values
  cause a name-only configuration error. Credentials are excluded from settings
  dumps and repr; configuration errors report variable names, never values.
- `WEB_ORIGIN` is one exact HTTP(S) origin, default `http://localhost:3000`.
  Backend secrets must never be copied into `NEXT_PUBLIC_*` settings.

For the later frontend transport integration, `web/.env.local` will need:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

The WebSocket URL is reserved for the next increment; `/ws` is not implemented
here. For phones/tablets, replace localhost with reachable origins and configure
trusted HTTPS/WSS for microphone access. Update `WEB_ORIGIN` alongside the web
origin. Direct LAN binding requires `API_HOST=0.0.0.0` and Windows network access;
a reverse proxy can keep the API on `127.0.0.1`. Public Next.js variables must be
present at build time. Local hosting does not remove the internet requirement
for future live cloud providers.

## Migrations and seed

```text
uv run --frozen --python 3.12 alodi-db upgrade
uv run --frozen --python 3.12 alodi-db seed
```

The first command applies the Alembic revision history. There is no runtime
`create_all`/`drop_all` replacement for migrations. To generate a future revision:

```text
uv run --frozen --python 3.12 alembic -c api/alembic.ini revision --autogenerate -m "Describe change"
uv run --frozen --python 3.12 alembic -c api/alembic.ini check
```

Review generated revisions before applying them. The initial revision is `0001`.
Async migrations use the shared-connection pattern in the
[Alembic cookbook](https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic).

Seed validation requires 4,000 unique fictional orders, 20 unique courier routes,
stops 1–200 on each route, four valid windows, fictional `TEST-*` phones, matching
dates/wards and seven distinct stage fixtures referencing R07 orders. The pack is
fingerprinted. Seed insertion runs in one transaction and concurrent seed calls
are serialized. Partial existing data is never silently replaced.

All orders initially remain `scheduled`, with zero attempts and context version
zero. Scenario scripts are stored as labelled fixtures; their actions, contacts,
appointments and AI outputs have not happened. Seed audit events are explicitly
synthetic and are not chat/call activity or measured AI performance.

Stop the API before an intentional reset:

```text
uv run --frozen --python 3.12 alodi-db seed --reset
```

Synthetic seeding and reset require `APP_ENV=demo`. Reset replaces application
rows transactionally, preserves migration history and assigns a fresh generation
ID. It does not delete recording files; recording processing/cleanup belongs to
Part 2. There is no running scheduler in this increment. A future HTTP reset must
also cancel its jobs before becoming available.

## Data and concurrency foundations

All eight PRD tables are present: `couriers`, `orders`, `availability_reply`,
`shipper_event`, `rescue_case`, `rescue_result`, `events` and `recordings`.
Additional tables persist hub/window metadata, context revisions, callback
idempotency receipts, scenario fixtures and demo seed/generation metadata.

- Courier route IDs are unique, making the PRD's order-to-route foreign key valid.
- `attempt_count` stores completed delivery attempts, independently of a rescue
  case's `cycle`. This increment does not change either counter through workflow.
- A unique idempotency constraint protects courier actions; a partial index
  permits only one pending action per order. A shipper event starts at most one
  rescue case. Callback receipts are unique by generation, source and key.
  HTTP mutation/idempotency handling will be implemented with the workflow.
- Call counters include reservations; the DB rejects a combined total above two.
  Slot reservation and call outcome behavior still require a transactional service.
- `record_context_change` is an internal persistence primitive, used only after
  a workflow service authorizes a change. It atomically checks the expected
  version and active generation, updates context, appends a revision and appends
  an actor/time/type/payload audit event. The caller owns commit/rollback and
  must broadcast only after committing. No generic context-write endpoint exists.
- A memo can belong to a pending shipper event before a rescue case exists.
  Recording metadata stores masked transcripts and expiry; raw audio is not
  stored in order context or served by this API.

The five-day horizon's reference timestamp and the minimum appointment fields
remain unresolved Part 2 contracts. No policy implementation here chooses an
answer implicitly. The two-minute undo demonstration at 600× also needs a clock
pause/slowdown when the scheduler and controls are implemented.

## Verification

```text
uv run --frozen --python 3.12 pytest -q
uv run --frozen --python 3.12 ruff check api
uv run --frozen --python 3.12 ruff format --check api
```

Tests cover migrations/schema parity, exact seed contents, safe repeat startup,
concurrent seeding, reset generation, rollback, foreign keys, uniqueness/call-cap
constraints, version conflicts, stale generation rejection, timezone round trips,
credential handling, CORS and basic read APIs. Each test database lives in a
temporary directory; tests do not use the demo DB or real provider credentials.

This covers the data/bootstrap part of TC-01 and the reset data foundation of
TC-20. Full TC-01/TC-20, the other workflow acceptance cases, cross-device latency
and AI-quality checks remain pending their respective implementations.
