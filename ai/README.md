# Alodi AI service

This package provides the AI integration and a standalone fixture app. The fixture is in-memory and does not implement the carrier, database, workflow, scheduler, or authoritative policy. Part 1 must provide a bridge that rechecks eligibility and atomically applies a proposal against the context version, demo epoch, revision and idempotency key.

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

## Part 1 host recipe

In Part 1's Python environment, install this package with `uv pip install -e .\ai`. Construct a bridge implementation backed by Part 1's transactional store and policy. After registering the host's own routes, mount the AI app at the root (and avoid registering a conflicting `/orders/{tracking_id}/memo` route):

```python
from fastapi import FastAPI
from alodi_ai.runtime import create_app
from alodi_ai.settings import Settings

app = FastAPI()
# Register Part 1 order, policy, scheduler, and other routes here first.
# part1_bridge is your implementation of alodi_ai.bridge.Bridge.
ai_app = create_app(settings=Settings(), bridge=part1_bridge, fixture=False)
app.mount("/", ai_app)
# Part 1's scheduler reserves a call in-process when policy permits:
# call = await ai_app.state.runtime.reserve_call(tracking_id)
# Publish call.id and /ws/call?session=<id> through Part 1's existing workflow.
```

Start the host using Part 1's own documented startup command on port 8000. Stop it using its normal shutdown procedure. The fixture app is separate: from the repository root run `.\scripts\start-ai.ps1`, stop with Ctrl+C, and check with `.\scripts\check-ai.ps1`. The fixture lifespan calls `await ai_app.state.runtime.shutdown()` on exit. Because mounted app lifespans may not run under a parent, register that same shutdown call in the Part 1 host lifecycle. `GET /ai/calls/{id}` and job responses expose elapsed monotonic seconds, selected model names, and available provider/token usage; usage varies by provider and no cost estimate is inferred from it.
