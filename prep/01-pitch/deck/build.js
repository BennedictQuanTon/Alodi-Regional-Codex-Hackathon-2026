// Alodi pitch deck. Usage: node build.js <out.pptx>, then python autoplay.py <out.pptx>.
// Needs pptxgenjs and sharp; APPLY_THEME points at a module exporting applyTheme(path, theme).
// Figures: team cost model and PRD. Survey values are placeholders until the interview export lands.
const path = require("path");
const sharp = require("sharp");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.APPLY_THEME);

const A = (f) => path.join(__dirname, "assets", f);
const OUT = process.argv[2] || path.join(__dirname, "Alodi-Pitch.pptx");
const TOTAL = 15;

const THEME = {
  name: "Alodi",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "121A2C", lt1: "FFFFFF", dk2: "1F2A44", lt2: "F7F7F8",
    accent1: "F05A00", accent2: "FF9D66", accent3: "5B6275", accent4: "C3C7D0", accent5: "E6E8EC", accent6: "0E8A6C",
    hlink: "F05A00", folHlink: "C94B00",
  },
};
const H = {
  ink: "121A2C", navy: "1F2A44", text: "222B40", muted: "3A4358", faint: "4A556E", grey: "5F6F91", line: "D5D9E2",
  orange: "F05A00", peach: "F05A00", tint: "FFF1E7", tintLine: "FFCFB0", soft: "F6F3F1", white: "FFFFFF", card: "FFFFFF", green: "0E8A6C", blue: "E9EEF8", blueLine: "C9D4EA",
};
const W = 13.333;
const M = 0.6;

