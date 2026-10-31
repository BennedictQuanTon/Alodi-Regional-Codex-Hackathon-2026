"""Synthesises the film's music bed and every sound effect (no samples, no licences needed),
then mixes them with the Kokoro voice-over using the cue list in timeline.json.

Usage:  python audio.py <video_dir>          (needs numpy, scipy, soundfile)
Writes: audio/music.wav, audio/sfx/*.wav, audio/mix.wav
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100
BPM = 120
BEAT = 60 / BPM
W = Path(sys.argv[1])
T = json.loads((W / "timeline.json").read_text())
END = T["end"]
OUT = W / "audio"
(OUT / "sfx").mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.002, d=0.2, curve=4.0):
    x = np.arange(n) / SR
    att = np.clip(x / max(a, 1e-4), 0, 1)
    dec = np.exp(-curve * np.clip(x - a, 0, None) / max(d, 1e-4))
    return att * dec


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def saw(f, d, detune=0.0):
    ph = (np.cumsum(np.full(int(d * SR), f * (1 + detune) / SR))) % 1.0
    return 2 * ph - 1


def note(n):  # MIDI → Hz
    return 440 * 2 ** ((n - 69) / 12)


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * gain


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def stereo(x, width=0.0, delay_ms=0.0):
    if not width:
        return np.stack([x, x], 1)
    d = int(delay_ms * SR / 1000)
    r = np.concatenate([np.zeros(d), x])[: len(x)]
    return np.stack([x, x * (1 - width) + r * width], 1)


# ------------------------------------------------------------------ instruments
def kick():
    d = 0.45
    x = t_(d)
    f = 45 + 95 * np.exp(-x * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.001, 0.32, 3.2)
    click = hp(rng.standard_normal(len(x)), 3000) * env(len(x), 0.0005, 0.006, 5) * 0.25
    return np.tanh((s + click) * 1.6) * 0.9


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    n = hp(rng.standard_normal(int(d * SR)), 7000, 4)
    return n * env(len(n), 0.0005, d * 0.6, 4) * 0.28


def clap():
    d = 0.3
    n = bp(rng.standard_normal(int(d * SR)), 900, 2600)
    e = np.zeros(len(n))
    for k, off in enumerate((0, 0.011, 0.022)):
        e += np.roll(env(len(n), 0.0005, 0.03 if k < 2 else 0.16, 4), int(off * SR))
    return n * e * 0.45


def pluck(f, d=0.45, bright=4500):
    x = sum(saw(f, d, dt) for dt in (-0.004, 0.0, 0.004)) / 3
    x = lp(x, bright, 2) * env(len(x), 0.002, d * 0.45, 4)
    return x * 0.35


def bass(f, d):
    x = saw(f, d) * 0.6 + np.sin(2 * np.pi * f * t_(d)) * 0.6
    x = lp(x, 380, 3) * env(len(x), 0.004, d * 0.9, 1.5)
    return np.tanh(x * 1.4) * 0.5


def pad(freqs, d, cutoff=1400):
    x = np.zeros(int(d * SR))
    for f in freqs:
        for dt in (-0.006, -0.002, 0.002, 0.006):
            x += saw(f, d, dt)
    x = lp(x / (4 * len(freqs)), cutoff, 2)
    a = int(min(0.8, d / 3) * SR)
    e = np.ones(len(x))
    e[:a] = np.linspace(0, 1, a)
    e[-a:] = np.linspace(1, 0, a)
    return x * e * 0.32


# Fm – Db – Ab – Eb (two bars each); lift to Ab major feel in the output section
PROG = [(53, [65, 68, 72]), (49, [65, 68, 73]), (56, [68, 72, 75]), (51, [67, 70, 75])]


def music():
    bar = 4 * BEAT
    L = np.zeros(int((END + 2) * SR))
    R = np.zeros_like(L)
    sc = np.ones_like(L)  # sidechain gain

    def add(x, at, gain=1.0, pan=0.0):
        place(L, x, at, gain * (1 - max(pan, 0)))
        place(R, x, at, gain * (1 + min(pan, 0)))

    K, HC, HO, CL = kick(), hat(), hat(True), clap()
    drop = T["drop"]
    brk0, brk1 = T["breakdown"]
    lift = T["lift"]
    outro = T["outro"]
    nbars = int(END / bar) + 1
    for b in range(nbars):
        t0 = b * bar
        root, chord = PROG[(b // 2) % 4]
        if t0 >= lift:
            chord = [n + 0 for n in chord]
        section = ("intro" if t0 < 8 else "tension" if t0 < drop - 0.01 else
                   "drop" if t0 < brk0 else "break" if t0 < brk1 else
                   "lift" if t0 < outro else "outro")
        # pad all the way, darker in the intro
        if b % 2 == 0:
            p = pad([note(n - 12) for n in chord] + [note(chord[0])], bar * 2,
                    700 if section in ("intro", "tension") else 1600 if section != "break" else 1000)
            add(p, t0, 0.9 if section != "outro" else 0.7)
        # arpeggio plucks (16ths) from the tension section on, filtered open towards the drop
        if section in ("tension", "drop", "lift", "break"):
            for s in range(16):
                ts = t0 + s * BEAT / 4
                if section == "break" and s % 2:
                    continue
                n = chord[[0, 1, 2, 1][s % 4]] + (12 if s % 8 >= 4 else 0)
                bright = (900 + 2600 * min(1, (ts - 8) / max(drop - 8, 1))) if section == "tension" else 5200 if section != "break" else 2200
                add(pluck(note(n), 0.4, bright), ts, 0.55 if section != "tension" else 0.42, pan=0.35 if s % 2 else -0.35)
        # drums
        if section in ("drop", "lift"):
            for k in range(4):
                add(K, t0 + k * BEAT, 0.95)
                i = int((t0 + k * BEAT) * SR)
                dk = np.linspace(0.45, 1, int(0.22 * SR))
                sc[i:i + len(dk)] = np.minimum(sc[i:i + len(dk)], dk)
                add(HC, t0 + k * BEAT + BEAT / 2, 0.8, pan=0.2)
                add(HC, t0 + k * BEAT + BEAT / 4 * 3, 0.35, pan=-0.2)
            add(CL, t0 + BEAT, 0.7)
            add(CL, t0 + 3 * BEAT, 0.7)
            if b % 2 == 1:
                add(HO, t0 + 3.5 * BEAT, 0.5)
            for k in range(8):
                add(bass(note(root - 12), BEAT / 2 * 0.9), t0 + k * BEAT / 2, 0.9)
        elif section == "tension":
            for k in range(4):
                add(HC, t0 + k * BEAT + BEAT / 2, 0.45, pan=0.15)
            if t0 >= 16:
                add(K, t0, 0.55)
                add(K, t0 + 2 * BEAT, 0.45)
        elif section == "break":
            add(K, t0, 0.7)
            add(CL, t0 + 2 * BEAT, 0.5)
            add(bass(note(root - 12), bar * 0.95), t0, 0.75)
        elif section == "outro" and t0 < END - 3:
            add(K, t0, 0.6)
            add(bass(note(root - 12), bar * 0.9), t0, 0.6)
    # riser into the drop and into the lift, then the impact
    for at, d in ((drop - 4, 4), (lift - 3, 3)):
        add(riser(d), at, 0.5)
    add(impact(), drop, 0.9)
    add(impact(), lift, 0.6)
    add(impact(), T["final_hit"], 0.8)
    # silence pocket before the drop
    i0, i1 = int((drop - 0.55) * SR), int(drop * SR)
    for ch in (L, R):
        ch[i0:i1] *= np.linspace(1, 0, i1 - i0) ** 0.3
    mix = np.stack([L * sc, R * sc], 1)
    fade = int(3.5 * SR)
    e = int(END * SR)
    mix[e - fade:e] *= np.linspace(1, 0, fade)[:, None]
    mix[e:] = 0
    return norm(mix[: int(END * SR)], 0.8)


# ------------------------------------------------------------------ sound effects
def riser(d=4):
    x = rng.standard_normal(int(d * SR))
    f = np.linspace(300, 9000, len(x))
    y = np.zeros_like(x)
    # moving low-pass in blocks
    blk = 2048
    for i in range(0, len(x), blk):
        y[i:i + blk] = lp(x[i:i + blk], f[i], 2)
    return y * np.linspace(0, 1, len(x)) ** 2 * 0.6


def impact():
    d = 1.6
    x = t_(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-x * 9)) / SR) * env(len(x), 0.002, 1.1, 3)
    noise = lp(rng.standard_normal(len(x)), 2500) * env(len(x), 0.001, 0.25, 4) * 0.5
    return np.tanh((sub + noise) * 1.4) * 0.8


def sfx_bank():
    s = {}
    x = t_(0.05)
    s["tick"] = hp(rng.standard_normal(len(x)), 2500) * env(len(x), 0.0003, 0.012, 5) * 0.5 + np.sin(2 * np.pi * 2200 * x) * env(len(x), 0.0003, 0.01, 5) * 0.3
    x = t_(0.12)
    s["pop"] = np.sin(2 * np.pi * np.cumsum(900 + 700 * np.exp(-x * 60)) / SR) * env(len(x), 0.001, 0.06, 4) * 0.6
    x = t_(0.18)
    s["tap"] = (hp(rng.standard_normal(len(x)), 1800) * env(len(x), 0.0003, 0.01, 5) * 0.5
                + np.sin(2 * np.pi * np.cumsum(160 + 80 * np.exp(-x * 40)) / SR) * env(len(x), 0.001, 0.09, 4) * 0.7)
    x = t_(0.7)
    noise = rng.standard_normal(len(x))
    sweep = np.zeros_like(noise)
    for i in range(0, len(x), 1024):
        sweep[i:i + 1024] = bp(noise[i:i + 1024], 300 + 4000 * (i / len(x)), 600 + 6000 * (i / len(x)))
    s["whoosh"] = sweep * np.sin(np.pi * np.linspace(0, 1, len(x))) ** 2 * 0.9
    s["whoosh_down"] = s["whoosh"][::-1].copy()
    x = t_(1.4)
    s["chime"] = sum(np.sin(2 * np.pi * f * x) * env(len(x), 0.002, dcy, 4) * g for f, dcy, g in
                     ((1318.5, 1.0, 0.35), (1975.5, 0.7, 0.22), (2637, 0.4, 0.12))) * 0.8
    s["boom"] = impact() * 0.9
    x = t_(0.09)
    s["blip"] = np.sin(2 * np.pi * 1760 * x) * env(len(x), 0.001, 0.05, 4) * 0.45
    x = t_(0.06)
    s["key"] = hp(rng.standard_normal(len(x)), 3500) * env(len(x), 0.0003, 0.008, 5) * 0.35
    # dual-tone ring (synthesised; not a branded ringtone)
    x = t_(2.0)
    tone = (np.sin(2 * np.pi * 440 * x) + np.sin(2 * np.pi * 480 * x)) * 0.25
    gate = ((x % 1.0) < 0.4).astype(float)
    s["ring"] = lp(tone * gate, 3000) * 0.8
    x = t_(0.5)
    s["buzz"] = np.sin(2 * np.pi * 150 * x) * (np.sin(2 * np.pi * 30 * x) > 0) * env(len(x), 0.005, 0.35, 2) * 0.35
    x = t_(0.9)
    s["miss"] = np.concatenate([np.sin(2 * np.pi * 660 * t_(0.18)) * env(int(0.18 * SR), 0.002, 0.12, 3),
                                np.sin(2 * np.pi * 440 * t_(0.5)) * env(int(0.5 * SR), 0.002, 0.35, 3)]) * 0.35
    s["riser"] = riser(3)
    rev = rng.standard_normal(int(1.2 * SR))
    s["reverse"] = hp(rev, 4000) * np.linspace(0, 1, len(rev)) ** 3 * 0.5
    x = t_(0.35)
    s["swish"] = bp(rng.standard_normal(len(x)), 1500, 7000) * np.sin(np.pi * np.linspace(0, 1, len(x))) ** 3 * 0.7
    x = t_(0.4)
    s["stamp"] = np.sin(2 * np.pi * np.cumsum(220 + 300 * np.exp(-x * 30)) / SR) * env(len(x), 0.001, 0.15, 3) * 0.7
    return {k: norm(v, 0.9) for k, v in s.items()}


# ------------------------------------------------------------------ render + mix
def load_vo(name):
    x, sr = sf.read(W / "vo" / f"{name}.wav")
    if x.ndim > 1:
        x = x.mean(1)
    return signal.resample_poly(x, SR, sr)


def main():
    m = music()
    sf.write(OUT / "music.wav", m, SR)
    bank = sfx_bank()
    for k, v in bank.items():
        sf.write(OUT / "sfx" / f"{k}.wav", v, SR)
    n = int(END * SR)
    voice = np.zeros(n)
    for vid, at in T["vo"].items():
        place(voice, load_vo(vid), at, T.get("vo_gain", {}).get(vid, 1.0))
    fx = np.zeros((n, 2))
    for c in T["sfx"]:
        x = bank[c["name"]]
        pan = c.get("pan", 0.0)
        g = c.get("gain", 0.5)
        place(fx[:, 0], x, c["t"], g * (1 - max(pan, 0)))
        place(fx[:, 1], x, c["t"], g * (1 + min(pan, 0)))
    # duck the music under the voice (smoothed envelope)
    venv = np.abs(voice)
    venv = signal.lfilter([1 - 0.9995], [1, -0.9995], venv)
    duck = 1 - 0.55 * np.clip(venv / (np.percentile(venv[venv > 0], 90) + 1e-9), 0, 1)
    music_l = m[:n] * duck[:, None] * 0.55
    mix = music_l + np.stack([voice, voice], 1) * 1.0 + fx * 0.8
    # gentle bus limiter
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = norm(mix, 0.89)
    sf.write(OUT / "mix.wav", mix, SR)
    print("mix", round(len(mix) / SR, 2), "s · cues", len(T["sfx"]))


if __name__ == "__main__":
    main()
