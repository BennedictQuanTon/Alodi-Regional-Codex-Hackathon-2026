# Alodi AI service

This package provides GPT voice, memo and extraction services. The integrated host in `api/app/integrated.py` connects them to the real local database, workflow, scheduler and authoritative policy through `api/app/ai_bridge.py`. The separate standalone fixture is in-memory; it does not implement those backend responsibilities or a carrier integration. The bridge rechecks eligibility and applies proposals against the context version, generation, revision and idempotency key.

## Windows setup

From PowerShell at the repository root, install Python 3.12 through `uv` and dependencies with:

```powershell
uv sync --project ai --python 3.12
```

Set `OPENAI_API_KEY` in the root server-only `.env`; never commit it or expose it through browser variables. `VOICE_PROVIDER=gpt_live` is the only live voice provider. Calls use `gpt-live-1`; completed memo files use OpenAI `gpt-transcribe`, following the file-transcription API rather than the realtime-only `gpt-live-transcribe` workflow. Structured extraction remains an OpenAI text request. See `prep/02-technical/.env.example`; restart the backend after changing configuration.

```powershell
# Fixture-only backend, from the repository root
uv run --project ai uvicorn alodi_ai.dev:app --host 127.0.0.1 --port 8001

# Tests, from another PowerShell at the repository root
uv run --project ai pytest -q ai/tests
```

`AI_MODE=stub` provides a deliberately limited typed fixture through `/ai/dev/turn`; it does not simulate speech recognition. `OFFLINE_MODE=true` blocks cloud services and voice; use chat. `AI_MODE=live` uses GPT Live. `/ai/config` readiness means the selected mode has its required variables, not that the provider or a particular model is guaranteed available. The configuration response contains no keys.

The default disclosure is served locally at `/ai/disclosure.mp3`. Explicit consent is required before establishing a provider session. Cloud speech receives the raw audio; known-field and regex masking reduces identifiable text before the text model but does not guarantee complete anonymization. Call audio is not persisted. Memo uploads are bounded to 5 MiB and 10 seconds, allowing up to 250 ms encoder padding and truncating the normalized audio to 10 seconds; temporary files are deleted. Live audio uploads must not be used as a production service without authentication, authorization, HTTPS, retention and operational controls supplied by Part 1.

## Bridge integration

`create_app(settings=..., bridge=..., fixture=False)` requires a bridge implementing `alodi_ai.bridge.Bridge`; it cannot silently use the fixture. Its `snapshot` returns an immutable view containing tracking ID, case ID, version, epoch, business time, offered windows, deadline, masked context, known PII for masking only, and eligibility. `submit` receives the original snapshot, strict proposal, source, confirmation, proposal revision and idempotency key. Part 1 must reject stale or prohibited work atomically. To reserve a call from the host, use `await app.state.runtime.reserve_call(tracking_id)` and retain its `id`; the browser attaches `/ws/call?session=<id>` before connect. The dev create/reset/typed endpoints exist only when `fixture=True`. Avoid mounting this app over existing order and WebSocket routes without explicitly reconciling ownership.

The fixture gate requires a future time window, a drop location, and explicit confirmation. It is not a replacement for Part 1 policy. The result includes nullable `delivery_notes` while preserving the existing fields. The live flow reads back all proposed fields, waits for actual browser audio playback, verifies spoken transcript content while the microphone remains muted, and then accepts confirmation. Expected free-text strings are supplied only as a checklist for semantically equivalent paraphrases; omitted or conflicting details must still fail verification. The verified prompt identity is retained with its subsequent listening interval, so a post-answer acknowledgment cannot erase a completed readback. Confirmed required details lead to an optional Vietnamese notes prompt. A pure negative notes answer, or eight seconds of actual user silence after prompt playback and acknowledged microphone unmute, finalizes the confirmed proposal. Notes and corrections produce a new readback and require confirmation. Silence never supplies missing required details or confirms a changed proposal.

The browser reports `playback_state` with `generation_id`, monotonic `turn_id`, `playback_revision`, and `state` (`playing`, `drained`, `blocked`, `ready`, `failed`). `turn_state` returns those IDs, `phase`, and `input_allowed`. Input permission requires the matching OpenAI input-audio unmute acknowledgement; renewed audio closes the local microphone immediately. `user_activity` reports actual microphone activity. A blocked playback is repeated under a new turn after `ready`, so a partial readback is not accepted. Results do not stop media: the farewell must play and drain first. Hangup, cancellation, disconnect, and errors stop media promptly without applying pending details.

GPT Live provides no response-done or playback-done event. Browser playback completion uses measured audible audio followed by 1.8 seconds of acoustic and transcript quiet; delegation processing also waits for actual user inactivity and a stable transcript frontier. These are conservative timing heuristics, not a guarantee against arbitrarily late network data or long intra-sentence pauses. Keep browser and server clocks out of the provider transcript timeline; retained listening intervals allow late transcript delivery. The call cap is 180 seconds; an unused disclosure/consent reservation expires after 120 seconds. `GET /ai/calls/{id}` exposes available in-memory usage and selected models. Media is released promptly before a bounded provider close drain. A final GPT Live usage event is not guaranteed to arrive before that drain expires; missing voice usage must not be treated as zero or as confirmed final billing.

