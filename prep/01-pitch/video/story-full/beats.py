"""Finds the music's beat grid. Usage: python beats.py  (needs librosa). Writes assets/music/beats.json"""
import json
from pathlib import Path
import librosa
import numpy as np
W = Path(__file__).parent
y, sr = librosa.load(W / "assets/music/your-breath.mp3", sr=22050, mono=True)
tempo, b = librosa.beat.beat_track(y=y, sr=sr)
beats = librosa.frames_to_time(b, sr=sr).tolist()
(W / "assets/music/beats.json").write_text(json.dumps(dict(tempo=float(np.atleast_1d(tempo)[0]), beats=[round(x, 3) for x in beats])))
print(len(beats))
