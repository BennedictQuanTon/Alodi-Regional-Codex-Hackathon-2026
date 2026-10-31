"""Turn screencast frames (variable timing) into constant 30 fps clips. Usage: python3 build_clips.py <ui_dir> <out_dir>"""
import json, subprocess, sys
from pathlib import Path
ui, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for fj in sorted(ui.glob("*/*/frames.json")):
    run, view = fj.parent.parent.name, fj.parent.name
    meta = json.loads(fj.read_text())
    fr = meta["frames"]
    t0 = fr[0]["t"]
    lines = []
    for a, b in zip(fr, fr[1:] + [{"t": fr[-1]["t"] + 0.5}]):
        lines += [f"file '{fj.parent / (str(a['i']).zfill(5) + '.jpg')}'", f"duration {max(b['t'] - a['t'], 0.001):.4f}"]
    lines.append(f"file '{fj.parent / (str(fr[-1]['i']).zfill(5) + '.jpg')}'")
    lst = fj.parent / "concat.txt"
    lst.write_text("\n".join(lines))
    dst = out / f"{run}-{view}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-vf", "fps=30,format=yuv420p",
                    "-c:v", "h264_videotoolbox", "-b:v", "20M", "-g", "15", "-movflags", "+faststart", str(dst)], check=True)
    json.dump({"start_offset": t0 - meta["t0"]}, open(out / f"{run}-{view}.json", "w"))
    print(dst.name, round(fr[-1]["t"] - t0, 1), "s, starts", round(t0 - meta["t0"], 2), "s after Play")
