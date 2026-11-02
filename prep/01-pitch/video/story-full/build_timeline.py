"""Lays the voice lines on the clock, on the music's beats, and lists the sound cues. Usage: python build_timeline.py  (writes timeline.json)"""
import json
from pathlib import Path

W = Path(__file__).parent
D = json.loads((W / "vo/durations.json").read_text())
G = json.loads((W / "assets/music/beats.json").read_text())
B = G["beats"]
first = next(i for i, x in enumerate(B) if x >= 20.0)  # the music enters here, where it starts to move
seam = next(i for i, x in enumerate(B) if x >= 75.0)  # sixteen bars repeat here, under the closed filter, so the track lasts the film
OFFSET, SEAM_END, SEAM_BACK = B[first], B[seam], B[seam - 64]
played = B[first:seam] + B[seam - 64:]
BEATS, clock = [], 0.0
for i, x in enumerate(played):
    BEATS.append(round(clock, 3))
    if i + 1 < len(played):
        clock += (played[i + 1] - x) if x != SEAM_END or i + 1 != seam - first else 0
SNAP = {"h01", "h02", "h03", "h04", "h05", "h06", "h07", "n05", "p01", "o01", "o03", "o04", "n16"}
GAP = dict(h01=0.8, h02=1.35, h03=0.6, h04=0.6, h05=0.6, h06=0.6, h07=0.7, n01=1.3, n02=1.3, n03=1.3, n04=1.6, n05=1.5, p01=1.0, p02=0.8, n06=1.0, n07=0.9, n08=0.8, a01=1.0, m01=0.5, n09=0.9, n10=0.5, n11=0.9, n12=0.5, n13=1.0, n14=0.6, n15=0.9, o01=1.0, o02=0.35, o03=0.8, o04=0.4, n16=1.3)
start, t = {}, 0.0
for k in D:
    t += GAP[k]
    if k in SNAP:
        t = next((b for b in BEATS if b >= t), t)
    start[k] = round(t, 3)
    t += D[k]
end = round(t + 3.0, 3)
s = start
drop = s["n05"] - 1.5
WIPES = {"n02": "mk-whoosh", "n04": "mk-sweep", "p01": "whoosh", "n06": "mk-whoosh", "n07": "mk-slide", "n09": "mk-sweep", "n11": "mk-whoosh", "n13": "mk-sweep", "n14": "mk-slide", "n15": "mk-whoosh", "h02": "mk-slide", "h03": "mk-whoosh", "h04": "mk-sweep", "h05": "mk-slide", "h06": "mk-whoosh", "o01": "mk-slide", "o03": "mk-sweep"}
cues = [(s[k] - 0.42, name, 0.2) for k, name in WIPES.items()]
cues += [
    # hook
    (s["h01"] + 0.95, "mk-msg", 0.28), (s["h01"] + 1.6, "buzz", 0.3),
    (s["h02"] + 0.05, "mk-click", 0.25), (s["h02"] + 1.3, "buzz", 0.22), (s["h02"] + 2.75, "mk-sweep", 0.25),
    (s["h03"] + 1.2, "mk-select", 0.3),
    (s["h04"] + 0.6, "mk-tick", 0.25), (s["h04"] + 0.95, "mk-tick", 0.25), (s["h04"] + 1.3, "mk-tick", 0.25), (s["h04"] + 1.7, "mk-select", 0.32), (s["h04"] + 4.2, "mk-ring", 0.16),
    (s["h05"] + 0.2, "mk-lightpop", 0.32), (s["h05"] + 1.75, "mk-lightpop", 0.32),
    (s["h06"] + 0.3, "mk-select", 0.3), (s["h06"] + 7.6, "mk-select", 0.3),
    (s["h07"] - 0.1, "mk-sweep", 0.2),
    (s["n04"] - 0.05, "mk-lightpop", 0.24), (s["n04"] + 1.95, "mk-lightpop", 0.24),
    # the problem
    (s["n01"] + 2.4, "buzz", 0.26), (s["n01"] + 3.6, "buzz", 0.26), (s["n02"] + 3.0, "mk-ring", 0.16),
    (s["n03"] + 0.5, "mk-sweep", 0.18), (s["n03"] + 3.6, "mk-lightpop", 0.3), (s["n03"] + 4.9, "mk-whoosh", 0.16), (s["n03"] + 6.95, "mk-fail", 0.26),
    (drop, "whoosh", 0.2),  # the first story film's whoosh, soft
    # the morning
    (s["p01"] + 3.4, "mk-msg", 0.34), (s["p01"] + 5.2, "mk-lightpop", 0.26), (s["p01"] + 5.5, "mk-lightpop", 0.26), (s["p02"] + 3.3, "mk-lock", 0.36),
    # the rescue
    (s["n06"] + 3.55, "mk-btn", 0.5),
    (s["n07"] + 3.0, "mk-msg", 0.38),
    (s["n08"] + 4.4, "mk-ring", 0.2),
    (s["n09"] + 2.2, "mk-tick", 0.28), (s["n09"] + 2.75, "mk-tick", 0.28), (s["n09"] + 3.3, "mk-tick", 0.28),
    (s["n10"] + 3.0, "mk-ok", 0.32),
    (s["n11"] + 3.1, "mk-good", 0.42),
    (s["n13"] + 3.0, "mk-btn", 0.42), (s["n13"] + 5.3, "mk-ok", 0.28),
    (s["n14"] + 3.4, "mk-select", 0.24),
    # what it is worth, and what it runs on
    (s["o01"] + 5.3, "mk-select", 0.28), (s["o02"] + 0.1, "mk-good", 0.34),
    (s["o03"] + 2.3, "mk-lightpop", 0.3), (s["o03"] + 4.9, "mk-lightpop", 0.3), (s["o03"] + 7.4, "mk-lightpop", 0.3),
    (s["o04"], "mk-lightpop", 0.3),
]
# where the music itself makes a point: it falls away for a beat, or lifts between lines (time, seconds, decibels)
accents = dict(
    gaps=[(s["n03"] + 6.5, 0.9)],
    lifts=[(s["n11"] + 3.0, 1.2, 2.5)],
)
(W / "timeline.json").write_text(json.dumps(dict(end=end, accents=accents, offset=OFFSET, seam_end=SEAM_END, seam_back=SEAM_BACK, drop=drop, start=start, dur=D, cues=cues, captions=json.loads((W / "captions.json").read_text())), ensure_ascii=False, indent=1))
print("end", end, "offset", OFFSET, "drop", drop, {k: start[k] for k in ("h01", "n01", "n05", "o01", "n16")})
