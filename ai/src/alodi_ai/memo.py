import asyncio
import tempfile
from pathlib import Path

from openai import AsyncOpenAI


async def finish_process(process):
    try:
        return await process.communicate()
    except asyncio.CancelledError:
        if process.returncode is None:
            process.kill()
        await process.communicate()
        raise


async def transcribe(settings, data: bytes) -> str:
    if settings.mode != "live":
        raise ValueError("Audio transcription is unavailable in stub or offline mode")
    with tempfile.TemporaryDirectory(prefix="alodi-memo-") as directory:
        source = Path(directory) / "input"
        target = Path(directory) / "audio.wav"
        source.write_bytes(data)
        probe = await asyncio.create_subprocess_exec(
            settings.ffprobe_path,
            "-protocol_whitelist",
            "file,pipe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(source),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        out, _ = await finish_process(probe)
        if probe.returncode or not out:
            raise ValueError("Audio could not be decoded")
        try:
            duration = float(out)
        except ValueError:
            raise ValueError("Audio duration unavailable") from None
        if not 0 < duration <= 10.25:
            raise ValueError("Memo must be at most 10 seconds")
        ffmpeg = await asyncio.create_subprocess_exec(
            settings.ffmpeg_path,
            "-nostdin",
            "-protocol_whitelist",
            "file,pipe",
            "-v",
            "error",
            "-i",
            str(source),
            "-t",
            "10",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-y",
            str(target),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await finish_process(ffmpeg)
        if ffmpeg.returncode:
            raise ValueError("Audio could not be normalized")
        async with AsyncOpenAI(
            api_key=settings.openai_api_key.get_secret_value(), timeout=30
        ) as client:
            result = await client.audio.transcriptions.create(
                model=settings.openai_memo_model,
                file=("memo.wav", target.read_bytes(), "audio/wav"),
                language="vi",
            )
            return result.text or ""