## Checks

```powershell
uv run --project ai pytest -q ai/tests
uv run --project ai ruff check --isolated --select E4,E7,E9,F ai
```

The deterministic tests cover consent, playback and provider-ack gates, stale IDs/revisions, early and delayed speech, missing details, notes/corrections and reconfirmation, actual-silence timing, opt-out, stale bridge state, idempotence, and farewell media lifetime. They mock provider boundaries and do not establish live speech accuracy.

The optional command below makes paid provider requests with fixed synthetic Vietnamese speech. It uses temporary test-only WebRTC/NumPy dependencies and reports only metadata. It waits for real received audio, follows the production playback protocol, and requires an applied result plus the farewell before declaring success. It does not prove a real browser microphone flow or production policy.

```powershell
uv run --project ai --with aiortc --with numpy python ai/smoke.py --notes no
# Optional alternative scenarios, each a separate paid run:
# ... python ai/smoke.py --notes silence
# ... python ai/smoke.py --notes custom
```

The local disclosure clip is fixed synthetic speech. No buyer audio is stored. Live provider requests receive raw audio; masking reduces known identifiable transcript text before extraction but cannot guarantee complete anonymization.

## Integrated host

For live calls, use real-time business-clock speed so a conversation does not advance hours while the buyer speaks. From PowerShell at the repository root:

```powershell
$env:DEMO_CLOCK_SPEED = "1"
.\scripts\start-api.ps1
```

Use the workspace's explicit Next timer control to advance scheduled waits, or pause the business clock before a conversation. Changing speed preserves an existing database's saved clock; use the workspace speed control or an explicit scenario reset when needed. The script uses
`api/uv.lock` and the editable local AI package together. The `alodi-api` entrypoint
constructs `app.integrated.create_integrated_app`: the existing Part 1 order,
workflow, policy, scheduler and SQLite store share one FastAPI application with
this package's AI router. Mounted-app lifespan behavior is not involved. Host
shutdown stops scheduler tasks, memo jobs and voice sessions before closing SQLite.

The root `.env.example` defaults to synthetic stub behavior. For cloud requests,
set `AI_MODE=live`, `OPENAI_API_KEY`, `VOICE_PROVIDER=gpt_live`,
`OPENAI_MODEL=gpt-6.1-terra`, `OPENAI_REASONING_EFFORT=none`,
`OPENAI_LIVE_MODEL=gpt-live-1`, and `OPENAI_MEMO_MODEL=gpt-transcribe` in the ignored
root `.env`. Existing credentials are never overwritten by the startup script.
AssemblyAI and the old realtime settings are no longer active configuration.
`CALL_MAX_DURATION_SECONDS` sets the connected-call cap on both layers (default
180 seconds, maximum 180). The host's unanswered-call timer is 30 seconds.

Open `/dev/integrated` and connect to the host URL shown by its startup command
(default `http://127.0.0.1:8000`). This workspace reads authoritative orders and
shows the business clock, explicit courier outcomes, undo, issued calls, memo
status, saved context and audit events. Its API selector does not change the
standalone fixture lab. Both surfaces use synthetic seeded orders; cloud audio
is real only after disclosure and explicit consent. The integration is a local,
unauthenticated demo, not a deployed production service.

Part 1 schedules call reservations; runtime call IDs equal the durable
`CallAttempt.id`. `GET /orders/{tracking_id}` publishes `calls[].provider_session_id`,
`ws_path` and `runtime_status`. The browser attaches the issued session through
`/ws/call?session=<id>`; it cannot use fixture creation routes on the host. Each
connection rechecks generation, context version, eligibility, call hours and
consent before opening the cloud transport. Distinct host orders may have
independent reservations. Opt-out, new buyer input, delivery, offline switching,
reset and timeout invalidate pending proposals and terminate cancelled media.
Cancellation acknowledgments are retained until successful, including retries
after a failed reset. Provider waits do not hold the scheduler's timer lock.

Multipart `POST /orders/{tracking_id}/memo` has one route owner and requires
`audio`, `generation_id`, `context_version` and `shipper_event_id`. An unused,
committed B outcome is required; pending or undone outcomes cannot upload.
The response is `{job_id, status}`; poll `GET /ai/jobs/{job_id}`. Audio remains
ephemeral. A stale result cannot apply after another workflow change. Confirmed
voice and memo proposals pass through the same transactional Part 1 policy as
chat; `delivery_notes` is saved in extracted context and `context_card.notes`.
An address correction without an established allowed ward requires review; a
model's `same_district` flag does not establish that ward.

```powershell
uv sync --project api --frozen --python 3.12
uv run --project api --frozen pytest -q api/tests ai/tests
uv run --project api --frozen ruff check api
uv run --project api --frozen ruff check --isolated --select E4,E7,E9,F ai
```

The integration tests use real SQLite migrations, scheduler and workflow with
simulated provider boundaries. They verify saved proposals, notes/corrections,
idempotence, stale and cancelled work, reset retries, offline transitions,
timeouts, route ownership, and restart persistence. They do not establish live
speech accuracy, carrier integration, deployed authentication or production
readiness. A separate minimal synthetic text request verified `gpt-6.1-terra`
with reasoning effort `none`; it is not a quality benchmark.
