// Records the real demo UI on four screens at once. Each screen gets its own browser context
// (so its viewport is the real device size); all four engines start on the same tick.
// Usage: NODE_PATH=<dir with playwright-core> node capture.cjs <base_url> <out_dir>
// Output: <out_dir>/<run>/<view>/NNNNN.jpg + frames.json (timestamps) for each run and view.
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3001";
const OUT = process.argv[3] || "ui";
const VIEWS = {
  courier: { url: "/demo/shipper", size: [560, 1000] },
  buyer: { url: "/demo/buyer", size: [560, 1000] },
  ops: { url: "/demo/console", size: [1280, 1000] },
  control: { url: "/demo", size: [1600, 1000] },
};
const RUNS = [
  { name: "main", scenario: "A_main", maxSec: 150 },
  { name: "refuse", scenario: "REFUSE", maxSec: 60 },
];
const HIDE = "nextjs-portal{display:none!important}";

async function prepare(p, scenario) {
  await p.getByRole("button", { name: "Options" }).click();
  const auto = p.getByRole("button", { name: "Auto-tap" });
  if ((await auto.getAttribute("aria-pressed")) !== "true") await auto.click();
  await p.getByRole("button", { name: "1x" }).click();
  await p.getByRole("button", { name: "Options" }).click();
  await p.selectOption('select[aria-label="Scenario"]', scenario);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  for (const run of RUNS) {
    const pages = {};
    for (const [v, cfg] of Object.entries(VIEWS)) {
      const ctx = await browser.newContext({ viewport: { width: cfg.size[0], height: cfg.size[1] }, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      await p.goto(BASE + cfg.url, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: HIDE });
      pages[v] = { p, ctx };
    }
    await pages.control.p.waitForTimeout(6000); // brand wipe
    for (const { p } of Object.values(pages)) await prepare(p, run.scenario);
    await pages.control.p.waitForTimeout(800);
    const sessions = {};
    for (const [v, { p, ctx }] of Object.entries(pages)) {
      const dir = path.join(OUT, run.name, v);
      fs.mkdirSync(dir, { recursive: true });
      const cdp = await ctx.newCDPSession(p);
      const frames = [];
      cdp.on("Page.screencastFrame", async (f) => {
        const i = frames.length;
        fs.writeFileSync(path.join(dir, String(i).padStart(5, "0") + ".jpg"), Buffer.from(f.data, "base64"));
        frames.push({ i, t: f.metadata.timestamp });
        try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
      });
      const [w, h] = VIEWS[v].size;
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: w * 2, maxHeight: h * 2, everyNthFrame: 1 });
      sessions[v] = { cdp, frames, dir };
    }
    const t0 = Date.now() / 1000;
    await Promise.all(Object.values(pages).map(({ p }) => p.getByRole("button", { name: /^(Play|Replay)$/ }).click()));
    await Promise.all(["courier", "buyer", "ops"].map((v) => pages[v].p.keyboard.press("h")));
    const keepAlive = setInterval(() => Object.values(pages).forEach(({ p }) => p.evaluate(() => {
      document.body.style.outline = document.body.style.outline ? "" : "0px solid transparent";
    }).catch(() => {})), 100);
    const ctl = pages.control.p;
    for (;;) {
      await ctl.waitForTimeout(500);
      const label = await ctl.getByRole("button", { name: /^(Play|Pause|Replay)$/ }).textContent();
      if (label.trim() === "Replay" || Date.now() / 1000 - t0 > run.maxSec) break;
    }
    await ctl.waitForTimeout(2500);
    clearInterval(keepAlive);
    for (const [v, s] of Object.entries(sessions)) {
      await s.cdp.send("Page.stopScreencast");
      fs.writeFileSync(path.join(s.dir, "frames.json"), JSON.stringify({ t0, frames: s.frames }));
      console.log(run.name, v, s.frames.length, "frames", (s.frames.at(-1)?.t - s.frames[0]?.t).toFixed(1), "s");
    }
    for (const { ctx } of Object.values(pages)) await ctx.close();
  }
  await browser.close();
})();
