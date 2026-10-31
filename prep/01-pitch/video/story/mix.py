"""Mixes music, voice and sound cues. Usage: python mix.py  (needs numpy, soundfile, scipy). Writes mix.wav"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import gaussian_filter1d
from scipy.signal import resample_poly

SR = 44100
W = Path(__file__).parent
T = json.loads((W / "timeline.json").read_text())


def load(p):
    x, sr = sf.read(p, always_2d=True)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, 1)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    return x


n = int(T["end"] * SR)
music = load(W / "../audio/music.wav")
# start two bars in so the drop lands at 30 s, and repeat four bars (8 s at 120 BPM) so the bed reaches the end
music = np.concatenate([music[4 * SR : 90 * SR], music[82 * SR : 90 * SR], music[90 * SR :]])[:n]
music = np.pad(music, ((0, n - len(music)), (0, 0)))
voice, fx = np.zeros((n, 2)), np.zeros((n, 2))
for k, t in T["start"].items():
    x = load(W / f"vo/{k}.wav")
    i = int(t * SR)
    voice[i : i + len(x)] += x[: n - i]
for t, name, g in T["cues"]:
    x = load(W / f"assets/sfx/{name}.wav")
    x = x / (np.abs(x).max() or 1) * 0.5 * g
    i = int(t * SR)
    fx[i : i + len(x)] += x[: n - i]
# music drops under the voice and comes back up between lines
gate = gaussian_filter1d((np.abs(voice).max(1) > 0.005).astype(float), SR * 0.12)
gate = np.clip(gaussian_filter1d(gate, SR * 0.12) * 3, 0, 1)
duck = 0.46 - 0.3 * gate
fade = np.minimum(1, (n - np.arange(n)) / (SR * 2.0))
mix = music * (duck * fade)[:, None] + voice * 1.7 + fx
mix = np.tanh(mix * 1.05) * 0.92
sf.write(W / "mix.wav", mix, SR)
print("peak", float(np.abs(mix).max()))