async function rounded(file, w, h, r = 0.2, pos = "centre") {
  const px = 220;
  const Wp = Math.round(w * px), Hp = Math.round(h * px), R = Math.round(r * px);
  const mask = Buffer.from(`<svg width="${Wp}" height="${Hp}"><rect width="${Wp}" height="${Hp}" rx="${R}" ry="${R}"/></svg>`);
  const buf = await sharp(A(file)).resize(Wp, Hp, { fit: "cover", position: pos }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function greyed(file, w, h, r = 0.2) {
  const px = 220, Wp = Math.round(w * px), Hp = Math.round(h * px), R = Math.round(r * px);
  const mask = Buffer.from(`<svg width="${Wp}" height="${Hp}"><rect width="${Wp}" height="${Hp}" rx="${R}" ry="${R}"/></svg>`);
  const buf = await sharp(A(file)).resize(Wp, Hp, { fit: "cover" }).grayscale().modulate({ brightness: 1.08 }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const person = async (c) => "image/png;base64," + (await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.5" fill="#${c}"/><path d="M3.5 23c0-5.5 3.8-9 8.5-9s8.5 3.5 8.5 9z" fill="#${c}"/></svg>`)).png().toBuffer()).toString("base64");
async function cover(file, w, h, pos = "centre") {
  const buf = await sharp(A(file)).resize(Math.round(w * 160), Math.round(h * 160), { fit: "cover", position: pos }).jpeg({ quality: 82 }).toBuffer();
  return "image/jpeg;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Alodi · Make the second drop land";
  pres.author = "Team Develarper";
  pres.company = "Team Develarper";
  pres.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: "Light",
    background: { color: H.white },
    objects: [
      { image: { x: M, y: 7.02, w: 0.46, h: 0.2, path: A("logo-navy.png") } },
      { text: { text: "Sea × OpenAI Regional Codex Hackathon · October 2026", options: { x: 4.17, y: 7.0, w: 5, h: 0.24, fontSize: 9, color: C.accent3, align: "center", margin: 0, charSpacing: 1 } } },
    ],
  });
  pres.defineSlideMaster({
    title: "Dark",
    background: { color: H.ink },
    objects: [
      { image: { x: M, y: 7.02, w: 0.46, h: 0.2, path: A("logo-white.png") } },
      { text: { text: "Sea × OpenAI Regional Codex Hackathon · October 2026", options: { x: 4.17, y: 7.0, w: 5, h: 0.24, fontSize: 9, color: C.accent4, align: "center", margin: 0, charSpacing: 1 } } },
    ],
  });
  pres.defineSlideMaster({ title: "Full bleed", background: { color: H.white }, objects: [] });

  /* ---------- helpers ---------- */
  const T = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontFace: "Arial", color: H.navy, ...o });
  const page = (s, n, dark = false) => T(s, `${String(n).padStart(2, "0")} / ${TOTAL}`, { x: W - M - 1, y: 7.0, w: 1, h: 0.24, fontSize: 9, color: dark ? H.grey : H.muted, align: "right", charSpacing: 1 });
  // body text with trailing [n] reference markers rendered smaller and muted; sources are listed on the References slide
  const refs = (d, dark = false) => {
    const m = d.match(/^(.*?)((?:\s*\[\d+\])+)$/);
    if (!m) return d;
    return [{ text: m[1] }, { text: " " + m[2].replace(/\s+/g, ""), options: { fontSize: 10, color: H.faint } }];
  };
  const eyebrow = (s, num, label, dark = false, ex = M) => {
    s.addShape(pres.shapes.LINE, { x: ex, y: 0.67, w: 0.32, h: 0, line: { color: dark ? H.peach : H.orange, width: 1.25 }, objectName: "Eyebrow rule" });
    T(s, [{ text: num + "  ", options: { color: dark ? H.faint : H.faint } }, { text: label.toUpperCase(), options: { bold: true, color: dark ? H.white : H.navy } }], { x: ex + 0.45, y: 0.54, w: 6, h: 0.27, fontSize: 10.5, charSpacing: 2 });
  };
  const title = (s, lead, rest, o = {}, dark = false) =>
    T(s, [{ text: lead + " ", options: { color: dark ? "9AA3B8" : H.grey } }, { text: rest, options: { color: dark ? H.white : H.ink } }], { x: M, y: 0.92, w: 6.4, h: 1.6, fontSize: 30, bold: true, valign: "top", lineSpacingMultiple: 0.95, ...o });
  const card = (s, x, y, w, h, o = {}) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.r ?? 0.14, fill: { color: o.fill ?? H.white }, line: o.line === false ? { type: "none" } : { color: o.line ?? H.line, width: 0.75 }, shadow: o.shadow ? { type: "outer", blur: 14, offset: 3, angle: 90, color: "121A2C", opacity: 0.16 } : undefined, objectName: o.name });
  const icon = (s, kind, x, y, tone = "navy", bg = "F1F2F5") => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.36, h: 0.36, rectRadius: 0.08, fill: { color: bg }, line: { type: "none" }, objectName: "Icon tile" });
    s.addImage({ path: A(`mark-${kind}-${tone}.png`), x: x + 0.07, y: y + 0.07, w: 0.22, h: 0.22, objectName: "Icon" });
  };
  const label = (s, t, x, y, w, dark = false) => T(s, t.toUpperCase(), { x, y, w, h: 0.24, fontSize: 9.5, charSpacing: 1.5, color: H.muted });

  /* ---------- 1 · cover ---------- */
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "Full bleed", sectionTitle: "Opening" });
    s.addImage({ path: A("logo-navy.png"), x: M, y: 0.6, w: 1.0, h: 0.43, objectName: "Logo" });
    T(s, "SEA × OPENAI REGIONAL CODEX HACKATHON · OCTOBER 2026", { x: M, y: 1.8, w: 6.1, h: 0.4, fontSize: 13, bold: true, charSpacing: 0.5, color: H.orange });
    T(s, [{ text: "Make the second", options: { color: H.ink, breakLine: true } }, { text: "drop land.", options: { color: H.orange } }], { x: M, y: 2.35, w: 6.4, h: 2.0, fontFace: "Cambria", italic: true, fontSize: 56, lineSpacingMultiple: 0.92 });
    T(s, [{ text: "Every failed delivery, rescued with one tap. ", options: { bold: true, color: H.ink } }, { text: "The shipper taps once; Alodi chats, calls and hands the next shipper when, where and who.", options: { color: H.muted } }], { x: M, y: 4.4, w: 5.6, h: 0.9, fontSize: 14, lineSpacingMultiple: 1.1 });
    const team = ["nomura-yoshio.jpg", "long-quan-ton.jpg", "khanh-tuong-huynh.jpg", "thanh-loi-tran.jpg"];
    for (const [i, f] of team.entries()) s.addImage({ data: await rounded(f, 0.46, 0.46, 0.23, "attention"), x: M + i * 0.34, y: 6.3, w: 0.46, h: 0.46, objectName: `Avatar ${i + 1}` });
    T(s, [{ text: "Team Develarper", options: { bold: true, color: H.ink, fontSize: 15, breakLine: true } }, { text: "Built with OpenAI and Codex", options: { color: H.muted, fontSize: 11 } }], { x: M + 1.65, y: 6.22, w: 2.4, h: 0.62, valign: "middle" });
    s.addImage({ path: A("qr.png"), x: 4.75, y: 6.03, w: 0.98, h: 0.98, altText: "QR code to alodi-ai-system.vercel.app", objectName: "QR code", hyperlink: { url: "https://alodi-ai-system.vercel.app" } });
    T(s, "Scan to try the demo", { x: 5.8, y: 6.22, w: 0.85, h: 0.62, fontSize: 10.5, bold: true, color: H.ink, valign: "middle" });
    s.addImage({ data: await rounded("night.jpg", 5.95, 6.5, 0.24), x: 6.78, y: 0.5, w: 5.95, h: 6.5, altText: "Riders in evening traffic, Ho Chi Minh City", objectName: "Cover photo" });
    card(s, 7.2, 4.2, 4.1, 2.4, { shadow: true, line: false, r: 0.16, name: "Rescue card" });
    T(s, "RESCUE · SPXVN0123456789", { x: 7.45, y: 4.4, w: 3.6, h: 0.22, fontSize: 8, charSpacing: 1.5, color: H.muted });
    [["10:02", "Shipper taps · No answer", "dot"], ["10:02", "Chat sent to the buyer", "dot"], ["11:15", "Card ready · 1 Nov, 17–20h", "check"]].forEach(([t, l, k], i) => {
      const y = 4.77 + i * 0.55;
      s.addShape(pres.shapes.LINE, { x: 7.45, y: y - 0.06, w: 3.6, h: 0, line: { color: H.line, width: 0.5 }, objectName: `Row rule ${i}` });
      s.addImage({ path: A(`mark-${k}-${i === 2 ? "orange" : "navy"}.png`), x: 7.45, y: y + 0.05, w: 0.24, h: 0.24, objectName: `Row icon ${i}` });
      T(s, l, { x: 7.8, y: y + 0.03, w: 2.7, h: 0.3, fontSize: 12, bold: i === 2, color: i === 2 ? H.orange : H.navy });
      T(s, t, { x: 10.45, y: y + 0.05, w: 0.6, h: 0.26, fontSize: 9.5, color: H.muted, align: "right" });
    });
    s.addNotes("Open with the name and the line: make the second drop land. Then roll the skit.");
  }


  const videoSlide = (section, tag, notes, n) => {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: section });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.55, w: W - 2 * M, h: 6.0, rectRadius: 0.2, fill: { color: H.soft }, line: { color: H.line, width: 0.75 }, objectName: "Video frame" });
    T(s, tag.toUpperCase(), { x: M, y: 3.4, w: W - 2 * M, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: H.muted, align: "center" });
    page(s, n);
    s.addNotes(notes);
    return s;
  };


  /* ---------- 2 · skit ---------- */
  {
    const s = pres.addSlide({ masterName: "Full bleed", sectionTitle: "Opening" });
    s.addMedia({ type: "video", path: path.join(__dirname, "../video/alodi-skit.mp4"), cover: "image/jpeg;base64," + require("fs").readFileSync(A("skit-cover.jpg")).toString("base64"), x: 0, y: 0, w: W, h: 7.5, objectName: "Skit" });
    s.addNotes("The 20-second skit starts by itself when this slide opens.");
  }

  /* ---------- 3 · TL;DR ---------- */
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Opening" });
    eyebrow(s, "01", "TL;DR");
    title(s, "The agentic recovery", "system for last-mile delivery.", { w: 5.85, h: 1.65 });
    const facts = [["For", "Carriers like SPX, their shippers and buyers"], ["Starts with", "One tap: No answer · Rescheduled · Refused"], ["Does", "Asks for a window first, recovers by chat and voice, writes a context card"], ["Never", "Labels or returns an order without a person"]];
    facts.forEach(([k, v], i) => {
      const y = 2.5 + i * 1.0;
      s.addShape(pres.shapes.LINE, { x: M, y, w: 5.8, h: 0, line: { color: i === 0 ? H.ink : H.line, width: i === 0 ? 1 : 0.75 }, objectName: `Fact rule ${i}` });
      T(s, k.toUpperCase(), { x: M, y: y + 0.12, w: 1.5, h: 0.76, fontSize: 12, bold: true, charSpacing: 0.8, color: H.orange, valign: "middle" });
      T(s, v, { x: 2.15, y: y + 0.12, w: 4.3, h: 0.76, fontSize: 16, bold: true, color: H.navy, valign: "middle" });
    });
    s.addImage({ data: await rounded("hcmc-street.jpg", 5.95, 6.0, 0.22, "south"), x: 6.78, y: 0.55, w: 5.95, h: 6.0, altText: "A rider carrying goods on a motorbike, Ho Chi Minh City", objectName: "Photo" });
    card(s, 7.15, 3.85, 3.95, 2.35, { shadow: true, line: false, name: "Context card" });
    T(s, "WHAT THE NEXT SHIPPER SEES", { x: 7.4, y: 4.04, w: 3.4, h: 0.22, fontSize: 8, charSpacing: 1.5, color: H.muted });
    [["When", "1 Nov, 17:00–20:00"], ["Where", "Tower A reception"], ["Who", "Receptionist can sign"], ["Confidence", "0.92, applied"]].forEach(([k, v], i) => {
      const y = 4.36 + i * 0.42;
      s.addShape(pres.shapes.LINE, { x: 7.4, y, w: 3.45, h: 0, line: { color: H.line, width: 0.5 }, objectName: `Card rule ${i}` });
      T(s, k, { x: 7.4, y: y + 0.08, w: 1.2, h: 0.28, fontSize: 12, color: H.navy });
      T(s, v, { x: 8.5, y: y + 0.08, w: 2.35, h: 0.28, fontSize: 12, bold: i === 0, color: i === 0 ? H.orange : H.navy, align: "right" });
    });
    page(s, 3);
    s.addNotes("In one breath: the shipper taps once, Alodi talks to the buyer, and the next attempt arrives with when, where and who. Anything about money or a buyer's record stays with a person.");
  }

  /* ---------- 4 · our story ---------- */
  pres.addSection({ title: "Problem" });
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Problem" });
    s.addImage({ data: await greyed("approach-phone.jpg", 4.9, 6.0, 0.22), x: M, y: 0.55, w: 4.9, h: 6.0, altText: "A hand holding a smartphone", objectName: "Phone photo" });
    card(s, M + 0.3, 5.3, 4.3, 0.9, { shadow: true, line: false, name: "Quote" });
    T(s, "“Called twice. No answer.”", { x: M + 0.3, y: 5.3, w: 4.3, h: 0.9, fontFace: "Cambria", italic: true, fontSize: 20, color: H.ink, align: "center", valign: "middle" });
    eyebrow(s, "02", "Our story", false, 5.95);
    title(s, "This happened to us.", "Again and again.", { x: 5.95, w: 6.8, h: 0.6, fontSize: 25 });
    const rows = [
      ["shipper", "Missed call from the shipper", "In a meeting. The phone was on silent.", "10:02"],
      ["buyer", "We called back", "No answer. The shipper was already riding.", "10:40"],
      ["buyer", "We left a note on the order", "“Please leave it at reception.” Nobody read it.", "11:15"],
      ["shipper", "Delivery failed", "Reason on the app: buyer unreachable.", "12:30"],
      ["seller", "Returned to seller", "We still wanted the parcel.", "Day 5"],
    ];
    rows.forEach(([who, h, d, t], i) => {
      const y = 1.72 + i * 0.97, last = i === 4;
      card(s, 5.95, y, 6.78, 0.86, { fill: last ? H.tint : H.soft, line: last ? H.tintLine : H.line, r: 0.12, name: `Notification ${i + 1}` });
      s.addImage({ path: A(`${who}.png`), x: 6.1, y: y + 0.13, w: 0.6, h: 0.6, altText: who, objectName: `Person ${i + 1}` });
      T(s, h, { x: 6.85, y: y + 0.13, w: 4.7, h: 0.3, fontSize: 14, bold: true, color: last ? H.orange : H.ink });
      T(s, d, { x: 6.85, y: y + 0.45, w: 5.2, h: 0.28, fontSize: 12.5, color: H.muted });
      T(s, t, { x: 11.5, y: y + 0.14, w: 1.05, h: 0.24, fontSize: 10.5, color: H.muted, align: "right" });
    });
    page(s, 4);
    s.addNotes("Tell it plainly and slowly, as your own story: we missed the call, we called back, we left a note, and the parcel still went back. Annoying for us, wasted trips for the shipper, a fee for the seller.");
  }

  /* ---------- 5 · problem 1, survey ---------- */
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Problem" });
    eyebrow(s, "03", "Problem 1 · What we heard", false, 5.25);
    title(s, "We asked both sides", "of the same missed call.", { x: 5.25, w: 7.5, h: 0.6, fontSize: 24 });
    s.addImage({ data: await rounded("spx-hub.jpg", 4.25, 6.0, 0.22), x: M, y: 0.55, w: 4.25, h: 6.0, altText: "SPX Express hub, Ho Chi Minh City", objectName: "Field photo" });
    card(s, M + 0.2, 5.85, 3.85, 0.5, { line: false, shadow: true, r: 0.1, name: "Photo caption" });
    T(s, "FIELD VISIT · SPX EXPRESS HUB, HCMC", { x: M + 0.2, y: 5.85, w: 3.85, h: 0.5, fontSize: 8.5, bold: true, charSpacing: 1.2, color: H.navy, align: "center", valign: "middle" });
    const on = await person(H.orange), off = await person("C9D4EA");
    const groups = [
      ["BUYERS · n = 100", ["b1", "b2", "b3", "b4"], [[86, "want to choose a delivery window [1]"], [66, "called the shipper back and couldn’t reach them [1]"]]],
      ["SHIPPERS · n = 12 · 6 CARRIERS", ["shipper", "next", "b2"], [[27, "of their calls to buyers go unanswered [1]"], [83, "would use an Alodi-like system [1]"]]],
    ];
    groups.forEach(([g, faces, st], gi) => {
      const y = 1.68 + gi * 2.2;
      s.addShape(pres.shapes.LINE, { x: 5.25, y, w: 7.48, h: 0, line: { color: H.ink, width: 1 }, objectName: `Group rule ${gi}` });
      faces.forEach((f, k) => s.addImage({ path: A(`${f}.png`), x: 5.25 + k * 0.28, y: y + 0.1, w: 0.4, h: 0.4, objectName: `Face ${gi}${k}` }));
      label(s, g, 5.25 + faces.length * 0.28 + 0.25, y + 0.2, 4.5);
      st.forEach(([n, d], i) => {
        const x = 5.25 + i * 3.8;
        T(s, [{ text: String(n), options: { color: H.ink } }, { text: "%", options: { color: H.orange } }], { x, y: y + 0.52, w: 1.75, h: 0.75, fontSize: 44, bold: true });
        for (let k = 0; k < 10; k++) s.addImage({ data: k < Math.round(n / 10) ? on : off, x: x + 1.8 + (k % 5) * 0.3, y: y + 0.56 + Math.floor(k / 5) * 0.34, w: 0.26, h: 0.3, objectName: `Pictogram ${gi}${i}${k}` });
        T(s, refs(d), { x, y: y + 1.3, w: 3.55, h: 0.6, fontSize: 14, color: H.text, valign: "top" });
      });
    });
    page(s, 5);
    s.addNotes("These values are still the generated placeholders in prep/06-survey. Replace them with the interview export, then delete the status line, before quoting them as findings.");
  }

  /* ---------- 6 · problem 2, research ---------- */
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Problem" });
    eyebrow(s, "03", "Problem 2 · The research");
    title(s, "The public numbers", "tell the same story.", { w: 5.85, h: 1.2 });
    s.addShape(pres.shapes.LINE, { x: M, y: 2.35, w: 5.85, h: 0, line: { color: H.ink, width: 1 }, objectName: "Rows top rule" });
    const rows = [
      ["VN · RETURN FEE", [["₫", H.orange], ["40,000", H.ink]], "the seller pays to ship back a failed Shopee order; only 1 in 4 is rescued today. [2][3][8]"],
      ["VN · REFUSED AT THE DOOR", [["8–12", H.ink], ["%", H.orange]], "of orders nationwide; up to 20% in remote areas, 25–30% in sale season. [4]"],
      ["SHOPEE · DELIVERY WINDOWS", [["0", H.ink]], "a buyer can choose. The time is agreed by phone, within 2–3 contacts and 5 days. [5][6]"],
    ];
    rows.forEach(([lab, num, d], i) => {
      const y = 2.5 + i * 1.37;
      label(s, lab, M, y, 2.7);
      T(s, num.map(([t, c]) => ({ text: t, options: { color: c } })), { x: M, y: y + 0.28, w: 2.7, h: 0.8, fontSize: 38, bold: true });
      T(s, refs(d), { x: 3.35, y: y + 0.04, w: 3.1, h: 1.15, fontSize: 13.5, color: H.text, valign: "middle" });
      if (i < 2) s.addShape(pres.shapes.LINE, { x: M, y: y + 1.27, w: 5.85, h: 0, line: { color: H.line, width: 0.75 }, objectName: `Row rule ${i}` });
    });
    card(s, 6.78, 0.55, 5.95, 6.0, { fill: H.tint, line: H.tintLine, r: 0.2, name: "Loss card" });
    label(s, "Loss · one area · a month", 7.1, 0.82, 4);
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Loss a month (₫M)", labels: ["Return fees", "Redelivery pay", "CS call-backs", "Door time"], values: [288, 101, 45, 39] }], { x: 8.1, y: 1.1, w: 3.3, h: 3.0, holeSize: 66, chartColors: ["F05A00", "1F2A44", "7D8FB5", "C9D4EA"], showLegend: false, showLabel: false, showValue: false, showPercent: false, showTitle: false, dataBorder: { pt: 1.5, color: "FFF1E7" }, objectName: "Loss chart", altText: "Loss a month by item" });
    T(s, [{ text: "₫", options: { color: H.orange } }, { text: "473M", options: { color: H.ink } }], { x: 8.1, y: 2.3, w: 3.3, h: 0.6, fontSize: 30, bold: true, align: "center", valign: "middle" });
    [["F05A00", "Return fees paid by sellers", "₫288M"], ["1F2A44", "Shipper pay for redelivery", "₫101M"], ["7D8FB5", "CS calling buyers back", "₫45M"], ["C9D4EA", "Shipper time at unanswered doors", "₫39M"]].forEach(([c, k, v], i) => {
      const y = 4.2 + i * 0.44;
      s.addShape(pres.shapes.LINE, { x: 7.1, y, w: 5.3, h: 0, line: { color: H.tintLine, width: 0.75 }, objectName: `Legend rule ${i}` });
      s.addShape(pres.shapes.OVAL, { x: 7.1, y: y + 0.14, w: 0.16, h: 0.16, fill: { color: c }, line: { type: "none" }, objectName: `Legend dot ${i}` });
      T(s, k, { x: 7.38, y: y + 0.08, w: 3.9, h: 0.3, fontSize: 12.5, color: H.text });
      T(s, v, { x: 11.3, y: y + 0.08, w: 1.1, h: 0.3, fontSize: 13, bold: true, color: H.ink, align: "right" });
    });
    T(s, refs("20 shippers, 4,000 orders a day. Modelled. [7][9]"), { x: 7.1, y: 6.0, w: 5.3, h: 0.3, fontSize: 11, color: H.muted });
    page(s, 6);
    s.addNotes("Our story is not unusual. Sellers pay up to ₫40,000 per failed order, 8 to 12 percent are refused at the door, and buyers have no window to pick. For one area that models to about ₫473M a month.");
  }


  /* ---------- 7 · why Alodi ---------- */
  pres.addSection({ title: "Alodi" });
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Alodi" });
    eyebrow(s, "04", "Why we built Alodi");
    title(s, "The route isn’t broken.", "The context dies in a phone call.", { w: 12.1, h: 0.6, fontSize: 28 });
    const side = [
      [0, "shipper", "Shipper", "Taps one outcome", "TAP"], [1, "buyer", "Buyer", "Answers in chat or on a call", "ANSWER"], [2, "ops", "Hub ops", "Route and order data", "DATA"],
      [0, "next", "Next shipper", "Gets when, where and who", "CARD"], [1, "cs", "Customer service", "Takes refusals and doubts", "PERSON"], [2, "seller", "Seller", "Pays fewer return fees", "SAVED"],
    ];
    const cy = 3.3;
    side.forEach(([r, f, n, d, tag], i) => {
      const left = i < 3, x = left ? M : 9.33, w = 3.4, y = 1.75 + r * 1.07, h = 0.95, mid = y + h / 2;
      const lx = left ? x + w : 8.75, lw = 0.58;
      const up = left ? mid > cy : mid < cy; // line runs edge to centre card
      s.addShape(pres.shapes.LINE, { x: lx, y: Math.min(mid, cy), w: lw, h: Math.abs(mid - cy), flipV: up, line: { color: H.grey, width: 1, dashType: "sysDash" }, objectName: `Link ${i}` });
      card(s, x, y, w, h, { fill: H.white, name: `Actor ${i + 1}` });
      s.addImage({ path: A(`${f}.png`), x: x + 0.14, y: y + 0.17, w: 0.62, h: 0.62, altText: n, objectName: `Person ${i + 1}` });
      T(s, n, { x: x + 0.88, y: y + 0.17, w: 1.75, h: 0.28, fontSize: 13, bold: true, color: H.ink });
      T(s, d, { x: x + 0.88, y: y + 0.47, w: 2.42, h: 0.3, fontSize: 11.5, color: H.muted });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + w - 0.82, y: y + 0.15, w: 0.7, h: 0.25, rectRadius: 0.06, fill: { color: left ? H.blue : H.tint }, line: { type: "none" }, objectName: `Tag ${i}` });
      T(s, tag, { x: x + w - 0.82, y: y + 0.15, w: 0.7, h: 0.25, fontSize: 7.5, bold: true, charSpacing: 0.5, color: left ? H.navy : H.orange, align: "center", valign: "middle" });
    });
    card(s, 4.58, 1.75, 4.17, 3.09, { fill: H.tint, line: H.tintLine, shadow: true, name: "Alodi card" });
    s.addImage({ path: A("logo-navy.png"), x: 4.83, y: 1.95, w: 0.72, h: 0.31, objectName: "Alodi logo" });
    T(s, "AI AGENT", { x: 6.9, y: 2.0, w: 1.6, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1.5, color: H.orange, align: "right" });
    [["When", "1 Nov, 17:00–20:00"], ["Where", "Tower A reception"], ["Who", "Receptionist can sign"]].forEach(([k, v], i) => {
      const y = 2.42 + i * 0.47;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.83, y, w: 3.67, h: 0.41, rectRadius: 0.07, fill: { color: H.white }, line: { color: H.tintLine, width: 0.5 }, objectName: `Field ${i}` });
      T(s, k, { x: 4.97, y, w: 0.9, h: 0.41, fontSize: 11.5, color: H.muted, valign: "middle" });
      T(s, v, { x: 5.8, y, w: 2.58, h: 0.41, fontSize: 12, bold: true, color: H.ink, align: "right", valign: "middle" });
    });
    T(s, "Calls 08:00–20:30 only · ≤ 2 calls a cycle · applies alone at ≥ 0.85 · a person handles labels", { x: 4.83, y: 3.9, w: 3.67, h: 0.8, fontSize: 11, color: H.text, valign: "middle" });
    const cs = [["0", "windows to choose", "So the time is agreed by phone, off the system. [5]"], ["1", "error code", "“No answer” replaces when, where and who."], ["≈ 5", "callers per area", "Just to phone 320 buyers twice a day. [9]"]];
    s.addShape(pres.shapes.LINE, { x: M, y: 5.12, w: 12.13, h: 0, line: { color: H.ink, width: 1 }, objectName: "Reasons rule" });
    cs.forEach(([n, k, d], i) => {
      const x = M + i * 4.1;
      T(s, n, { x, y: 5.3, w: 1.05, h: 0.9, fontSize: 32, bold: true, color: H.orange, valign: "middle" });
      T(s, k, { x: x + 1.08, y: 5.28, w: 2.85, h: 0.3, fontSize: 13.5, bold: true, color: H.ink });
      T(s, refs(d), { x: x + 1.08, y: 5.6, w: 2.85, h: 0.75, fontSize: 12, color: H.text, valign: "top" });
    });
    page(s, 7);
    s.addNotes("That is why we built Alodi. The buyer's answer never enters the system, so the agent collects it inside the carrier's rules and hands it to the next shipper. Anything about money or a buyer's record goes to a person.");
  }


  /* ---------- 8 · film, 9 · live demo ---------- */
  {
    const s = pres.addSlide({ masterName: "Full bleed", sectionTitle: "Alodi" });
    s.addMedia({ type: "video", path: path.join(__dirname, "../../../web/public/video/alodi-story.mp4"), cover: "image/jpeg;base64," + require("fs").readFileSync(path.join(__dirname, "../../../web/public/video/alodi-story.jpg")).toString("base64"), x: 0, y: 0, w: W, h: 7.5, objectName: "Demo film" });
    s.addNotes("The film starts by itself when this slide opens and runs 2:05.");
  }
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Alodi" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.72, w: 1.15, h: 0.38, rectRadius: 0.19, fill: { color: H.tint }, line: { color: H.tintLine, width: 0.75 }, objectName: "Live tag" });
    s.addShape(pres.shapes.OVAL, { x: M + 0.16, y: 0.84, w: 0.14, h: 0.14, fill: { color: H.orange }, line: { type: "none" }, objectName: "Live dot" });
    T(s, "LIVE", { x: M + 0.38, y: 0.72, w: 0.72, h: 0.38, fontSize: 11, bold: true, charSpacing: 2, color: H.orange, valign: "middle" });
    T(s, [{ text: "Now, the real thing.", options: { color: H.ink, breakLine: true } }, { text: "Watch one rescue, live.", options: { color: H.orange } }], { x: M, y: 1.45, w: 5.5, h: 2.1, fontSize: 40, bold: true, lineSpacingMultiple: 1.0, valign: "top" });
    T(s, "One shipper’s tap on a real phone. Everything else follows on this screen, in sync.", { x: M, y: 3.75, w: 5.1, h: 1.0, fontSize: 18, color: H.text, valign: "top" });
    s.addImage({ path: A("shipper.png"), x: M, y: 5.25, w: 0.8, h: 0.8, altText: "Shipper", objectName: "Shipper" });
    T(s, [{ text: "In the shipper’s hand", options: { bold: true, color: H.ink, breakLine: true } }, { text: "A real phone, on stage", options: { color: H.muted } }], { x: M + 0.98, y: 5.25, w: 2.3, h: 0.8, fontSize: 14, valign: "middle" });
    s.addImage({ path: A("qr.png"), x: 4.05, y: 5.1, w: 1.1, h: 1.1, altText: "QR code to alodi-ai-system.vercel.app", objectName: "QR code", hyperlink: { url: "https://alodi-ai-system.vercel.app" } });
    T(s, "Scan to try the demo", { x: 5.25, y: 5.25, w: 1.1, h: 0.8, fontSize: 11.5, bold: true, color: H.ink, valign: "middle" });
    const tiles = [
      ["buyer", "Customer’s phone", "The chat and the call arrive", H.blue, H.blueLine],
      ["ops", "SPX dashboard", "The hub sees the rescue move", H.white, H.line],
      [null, "Alodi agent", "Each step as it happens", H.tint, H.tintLine],
    ];
    tiles.forEach(([f, h, d, fill, line], i) => {
      const y = 0.72 + i * 2.0;
      card(s, 6.55, y, 6.18, 1.82, { fill, line, r: 0.18, name: `Screen ${i + 1}` });
      if (f) s.addImage({ path: A(`${f}.png`), x: 6.85, y: y + 0.36, w: 1.1, h: 1.1, altText: h, objectName: `Person ${i + 1}` });
      else s.addImage({ path: A("mark-bars-orange.png"), x: 6.9, y: y + 0.41, w: 1.0, h: 1.0, altText: h, objectName: "Alodi mark" });
      T(s, h, { x: 8.2, y: y + 0.42, w: 4.3, h: 0.5, fontSize: 22, bold: true, color: H.ink });
      T(s, d, { x: 8.2, y: y + 0.94, w: 4.3, h: 0.42, fontSize: 15, color: H.text });
    });
    page(s, 9);
    s.addNotes("Say the line, then switch to the live screen: the shipper's phone drives it, and the customer's phone, the dashboard and the agent follow.");
  }

  /* ---------- 10 · OpenAI ---------- */
  pres.addSection({ title: "Technology" });
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Technology" });
    eyebrow(s, "05", "Tech stack · OpenAI ecosystem");
    title(s, "Every step of the rescue", "is an OpenAI API call.", { w: 7.2, h: 1.2 });
    card(s, 8.2, 0.5, 4.53, 1.6, { fill: H.tint, line: H.tintLine, name: "API cost" });
    T(s, [{ text: "≈ ", options: { color: H.orange } }, { text: "₫", options: { color: H.orange } }, { text: "7.2M", options: { color: H.ink } }], { x: 8.42, y: 0.58, w: 2.2, h: 0.62, fontSize: 28, bold: true });
    T(s, refs("OpenAI API a month, one area [9]"), { x: 10.3, y: 0.68, w: 2.3, h: 0.45, fontSize: 10.5, color: H.text, align: "right" });
    let bx = 8.42;
    [[5.23, H.orange], [1.5, H.navy], [0.47, "7D8FB5"]].forEach(([v, c], i) => {
      const bw = (v / 7.2) * 4.09;
      s.addShape(pres.shapes.RECTANGLE, { x: bx, y: 1.28, w: bw - 0.02, h: 0.2, fill: { color: c }, line: { type: "none" }, objectName: `API share ${i}` });
      bx += bw;
    });
    T(s, "GPT-Live-1 ₫5.2M · Terra ₫1.5M · Luna ₫0.5M", { x: 8.42, y: 1.56, w: 4.1, h: 0.3, fontSize: 11, color: H.text });
    const cols = [
      ["Triage", "Decisions API", "GPT-6 Luna", "Sorts every signal: which case, which window, how sure. Probabilities drive the 0.85 rule.", "/v1/decisions", "Every message · 6.0M tokens a day"],
      ["Voice", "GPT-Live-1", "Live sessions, WebRTC", "Calls the buyer. Listens while it speaks and hands reasoning to the agent.", "/v1/live/sessions", "≤ 134 billed minutes a day"],
      ["Memo", "GPT Transcribe", "Audio transcriptions", "Turns the shipper’s 10-second voice memo into text the agent can read.", "/v1/audio/transcriptions", "Reschedules with a memo"],
      ["Agent", "GPT-6.1 Terra", "Responses API, Agents SDK", "Runs the case under policy and writes the card with Structured Outputs.", "/v1/responses", "≈ 20% of traffic, after triage"],
    ];
    cols.forEach(([tag, n, sub, d, ep, vol], i) => {
      const x = M + i * 3.07, y = 2.3, w = 2.92, h = 3.1, hi = i === 3;
      card(s, x, y, w, h, { fill: hi ? H.tint : H.blue, line: hi ? H.tintLine : H.blueLine, name: `API ${i + 1}` });
      s.addImage({ path: A("openai-ink.png"), x: x + 0.22, y: y + 0.22, w: 0.3, h: 0.3, objectName: `OpenAI logo ${i}` });
      T(s, tag.toUpperCase(), { x: x + 0.62, y: y + 0.26, w: 2, h: 0.22, fontSize: 9, bold: true, charSpacing: 1.5, color: hi ? H.orange : H.navy });
      T(s, n, { x: x + 0.22, y: y + 0.65, w: w - 0.34, h: 0.36, fontSize: 18, bold: true, color: H.ink });
      T(s, sub, { x: x + 0.22, y: y + 1.0, w: w - 0.34, h: 0.26, fontSize: 11.5, color: H.muted });
      T(s, d, { x: x + 0.22, y: y + 1.3, w: w - 0.38, h: 0.95, fontSize: 12.5, color: H.text, valign: "top" });
      s.addShape(pres.shapes.LINE, { x: x + 0.22, y: y + 2.32, w: w - 0.44, h: 0, line: { color: hi ? H.tintLine : H.blueLine, width: 0.75 }, objectName: `API rule ${i}` });
      T(s, ep, { x: x + 0.22, y: y + 2.4, w: w - 0.34, h: 0.26, fontSize: 11.5, bold: true, color: H.orange });
      T(s, vol, { x: x + 0.22, y: y + 2.67, w: w - 0.34, h: 0.26, fontSize: 11, color: H.muted });
      if (i < 3) s.addShape(pres.shapes.LINE, { x: x + w, y: y + 1.5, w: 0.15, h: 0, line: { color: H.navy, width: 1.25, endArrowType: "triangle" }, objectName: `Arrow ${i}` });
    });
    const also = [["Structured Outputs", "the context card schema"], ["Evals", "gate every prompt change"], ["gpt-oss-20b", "offline fallback"], ["Codex", "spec → build → review"]];
    also.forEach(([n, d], i) => {
      const x = M + i * 3.07;
      s.addImage({ path: A("openai-ink.png"), x, y: 5.61, w: 0.22, h: 0.22, objectName: `Also logo ${i}` });
      T(s, n, { x: x + 0.32, y: 5.55, w: 2.55, h: 0.28, fontSize: 13, bold: true, color: H.ink });
      T(s, d, { x: x + 0.32, y: 5.83, w: 2.6, h: 0.26, fontSize: 11.5, color: H.muted });
    });
    T(s, "Demo build: GPT-Live-1, GPT Transcribe, GPT-6.1 Terra. Decisions API, Agents SDK, Evals and gpt-oss-20b are the production design. [10][11]", { x: M, y: 6.3, w: 12.1, h: 0.26, fontSize: 10.5, color: H.muted });
    page(s, 10);
    s.addNotes("Walk it left to right: triage, voice, memo, agent. Every step is an API call behind one policy guard, and the API bill for one area is about ₫7.2M a month in the cost model: GPT-Live-1 ₫5.23M, Terra ₫1.50M, Luna ₫0.47M. Memos are costed on the local model in that figure.");
  }

  /* ---------- 11 · metrics ---------- */
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Technology" });
    eyebrow(s, "06", "Output");
    title(s, "Less money lost.", "A second drop that just works.", { w: 12.1, h: 0.65, fontSize: 28 });
    card(s, M, 1.85, 6.6, 4.7, { fill: H.tint, line: H.tintLine, r: 0.2, name: "Money card" });
    label(s, "Saved a month · one area · projected", M + 0.4, 2.15, 5.5);
    T(s, [{ text: "₫", options: { color: H.orange } }, { text: "187M", options: { color: H.orange } }], { x: M + 0.4, y: 2.42, w: 5.9, h: 1.0, fontSize: 56, bold: true, objectName: "Net saving" });
    s.addChart(pres.charts.BAR, [{ name: "Lost a month (₫M)", labels: ["Lost today", "With Alodi"], values: [473, 286] }], { x: M + 0.3, y: 3.35, w: 6.05, h: 1.75, barDir: "bar", catAxisOrientation: "maxMin", barGapWidthPct: 35, chartColors: ["1F2A44", "F05A00"], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 15, dataLabelFontBold: true, dataLabelColor: "121A2C", dataLabelFormatCode: '"₫"0"M"', catAxisLabelFontSize: 13, catAxisLabelColor: "222B40", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, valAxisMinVal: 0, valAxisMaxVal: 560, showLegend: false, showTitle: false, objectName: "Loss chart", altText: "Monthly loss: ₫473M today, ₫286M with Alodi" });
    T(s, refs("40% cost saving [8][9]"), { x: M + 0.4, y: 5.25, w: 5.8, h: 0.5, fontSize: 22, bold: true, color: H.orange, valign: "middle" });
    T(s, "After running costs, at a best-in-class rescue rate.", { x: M + 0.4, y: 5.75, w: 5.8, h: 0.35, fontSize: 13, color: H.text });
    card(s, 7.35, 1.85, 5.38, 4.7, { fill: H.blue, line: H.blueLine, r: 0.2, name: "Experience card" });
    label(s, "From answer to card · target", 7.75, 2.15, 4.6);
    T(s, "< 10 s", { x: 7.75, y: 2.42, w: 4.7, h: 1.0, fontSize: 56, bold: true, color: H.ink, objectName: "Time to context" });
    s.addChart(pres.charts.BAR, [{ name: "Seconds", labels: ["Answer to card"], values: [10] }], { x: 7.62, y: 3.42, w: 4.95, h: 1.15, barDir: "bar", barGapWidthPct: 25, chartColors: ["1F2A44"], catAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 10, valAxisMajorUnit: 2, valAxisLabelFontSize: 11, valAxisLabelColor: "222B40", valAxisLabelFormatCode: '0" s"', valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, showTitle: false, showValue: false, objectName: "Time chart", altText: "Under ten seconds from the buyer's answer to the card" });
    [["buyer", "Buyer answers", 7.75, "left"], ["next", "Shipper sees the card", 10.1, "right"]].forEach(([f, d, x, al], i) => {
      s.addImage({ path: A(`${f}.png`), x: i ? 11.85 : x, y: 4.72, w: 0.6, h: 0.6, altText: d, objectName: `Person ${i + 1}` });
      T(s, d, { x: i ? 9.6 : x + 0.7, y: 4.72, w: 2.2, h: 0.6, fontSize: 13, bold: true, color: H.ink, align: al, valign: "middle" });
    });
    T(s, refs("No form to fill, no extra step. The next attempt simply knows. [11]"), { x: 7.75, y: 5.62, w: 4.7, h: 0.6, fontSize: 14, color: H.text, valign: "top" });
    page(s, 11);
    s.addNotes("Two numbers. For the carrier: about ₫187M saved a month in one area, projected at a best-in-class rescue rate. For the people: under ten seconds from the buyer's answer to the card on the shipper's phone, our target on stage.");
  }

  /* ---------- 12 · future plan ---------- */
  pres.addSection({ title: "Close" });
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Close" });
    eyebrow(s, "07", "Future plan");
    title(s, "From a stage demo", "to a national rollout.", { w: 6.5, h: 1.4 });
    s.addImage({ data: await rounded("approach-laptop.jpg", 4.6, 1.85, 0.18), x: 8.13, y: 0.55, w: 4.6, h: 1.85, altText: "A developer at a laptop", objectName: "Roadmap photo" });
    const ph = [["Oct 2026", "MVP demo", "Demo screens and a working backend, built at this hackathon [12]"], ["Nov 2026", "Full build", "Connect the demo to the backend, real call audio, ≥ 200 eval samples"], ["Q1 2027", "Shadow mode", "One area, real events, no buyer contact"], ["Q2 2027", "Real channels", "Chat and GPT-Live-1 calls for risky orders"], ["H2 2027", "Region", "5–20 hubs, cost per case on target"], ["2028", "National", "20–100 hubs, break-even"]];
    s.addShape(pres.shapes.LINE, { x: M + 0.1, y: 2.95, w: 12.0, h: 0, line: { color: H.line, width: 1 }, objectName: "Timeline" });
    ph.forEach(([when, h, d], i) => {
      const x = M + i * 2.04, hi = i === 0;
      s.addShape(pres.shapes.OVAL, { x: x + 0.05, y: 2.86, w: 0.18, h: 0.18, fill: { color: hi ? H.orange : H.white }, line: { color: hi ? H.orange : H.grey, width: 1 }, objectName: `Dot ${i}` });
      T(s, when.toUpperCase(), { x: x + 0.32, y: 2.84, w: 1.6, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 1, color: hi ? H.orange : H.muted });
      card(s, x, 3.3, 1.92, 3.1, { fill: hi ? H.tint : H.white, line: hi ? H.tintLine : H.line, name: `Phase ${i}` });
      icon(s, ["dot", "square", "bars", "check", "dot", "check"][i], x + 0.2, 3.5, hi ? "orange" : "navy", hi ? "FFFFFF" : "F1F2F5");
      T(s, h, { x: x + 0.2, y: 4.02, w: 1.6, h: 0.4, fontSize: 14, bold: true, color: H.ink, valign: "top" });
      T(s, refs(d), { x: x + 0.2, y: 4.45, w: 1.62, h: 1.85, fontSize: 13.5, color: H.text, valign: "top" });
    });
    page(s, 12);
    s.addNotes("Next: a full build in November, shadow mode at one area in Q1 2027 with no buyer contact, then controlled real channels, a region and national scale by 2028.");
  }

  /* ---------- 13 · team ---------- */
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Close" });
    eyebrow(s, "08", "Team");
    title(s, "Team Develarper.", "Four people, one agent.", { w: 11.5, h: 0.9 });
    const team = [["nomura-yoshio.jpg", "Nomura Yoshio", "Team Lead · Project Presenter", "Team, demo script, pitch"], ["long-quan-ton.jpg", "Long Quan Ton", "Product Manager · AI Engineer", "Product, research, voice agent"], ["khanh-tuong-huynh.jpg", "Khanh Tuong Huynh", "Applied AI Software Engineer", "Context extractor, ASR, policy guard"], ["thanh-loi-tran.jpg", "Thanh Loi Tran", "Data Engineer · Backend", "Order Context Object, APIs, metrics log"]];
    for (const [i, [f, n, r, d]] of team.entries()) {
      const x = M + i * 3.07, w = 2.92;
      card(s, x, 2.0, w, 4.6, { name: `Member ${i + 1}` });
      s.addImage({ data: await rounded(f, w - 0.4, 2.45, 0.14, "attention"), x: x + 0.2, y: 2.2, w: w - 0.4, h: 2.45, altText: n, objectName: `Portrait ${i + 1}` });
      T(s, n, { x: x + 0.2, y: 4.8, w: w - 0.3, h: 0.34, fontSize: 15, bold: true, color: H.ink });
      T(s, r, { x: x + 0.2, y: 5.14, w: w - 0.3, h: 0.3, fontSize: 11.5, color: H.orange });
      T(s, d, { x: x + 0.2, y: 5.5, w: w - 0.4, h: 0.85, fontSize: 12.5, color: H.text, valign: "top" });
    }
    page(s, 13);
    s.addNotes("One line each: who we are and what each of us built.");
  }

  /* ---------- 14 · thank you ---------- */
  {
    const s = pres.addSlide({ masterName: "Full bleed", sectionTitle: "Close" });
    s.addImage({ path: A("logo-navy.png"), x: M, y: 0.6, w: 1.0, h: 0.43, objectName: "Logo" });
    T(s, "THANK YOU", { x: M, y: 2.2, w: 6, h: 0.3, fontSize: 13, bold: true, charSpacing: 3, color: H.orange });
    T(s, [{ text: "Make the second", options: { color: H.ink, breakLine: true } }, { text: "drop land.", options: { color: H.orange } }], { x: M, y: 2.6, w: 6.4, h: 2.0, fontFace: "Cambria", italic: true, fontSize: 56, lineSpacingMultiple: 0.92 });
    s.addImage({ path: A("qr.png"), x: M, y: 4.62, w: 1.35, h: 1.35, altText: "QR code to alodi-ai-system.vercel.app", objectName: "QR code", hyperlink: { url: "https://alodi-ai-system.vercel.app" } });
    T(s, [{ text: "Scan to try the demo", options: { bold: true, color: H.ink, fontSize: 16, breakLine: true } }, { text: "alodi-ai-system.vercel.app", options: { color: H.muted, fontSize: 12 } }], { x: M + 1.5, y: 4.62, w: 4.3, h: 1.35, valign: "middle" });
    const team = ["nomura-yoshio.jpg", "long-quan-ton.jpg", "khanh-tuong-huynh.jpg", "thanh-loi-tran.jpg"];
    for (const [i, f] of team.entries()) s.addImage({ data: await rounded(f, 0.5, 0.5, 0.25, "attention"), x: M + i * 0.37, y: 6.25, w: 0.5, h: 0.5, objectName: `Avatar ${i + 1}` });
    T(s, [{ text: "Team Develarper", options: { bold: true, color: H.ink, breakLine: true } }, { text: "Sea × OpenAI Regional Codex Hackathon · October 2026", options: { color: H.muted } }], { x: M + 1.8, y: 6.27, w: 4.4, h: 0.48, fontSize: 10.5 });
    s.addImage({ data: await rounded("hcmc-street.jpg", 5.95, 6.5, 0.24, "south"), x: 6.78, y: 0.5, w: 5.95, h: 6.5, altText: "Ho Chi Minh City street", objectName: "Close photo" });
    s.addNotes("Close on the line: make the second drop land. Thank you.");
  }


  /* ---------- 15 · references ---------- */
  pres.addSection({ title: "Appendix" });
  {
    const s = pres.addSlide({ masterName: "Light", sectionTitle: "Appendix" });
    eyebrow(s, "09", "References");
    title(s, "Every number,", "and where it comes from.", { w: 11.5, h: 1.0 });
    const list = [
      ["Team survey: 100 buyers, 12 shippers; placeholder values pending the interview export", "prep/06-survey"],
      ["Shopee Refund Policy §7.1: seller pays return shipping on failed orders", "help.shopee.vn/portal/4/article/77251"],
      ["GHN: ₫40,000 return-fee cap per order since 1 Apr 2025 (₫20,000 express)", "ghn.vn/blogs/tip-ban-hang/tra-hang-shopee-ai-chiu-phi"],
      ["Nguoi Lao Dong, 19 Jul 2025: refusal rates, VECOM and Tran Anh Tung", "tuoitre.vn/nld/nhuc-nhoi-nan-bom-hang-19625071822023801.htm"],
      ["Shopee Help Center 79559: no specific delivery time can be chosen", "help.shopee.vn/portal/4/article/79559"],
      ["Shopee Help Center 79569: 2–3 contacts, reschedule within 5 days", "help.shopee.vn/portal/4/article/79569"],
      ["GHN: shipper earns ₫6,000–8,000 per delivered order", "ghn.vn/blogs/tip-ban-hang/mot-don-hang-shipper-shopee-duoc-bao-nhieu-tien"],
      ["Shipsy: rescue 20–30% industry, 50–65% best-in-class (vendor)", "shipsy.ai/insights/what-is-ndr-non-delivery-report-management"],
      ["Team cost model, PRD §18.8: one area, 20 shippers, 4,000 orders a day", "prep/02-technical/cost-model · alodi-numbers.pdf"],
      ["OpenAI: GPT-Live-1, GPT-6.1 Terra, Decisions API on GPT-6 Luna", "developers.openai.com · openai.com/index/decisions-api · checked 31 Oct 2026"],
      ["Alodi PRD §2.3, §16.7 and §23: stack, output metrics and evaluation targets", "prep/02-technical/PRD.md"],
      ["Alodi PRD §28: release plan", "prep/02-technical/PRD.md"],
    ];
    list.forEach(([t, u], i) => {
      const col = i < 6 ? 0 : 1, row = i % 6;
      const x = M + col * 6.15, y = 2.05 + row * 0.7;
      s.addShape(pres.shapes.LINE, { x, y, w: 5.95, h: 0, line: { color: H.line, width: 0.75 }, objectName: `Ref rule ${i}` });
      T(s, `[${i + 1}]`, { x, y: y + 0.1, w: 0.5, h: 0.26, fontSize: 11, bold: true, color: H.orange });
      T(s, t, { x: x + 0.5, y: y + 0.08, w: 5.45, h: 0.3, fontSize: 10.5, color: H.ink });
      T(s, u, { x: x + 0.5, y: y + 0.38, w: 5.45, h: 0.24, fontSize: 9.5, color: H.muted });
    });
    label(s, "Photos", M, 6.4, 2);
    T(s, "frank mckenna (cover), Lemic302 (slides 3, 14), Samson Vowles (slide 4), Tirza van Dijk (slide 12): CC0 via Wikimedia Commons. SPX hub (slide 5): Team Develarper field visit.", { x: M + 0.9, y: 6.37, w: 11.2, h: 0.3, fontSize: 10, color: H.muted });
    page(s, 15);
    s.addNotes("Appendix: every reference marker in the deck points here.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
