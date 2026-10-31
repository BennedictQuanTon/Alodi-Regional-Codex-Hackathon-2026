"""Lays the voice lines on the clock and lists the sound cues. Usage: python build_timeline.py  (writes timeline.json)"""
import json
from pathlib import Path

W = Path(__file__).parent
D = json.loads((W / "vo/durations.json").read_text())
# pause before each line; n05 lands just after the music's drop at 30 s
GAP = dict(n01=1.0, n02=1.3, n03=1.3, n04=1.6, n06=1.0, n07=0.9, n08=0.8, a01=1.0, m01=0.5, n09=0.9, n10=0.5, n11=0.9, n12=0.5, n13=1.0, n14=0.6, n15=0.9, n16=1.0)
start, t = {}, 0.0
for k in D:
    if k == "n05":
        t = 31.2
    else:
        t += GAP[k]
    start[k] = round(t, 3)
    t += D[k]
end = round(t + 2.2, 3)
s = start
WIPES = ["n02", "n04", "n06", "n07", "n09", "n11", "n13", "n14", "n15"]
cues = [(s[k] - 0.5, "whoosh", 0.32) for k in WIPES]
cues += [
    (s["n01"] + 2.4, "ring", 0.4), (s["n02"] + 3.0, "ring", 0.3),
    (29.9, "whoosh", 0.7),
    (s["n06"] + 1.6, "tap", 1.0),
    (s["n07"] + 3.0, "pop", 0.9),
    (s["n08"] + 4.4, "ring", 0.45),
    (s["n09"] + 2.2, "tap", 0.5), (s["n09"] + 2.75, "tap", 0.5), (s["n09"] + 3.3, "tap", 0.5),
    (s["n10"] + 3.0, "chime", 0.7),
    (s["n11"] + 3.1, "chime", 0.8),
    (s["n13"] + 3.0, "tap", 0.8),
]
(W / "timeline.json").write_text(json.dumps(dict(end=end, start=start, dur=D, cues=cues, wipes=WIPES, captions=json.loads((W / "captions.json").read_text())), ensure_ascii=False, indent=1))
print("end", end)
