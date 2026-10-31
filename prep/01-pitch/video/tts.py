"""Voice-over with Kokoro-82M (Apache-2.0). Usage: python tts.py <video_dir>"""
import json, sys
import numpy as np, soundfile as sf
from kokoro import KPipeline
from phonemizer.backend.espeak.wrapper import EspeakWrapper
# use the Homebrew espeak-ng (the wheel's bundled data path is broken on macOS)
EspeakWrapper.set_library("/opt/homebrew/lib/libespeak-ng.dylib")
EspeakWrapper.set_data_path("/opt/homebrew/share/espeak-ng-data")

w = sys.argv[1]
pipe = KPipeline(lang_code="a")
out = {}
for vid, voice, speed, text in json.load(open(f"{w}/script.json")):
    audio = np.concatenate([a for _, _, a in pipe(text, voice=voice, speed=speed)])
    sf.write(f"{w}/vo/{vid}.wav", audio, 24000)
    out[vid] = round(len(audio) / 24000, 3)
    print(vid, out[vid], flush=True)
json.dump(out, open(f"{w}/vo/durations.json", "w"), indent=1)
