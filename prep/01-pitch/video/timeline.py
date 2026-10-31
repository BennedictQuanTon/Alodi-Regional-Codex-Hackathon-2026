"""Single source of truth for the film: scene times, voice-over starts, sound cues and the
call-voice loudness envelope. Writes timeline.json, read by film/index.html and audio.py.

Usage: python timeline.py <video_dir>   (needs numpy + soundfile)
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

W = Path(sys.argv[1])
FPS = 30

VO = {
    "v01": 0.4, "v02": 5.6, "v03": 9.3, "v04": 14.2, "v05": 18.8, "v06": 23.0, "v07": 27.2,
    "v08": 34.7, "v09": 38.0, "v10": 42.2, "v11": 47.0, "v12": 51.9,
    "c01": 58.0, "c02": 65.9,
    "v13": 73.9, "v14": 77.4, "v15": 80.8, "v16": 84.4, "v17": 90.8,
    "v18": 98.4, "v19": 105.6, "v20": 114.4,
}

SCENES = {
    "hook": [0.0, 9.0], "survey": [9.0, 13.9], "fee": [13.9, 18.5], "refused": [18.5, 22.8],
    "zero": [22.8, 26.8], "loss": [26.8, 33.9], "drop": [33.9, 37.8], "mosaic": [37.8, 41.9],
    "morning": [41.9, 46.8], "tap": [46.8, 51.7], "chat": [51.7, 56.8], "call": [56.8, 73.6],
    "extract": [73.6, 77.2], "card": [77.2, 80.6], "refuse": [80.6, 84.0], "core": [84.0, 90.6],
    "rules": [90.6, 98.0], "save": [98.0, 105.4], "share": [105.4, 112.0], "end": [112.0, 120.0],
}

cues = []
def cue(t, name, gain=0.5, pan=0.0):
    cues.append({"t": round(t, 3), "name": name, "gain": gain, "pan": pan})

# hook: one tick per word
for i in range(3): cue(0.40 + i * 0.09, "tick", 0.35)
for i in range(4): cue(1.30 + i * 0.09, "tick", 0.35)
for i in range(6): cue(2.60 + i * 0.09, "tick", 0.35)
cue(4.5, "buzz", 0.6); cue(5.15, "buzz", 0.6); cue(5.8, "pop", 0.5); cue(6.4, "miss", 0.5)
cue(8.0, "reverse", 0.45); cue(8.95, "whoosh", 0.4)
# problem
for i in range(5): cue(9.4 + i * 0.25, "tick", 0.3, (-1) ** i * 0.2)
cue(11.2, "boom", 0.5)
for i in range(12): cue(12.0 + i * 0.11, "pop", 0.28, (i % 6 - 2.5) / 5)
cue(13.9, "whoosh", 0.4); cue(15.4, "swish", 0.35); cue(16.3, "boom", 0.55)
for i in range(4): cue(18.7 + i * 0.25, "tick", 0.32)
cue(20.4, "boom", 0.5)
for i in range(48): cue(23.0 + i * 0.055, "key", 0.16, (-1) ** i * 0.1)
cue(25.9, "boom", 0.55)
for i in range(4): cue(27.6 + i * 0.35, "tick", 0.32)
cue(31.0, "boom", 0.6)
# drop + product
for i in range(3): cue(34.55 + i * 0.07, "pop", 0.4)
for i in range(4): cue(38.6 + i * 0.4, "pop", 0.35, (i - 1.5) / 3)
cue(41.9, "whoosh", 0.35); cue(43.6, "pop", 0.35); cue(44.1, "pop", 0.35)
cue(46.8, "whoosh", 0.35); cue(50.45, "tap", 0.8); cue(51.0, "swish", 0.35)
cue(51.7, "whoosh", 0.3); cue(52.4, "pop", 0.4)
for i in range(14): cue(53.2 + 1.9 * (1 - (1 - i / 14) ** 2), "tick", 0.22)
cue(55.4, "blip", 0.45); cue(56.9, "ring", 0.45); cue(57.85, "tap", 0.5)
cue(73.6, "whoosh", 0.35); cue(76.2, "stamp", 0.5)
cue(77.2, "swish", 0.4); cue(77.9, "chime", 0.45); cue(79.8, "boom", 0.45)
cue(80.6, "whoosh", 0.35); cue(81.35, "tap", 0.7); cue(83.0, "stamp", 0.5)
# core
cue(84.0, "whoosh_down", 0.4)
for i in range(6): cue(84.7 + i * 0.55, "blip", 0.35, (i - 2.5) / 5)
for i in range(40): cue(91.0 + i * 0.05, "key", 0.14, (-1) ** i * 0.1)
for i in range(6): cue(93.6 + i * 0.5, "blip", 0.4)
# output
cue(98.0, "whoosh", 0.4); cue(99.5, "tick", 0.3); cue(102.6, "boom", 0.6)
cue(105.4, "whoosh", 0.35); cue(106.3, "stamp", 0.5); cue(107.6, "boom", 0.5)
cue(110.0, "blip", 0.4); cue(110.5, "blip", 0.4)
# end
for i in range(4): cue(112.2 + i * 0.35, "tick", 0.3)
for i in range(3): cue(114.25 + i * 0.07, "pop", 0.4)

# loudness envelope of the call voices (drives the logo's sound bars)
env = {}
for vid in ("c01", "c02"):
    x, sr = sf.read(W / "vo" / f"{vid}.wav")
    hop = sr // FPS
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x), hop)])
    rms = np.convolve(rms, np.ones(3) / 3, "same")
    env[vid] = [round(float(v), 3) for v in rms / (rms.max() or 1)]

durations = json.loads((W / "vo" / "durations.json").read_text())
timeline = {
    "fps": FPS, "end": 120.0, "drop": 34.0, "breakdown": [84.0, 98.0], "lift": 98.0, "outro": 112.0, "final_hit": 114.0,
    "vo": VO, "durations": durations, "scenes": SCENES, "sfx": sorted(cues, key=lambda c: c["t"]), "env": env,
}
(W / "timeline.json").write_text(json.dumps(timeline))
print("scenes", len(SCENES), "cues", len(cues), "vo", len(VO))
for k, v in VO.items():
    print(f"  {k} {v:6.1f} → {v + durations[k]:6.1f}")
