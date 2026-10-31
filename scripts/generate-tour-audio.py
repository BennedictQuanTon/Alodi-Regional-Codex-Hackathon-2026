"""Generate the /tour voices and sound effects into web/public/tour. Costs a few cents.

Run from the repository root: api\\.venv\\Scripts\\python.exe scripts\\generate-tour-audio.py
Existing clips are kept unless their script text changed. Needs OPENAI_API_KEY in .env and ffmpeg.
"""

import hashlib
import json
import os
import subprocess
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "web/src/lib/demo/tour-script.json"
OUT = ROOT / "web/public/tour"
SFX = ROOT / "prep/01-pitch/video/audio/sfx"
MODEL = "gpt-4o-mini-tts"
VOICES = {
    "narrator": ("cedar", "A warm, calm product-film narrator. Measured pace, natural pauses."),
    "agent": ("marin", "A friendly, clear phone assistant. Polite and unhurried."),
    "buyer": ("ash", "A relaxed Vietnamese man on a phone call, speaking English casually."),
}


def key():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    return os.environ["OPENAI_API_KEY"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stamp_path = OUT / "generated.json"
    stamps = json.loads(stamp_path.read_text()) if stamp_path.exists() else {}
    client = OpenAI(api_key=key())
    for clip, line in json.loads(SCRIPT.read_text(encoding="utf-8")).items():
        voice, instructions = VOICES[line["voice"]]
        stamp = hashlib.sha256(f"{MODEL}|{voice}|{instructions}|{line['text']}".encode()).hexdigest()
        target = OUT / f"{clip}.mp3"
        if target.exists() and stamps.get(clip) == stamp:
            continue
        with client.audio.speech.with_streaming_response.create(
            model=MODEL, voice=voice, input=line["text"], instructions=instructions, response_format="mp3"
        ) as response:
            response.stream_to_file(target)
        stamps[clip] = stamp
        print("voice", clip)
    stamp_path.write_text(json.dumps(stamps, indent=1))
    for name in ("ring", "tap", "pop", "chime"):
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(SFX / f"{name}.wav"), "-b:a", "96k", str(OUT / f"sfx-{name}.mp3")],
            check=True,
        )
    total = 0.0
    for clip in stamps:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT / f"{clip}.mp3")],
            capture_output=True, text=True, check=True,
        )
        total += float(probe.stdout)
    print(f"{len(stamps)} clips, {total:.0f} seconds of speech")


if __name__ == "__main__":
    main()
