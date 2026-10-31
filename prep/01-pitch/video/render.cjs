// Renders film/index.html frame by frame (deterministic seek), then muxes the audio.
// Usage: NODE_PATH=<playwright-core dir> node render.cjs <film_url> <out_dir> [--times 1,5,12] [--from 0 --to 120]
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const URL = process.argv[2];
const OUT = process.argv[3];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 30000 });
  const fps = await page.evaluate(() => window.__film.fps);
  const end = await page.evaluate(() => window.__film.end);
  fs.mkdirSync(OUT, { recursive: true });
  const times = arg("--times") ? arg("--times").split(",").map(Number) : null;
  const list = times ?? (() => {
    const a = Math.round(Number(arg("--from", 0)) * fps), b = Math.round(Number(arg("--to", end)) * fps);
    return Array.from({ length: b - a }, (_, i) => (a + i) / fps);
  })();
  const t0 = Date.now();
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    await page.evaluate((tt) => window.__film.seek(tt), t);
    const name = times ? `t${t.toFixed(2)}.jpg` : String(Math.round(t * fps)).padStart(5, "0") + ".jpg";
    await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 93 });
    if (!times && i % 300 === 0) console.log(`${i} / ${list.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
  console.log("done", list.length);
})();
