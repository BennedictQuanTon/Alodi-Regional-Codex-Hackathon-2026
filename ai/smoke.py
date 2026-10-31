"""Opt-in paid synthetic GPT Live flow. Reports metadata, never raw speech or keys."""

import argparse
import asyncio
import json
import tempfile
from pathlib import Path
import time
from fractions import Fraction

import numpy as np
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from av import AudioFrame
from openai import AsyncOpenAI

from alodi_ai import live as live_module
from alodi_ai.bridge import FixtureBridge
from alodi_ai.live import LiveSession
from alodi_ai.runtime import Runtime
from alodi_ai.settings import Settings

PHRASES = {
    "collecting": "Ngày mai từ mười bảy giờ đến hai mươi giờ, giao ở quầy bảo vệ tòa nhà.",
    "confirming": "Đúng rồi.",
    "notes": "Dạ không có gì thêm.",
}


async def main(notes):
    settings = Settings()
    if settings.mode != "live" or settings.missing():
        raise ValueError("Configured live mode required")
    phrases = dict(PHRASES)
    if notes == "custom":
        phrases["notes"] = "Xin gọi trước khi đến cổng."
    clips = {}
    async with AsyncOpenAI(
        api_key=settings.openai_api_key.get_secret_value(), timeout=30
    ) as client:
        for phase, phrase in phrases.items():
            if phase == "notes" and notes == "silence":
                continue
            result = await client.audio.speech.create(
                model=settings.openai_tts_model,
                voice=settings.openai_tts_voice,
                input=phrase,
                response_format="pcm",
            )
            # TTS PCM is 24kHz; repeat samples to the 48kHz RTP source rate.
            clips[phase] = (
                np.repeat(np.frombuffer(result.content, dtype="<i2"), 2)
                .astype("<i2")
                .tobytes()
            )
    bridge = FixtureBridge()
    runtime = Runtime(settings, bridge)
    call = await runtime.reserve_call(bridge.state.tracking_id)
    call.status = "connected"
    session = LiveSession(runtime, call)
    call.upstream = session
    source = None
    seen = []
    sent_turns = set()
    done = asyncio.Event()
    received_frames = 0
    audible = False
    last_sound = last_transcript = time.monotonic()
    current_turn = -1
    playback_revision = 0
    drain_task = None
    failures = 0
    diagnostic = None
    original_mismatches = live_module.readback_mismatches

    def observe_mismatches(expected, heard):
        nonlocal diagnostic
        fields = original_mismatches(expected, heard)
        if fields:
            diagnostic = {
                "synthetic_only": True,
                "mismatch_fields": fields,
                "expected": expected.model_dump(by_alias=True, mode="json"),
                "heard": heard.model_dump(by_alias=True, mode="json"),
                "spoken": "".join(
                    x[2] for x in session.outputs[session.output_start :]
                ),
            }
        return fields

    live_module.readback_mismatches = observe_mismatches

    async def report(state):
        await session.browser_event(
            {
                "type": "playback_state",
                "generation_id": session.generation_id,
                "turn_id": current_turn,
                "playback_revision": playback_revision,
                "state": state,
            }
        )

    async def emit(c, event):
        nonlocal current_turn, audible, last_transcript, playback_revision, failures
        typ = event.get("type")
        seen.append(typ)
        if typ == "usage":
            c.usage.append(event)
        if typ == "transcript" and event.get("speaker") == "assistant":
            last_transcript = time.monotonic()
        if typ == "turn_state":
            if event["turn_id"] != current_turn:
                current_turn = event["turn_id"]
                audible = False
                playback_revision = 0
            print(
                "state",
                event["phase"],
                "input",
                event["input_allowed"],
                "turn",
                current_turn,
                flush=True,
            )
            if event["input_allowed"] and source:
                phase = event["phase"]
                key = (current_turn, phase)
                if phase in clips and key not in sent_turns:
                    sent_turns.add(key)
                    source.play(clips[phase])
        if typ == "notice" and event.get("code") == "readback_mismatch":
            failures += 1
            print("readback_mismatch_fields", event.get("fields"), flush=True)
            if failures >= 2:
                with tempfile.NamedTemporaryFile(
                    prefix="alodi-synthetic-readback-", suffix=".json", delete=False
                ) as saved:
                    saved.write(
                        json.dumps(diagnostic, ensure_ascii=False, indent=2).encode(
                            "utf-8"
                        )
                    )
                    print("synthetic_diagnostic", str(Path(saved.name)), flush=True)
                done.set()
        if typ in ("error", "notice"):
            print(
                "error",
                event.get("code"),
                event.get("error_type"),
                event.get("http_status"),
                flush=True,
            )
        if typ == "result":
            print(
                "result",
                event["status"],
                "notes",
                bool(event.get("context", {}).get("delivery_notes")),
                flush=True,
            )
        if typ == "status" and event.get("status") == "ended":
            print("ended", event.get("reason"), flush=True)
            done.set()

    runtime.emit = emit

    class Synthetic(MediaStreamTrack):
        kind = "audio"

        def __init__(self):
            super().__init__()
            self.audio = b""
            self.pos = self.pts = 0
            self.deadline = None
            self.active = False

        def play(self, audio):
            self.audio, self.pos = audio, 0

        async def recv(self):
            loop = asyncio.get_running_loop()
            if self.deadline is None:
                self.deadline = loop.time()
            self.deadline += 0.02
            await asyncio.sleep(max(0, self.deadline - loop.time()))
            frame = AudioFrame(format="s16", layout="mono", samples=960)
            chunk = b""
            if session.input_allowed:
                chunk = self.audio[self.pos : self.pos + 1920]
                self.pos += len(chunk)
            samples = np.frombuffer(chunk, dtype="<i2").astype(np.float32)
            active = bool(
                len(samples)
                and float(np.sqrt(np.mean(samples * samples))) / 32768 > 0.018
            )
            if self.active != active:
                self.active = active
                asyncio.create_task(
                    session.browser_event(
                        {
                            "type": "user_activity",
                            "generation_id": session.generation_id,
                            "turn_id": session.turn_id,
                            "active": active,
                        }
                    )
                )
            frame.planes[0].update(chunk.ljust(frame.planes[0].buffer_size, b"\0"))
            frame.sample_rate, frame.pts, frame.time_base = (
                48000,
                self.pts,
                Fraction(1, 48000),
            )
            self.pts += 960
            return frame

    pc = RTCPeerConnection()
    source = Synthetic()
    pc.addTrack(source)
    dc = pc.createDataChannel("oai-events")

    @dc.on("message")
    def message(raw):
        # Startup readiness comes only from the production server-side listener.
        pass

    @pc.on("track")
    def track_received(track):
        async def receive():
            nonlocal received_frames, audible, last_sound, playback_revision
            try:
                while True:
                    frame = await track.recv()
                    received_frames += 1
                    samples = frame.to_ndarray().astype(np.float32)
                    rms = float(np.sqrt(np.mean(samples * samples))) / 32768
                    if rms > 0.006:
                        last_sound = time.monotonic()
                        if not audible:
                            audible = True
                            playback_revision += 1
                            await report("playing")
            except Exception:
                pass

        asyncio.create_task(receive())

    async def monitor():
        nonlocal audible
        while not done.is_set():
            await asyncio.sleep(0.1)
            if audible and time.monotonic() - max(last_sound, last_transcript) >= 1.8:
                audible = False
                await report("drained")

    try:
        await pc.setLocalDescription(await pc.createOffer())
        answer = await session.open(pc.localDescription.sdp)
        await pc.setRemoteDescription(RTCSessionDescription(sdp=answer, type="answer"))
        drain_task = asyncio.create_task(monitor())
        await asyncio.wait_for(done.wait(), 125)
    finally:
        if drain_task:
            drain_task.cancel()
        await runtime.end(call, "smoke_timeout")
        await pc.close()
        live_module.readback_mismatches = original_mismatches
    applied = bridge.state.context_version == 2
    print(
        "gpt_live:",
        "applied=",
        applied,
        "started_source=",
        session.started_source,
        "audio_frames=",
        received_frames,
        "proposal=",
        "proposal" in seen,
        "usage=",
        "usage" in seen,
        flush=True,
    )
    if not applied or session.closing_reason != "applied":
        raise ValueError("Full synthetic flow was not applied")
    print(
        "Synthetic aiortc transport only; no browser microphone or recognition benchmark."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", choices=["no", "custom", "silence"], default="no")
    try:
        asyncio.run(main(parser.parse_args().notes))
    except Exception as exc:
        print("Smoke failed:", type(exc).__name__)
        raise SystemExit(1)
