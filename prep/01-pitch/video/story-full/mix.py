"""Mixes music, voice and sound cues. Usage: python mix.py  (needs numpy, soundfile, scipy, ffmpeg). Writes mix.wav"""
import json
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.ndimage import gaussian_filter1d
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
VOICE_GAIN = 2.0
# music levels in dB: a bed that sits well under the voice and opens a little between lines
OPEN_DB, DUCK_DB = -23.0, -31.0
W = Path(__file__).parent
T = json.loads((W / "timeline.json").read_text())


def load(p):
    x, sr = sf.read(p, always_2d=True)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, 1)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    return x


def smooth(x, sigma):
    """Gaussian smoothing on a 200 Hz envelope, which is plenty for gain curves and far quicker than per-sample."""
    step = SR // 200
    env = gaussian_filter1d(x[::step], sigma * 200)
    return np.interp(np.arange(len(x)), np.arange(len(env)) * step, env)


n = int(T["end"] * SR)
music_wav = W / "assets/music/your-breath.wav"
if not music_wav.exists():
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(W / "assets/music/your-breath.mp3"), "-ar", str(SR), "-ac", "2", str(music_wav)], check=True)
src = load(music_wav)
head, tail = src[int(T["offset"] * SR) : int(T["seam_end"] * SR)], src[int(T["seam_back"] * SR) :]
xf = int(0.03 * SR)
ramp = np.linspace(0, 1, xf)[:, None]
head[-xf:] = head[-xf:] * (1 - ramp) + tail[:xf] * ramp
music = np.concatenate([head, tail[xf:]])[:n]
music = np.pad(music, ((0, n - len(music)), (0, 0)))
voice, fx = np.zeros((n, 2)), np.zeros((n, 2))
for k, t in T["start"].items():
    x = load(W / f"vo/{k}.wav")
    i = int(t * SR)
    voice[i : i + len(x)] += x[: n - i]
MAX_LEN = {"mk-ring": 2.6, "mk-logo": 2.6}
for t, name, g in T["cues"]:
    x = load(W / f"assets/sfx/{name}.wav")
    if name in MAX_LEN:
        x = x[: int(MAX_LEN[name] * SR)].copy()
        x[-int(0.3 * SR) :] *= np.linspace(1, 0, int(0.3 * SR))[:, None]
    x = x / (np.abs(x).max() or 1) * g
    i = int(t * SR)
    fx[i : i + len(x)] += x[: n - i]
# the missed-call story sits under a closed filter; it opens on Alodi's name
closed = sosfilt(butter(2, 650, "low", fs=SR, output="sos"), music, axis=0)
a, b = T["start"]["n01"] - 1.2, T["drop"]
wet = smooth(((np.arange(n) >= a * SR) & (np.arange(n) < b * SR)).astype(float), 0.25)
wet[int(b * SR) :] = 0
music = music * (1 - wet)[:, None] + closed * wet[:, None]
# music drops under the voice and comes back up between lines
gate = np.clip(smooth(smooth((np.abs(voice).max(1) > 0.005).astype(float), 0.1), 0.1) * 3, 0, 1)
db = OPEN_DB + (DUCK_DB - OPEN_DB) * gate
for at, length in T["accents"]["gaps"]:
    env = 1 - smooth(((np.arange(n) >= at * SR) & (np.arange(n) < (at + length) * SR)).astype(float), 0.05)
    db += 40 * (env - 1)
for at, length, lift in T["accents"]["lifts"]:
    db += lift * smooth(((np.arange(n) >= at * SR) & (np.arange(n) < (at + length) * SR)).astype(float), 0.3)
fade = np.minimum(1, (n - np.arange(n)) / (SR * 3.0)) * np.minimum(1, np.arange(n) / (SR * 2.5))
bed = music * (10 ** (db / 20) * fade)[:, None]
# the arrival of Alodi and the close use the first story film's music, without the sub-bass hit and riser baked into it,
# brought down to sit with the rest of the bed
old_t = json.loads((W / "../story/timeline.json").read_text())
raw = load(W / "../audio/music.wav")
old = np.concatenate([raw[4 * SR : 90 * SR], raw[82 * SR : 90 * SR], raw[90 * SR :]])
old = sosfilt(butter(4, 140, "high", fs=SR, output="sos"), old, axis=0)
OLD_DROP, OLD_CLOSE = 29.9, old_t["start"]["n16"] - 3.0
SPLICE_OPEN, SPLICE_DUCK = -22.0, -30.0


def splice(i, j, src_start, tail_fade=None):
    """Crossfades the old bed in over samples i to j, reading it from src_start."""
    seg = np.zeros((j - i, 2))
    got = old[src_start : src_start + (j - i)]
    seg[: len(got)] = got
    ref = np.sqrt((music[i:j] ** 2).mean()) / (np.sqrt((seg ** 2).mean()) or 1)
    g = 10 ** ((SPLICE_OPEN + (SPLICE_DUCK - SPLICE_OPEN) * gate[i:j]) / 20) * ref
    if tail_fade:
        g = g * np.minimum(1, (j - i - np.arange(j - i)) / (SR * tail_fade))
    seg = seg * g[:, None]
    xf = int(0.8 * SR)
    mask = np.ones(j - i)
    mask[:xf] = np.linspace(0, 1, xf)
    if not tail_fade:
        mask[-xf:] = np.linspace(1, 0, xf)
    bed[i:j] = bed[i:j] * (1 - mask)[:, None] + seg * mask[:, None]


s = T["start"]
pre = int((T["drop"] - 0.3) * SR)
splice(pre, int((s["n05"] + T["dur"]["n05"] + 0.8) * SR), int((OLD_DROP + 0.25) * SR))
splice(int((s["n16"] - 0.9) * SR), n, int((OLD_CLOSE - 0.9) * SR), tail_fade=2.4)
meter = pyln.Meter(SR)
vo = voice * VOICE_GAIN
mix = bed + vo + fx
mix = np.tanh(mix * 1.02) * 0.95
print("voice LUFS", round(meter.integrated_loudness(vo), 1), "music LUFS", round(meter.integrated_loudness(bed), 1), "fx peak", round(float(np.abs(fx).max()), 2))
sf.write(W / "mix.wav", mix, SR)
print("peak", float(np.abs(mix).max()))
