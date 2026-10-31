# Alodi — Design system

The single source of truth for rebuilding every Alodi surface pixel-for-pixel: **landing page**, **demo** (courier app, buyer phone, operations panel, stage) and **CS dashboard**. Nothing here is abbreviated; the appendices contain the complete production stylesheet and the motion/brand components verbatim.

Companion files:
- Original references, copied unedited: `references/LANDING-monad-DESIGN.md` (monad.com), `references/DEMO-UI-shadcn-DESIGN.md` (shadcn/ui), `references/DASHBOARD-ember-DESIGN.md` (Ember Studio).
- Tokens: `tokens/globals.css` (identical to Appendix A), `tokens/tokens.json`.
- Screenshots of the current build: `screenshots/` (landing-00 … landing-26, demo-*, dashboard-*-light/dark, mobile, script).
- Brand: `../04-brand/` · Copy: `LANDING_CONTENT.md`.

---

## 0. Three surfaces, three voices, one brand

| Surface | Routes | Reference | Character | Fonts | Canvas |
| --- | --- | --- | --- | --- | --- |
| **Landing** | `/` | monad.com (`LANDING-monad-DESIGN.md`) | Editorial tech journal on warm parchment: serif headlines that whisper, monospace body that reads like a manual, hairlines and pills, soft colour washes | Source Serif 4 + Geist Mono (+ Geist for long copy) | Parchment `#F6F3F1` |
| **Demo** | `/demo`, `/demo/shipper`, `/demo/buyer`, `/demo/console`, `/script` | shadcn/ui (`DEMO-UI-shadcn-DESIGN.md`) | Clinical, minimal, almost achromatic product UI: 24 px cards, 18 px pills, hairlines, few words, big numbers | Geist only | Canvas `#F5F5F5`, cards `#FFFFFF` |
| **Dashboard** | `/console`, `/metrics` | Ember Studio (`DASHBOARD-ember-DESIGN.md`) | Warm, craft-focused ops tool with italic serif titles; light **and** dark mode | Playfair Display + Source Sans 3 | `#FAF8F6` / dark `#10172A` |

What ties them together: the **Alodi wordmark** (Be Vietnam Pro ExtraBold, orange ring with sound bars), **navy `#1F2A44`** for text, **orange `#F05A00`** as the single accent, and the same **motion language** (rise-out-of-blur reveals, ease `cubic-bezier(0.22, 1, 0.36, 1)`).

### Absolute rules

1. **No citation markers** (`[4]`, superscripts). Use a plain line: `Source: Shopee Help Center, article 79559`.
2. **No JetBrains Mono** or other coding fonts; the only mono face is **Geist Mono**.
3. **No decorative AI-style icons.** Glyphs = Alodi marks (ring + dot / check / sound bars / square) and plain arrows `→ ↓ ›`. Real logos only to identify a real company or technology (sources strip, tech stack).
4. **English** copy everywhere.
5. **Orange is the one primary action per view.** Everything else is navy, ghost or outline.
6. Headings in Source Serif 4 are **weight 400, never bold**.
7. Never pure white as the landing canvas — parchment.

---

## 1. Colour

### 1.1 Brand core

| Token | Hex | Role |
| --- | --- | --- |
| `--color-navy` | `#1F2A44` | Text, wordmark, dark buttons, dark surfaces (Monad’s Off-Black) |
| `--color-ink` | `#121A2C` | Deepest surface: phone call screen, JSON blocks, video, text on orange buttons (Monad’s Ink) |
| `--color-orange` | `#F05A00` | The ring, the one primary CTA, progress, highlights (Monad’s Lake Blue role) |
| `--color-orange-deep` | `#C94B00` | Orange text on light backgrounds (labels, eyebrow tags), hover text |
| `--color-parchment` | `#F6F3F1` | Landing canvas |
| `--color-paper` | `#FBF9F7` | Slightly lighter surface on parchment (cards inside cards, diagram nodes) |

### 1.2 Landing neutrals

| Token | Hex | Role |
| --- | --- | --- |
| `--color-graphite` | `#4A5268` | Secondary text, body copy under headlines |
| `--color-smoke` | `#6B7183` | Muted helper text, source lines, labels |
| `--color-ash` | `#CECAC8` | 1 px hairlines, card borders, dividers |
| `--color-ash-soft` | `#E6E2DF` | Chart gridlines, inner dividers, empty progress tracks |
| `--color-navy-mist` | `#E3E6EE` | Soft navy tint (info boxes, initials avatar) |
| `--color-peach-mist` | `#FBE3D4` | The one coloured panel (tech-stack band), Monad’s Periwinkle role |

### 1.3 Decorative (washes and illustrations only — never UI fills)

| Token | Hex |
| --- | --- |
| `--color-peach` | `#FFB48A` |
| `--color-sky` | `#A0B5EB` |
| `--color-mint` | `#A7FCCD` |
| `--color-gold` | `#ECDA98` |
| coral (inline) | `#FF9473` |

Washes are radial gradients of these at 35–95% opacity, `filter: blur(64px)`, absolutely positioned behind content, `pointer-events: none`.

### 1.4 Status

| Token | Hex | Use |
| --- | --- | --- |
| `--status-good` | `#1F8A5B` | “Measured” badge, confidence ≥ 0.85 |
| `--status-warn` | `#B7791F` | “Projected” badge, low confidence, hand-to-CS |
| `--status-bad` | `#C2410C` | “No answer” text |

### 1.5 Chart palette (validated)

Categorical order — validated with a CVD/contrast checker on parchment and on white:

| Slot | Light | Dark (dashboard) | Meaning in our charts |
| --- | --- | --- | --- |
| 1 | `#F05A00` | `#E45C16` | The thing Alodi targets / current |
| 2 | `#3F5FAE` | `#6A86D2` | Baseline / comparison |
| 3 | `#C9A227` | `#B08D22` | Estimate / third component (always direct-labelled — low contrast) |

Gridlines `#E6E2DF` (landing), `--d-border` (dashboard); tracks `--d-chart-track`.

### 1.6 Demo UI (`.ui` scope)

| Token | Value | Role |
| --- | --- | --- |
| `--ui-canvas` | `#F5F5F5` | Page, ghost buttons, input fill, soft badges |
| `--ui-paper` | `#FFFFFF` | Cards, phone screens |
| `--ui-alt` | `#FAFAFA` | Inner panel, inactive list items |
| `--ui-ink` | `#1F2A44` | Text (replaces shadcn `#0A0A0A`) |
| `--ui-ink-strong` | `#121A2C` | Primary dark button, buyer chat bubble, context card |
| `--ui-muted` | `#737373` | Muted text, labels |
| `--ui-line` | `#E5E5E5` | Hairlines |
| `--ui-accent` | `#F05A00` | Accent button, progress, pulses (replaces shadcn red) |
| `--ui-accent-soft` | `#FFF1E8` | Accent badge |
| `--ui-good` / `--ui-good-soft` | `#15803D` / `#E9F7EE` | Success |
| `--ui-warn` / `--ui-warn-soft` | `#B45309` / `#FDF3E2` | Review / CS |
| `--ui-shadow` | `0 0 0 1px rgba(23,23,23,.05), 0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)` | Card elevation |

### 1.7 Dashboard (`.dash` scope, light / dark via `data-theme`)

| Token | Light | Dark |
| --- | --- | --- |
| `--d-bg` | `#FAF8F6` | `#10172A` |
| `--d-side` | `#F4EFEA` | `#0C1222` |
| `--d-surface` | `#FFFFFF` | `#172038` |
| `--d-tint` | `#FBEFE7` | `#1D2742` |
| `--d-raised` | `#F1E9E2` | `#222D4A` |
| `--d-border` | `#E4DDD6` | `#2B3757` |
| `--d-text` | `#1F2A44` | `#F3EEE8` |
| `--d-text-2` | `#4A5268` | `#C3C8D6` |
| `--d-muted` | `#7A7F8F` | `#8E95AA` |
| `--d-primary` | `#D14E00` | `#FF6A1A` |
| `--d-primary-hover` | `#B34300` | `#FF8540` |
| `--d-primary-soft` | `#FDE3D2` | `#3A2A26` |
| `--d-accent` | `#F59E0B` | `#FBBF24` |
| `--d-good` / `-soft` | `#15803D` / `#DCF3E4` | `#4ADE80` / `#163626` |
| `--d-warn` / `-soft` | `#B45309` / `#FDF0D8` | `#FBBF24` / `#3A2F16` |
| `--d-bad` / `-soft` | `#B91C1C` / `#FDE2E2` | `#F87171` / `#3D1F24` |
| `--d-chart-1/2/3` | `#F05A00` `#3F5FAE` `#C9A227` | `#E45C16` `#6A86D2` `#B08D22` |
| `--d-chart-track` | `#EBE4DD` | `#26314F` |
| `--d-shadow` | `0 4px 16px rgba(31,42,68,.06)` | `0 4px 16px rgba(0,0,0,.35)` |

Theme choice: `localStorage["alodi-dash-theme"]`, default = system `prefers-color-scheme`.

---

## 2. Typography

### 2.1 Fonts (all via `next/font/google`, variables on `<html>`)

| CSS variable | Font | Weights / axes | Used for |
| --- | --- | --- | --- |
| `--font-serif` | **Source Serif 4** | variable `opsz`, normal + italic, weight 400 only in use | Landing headings, big numbers (stand-in for Monad’s Untitled Serif) |
| `--font-mono` | **Geist Mono** | 400, 500 | Landing body, nav, buttons, eyebrows, labels, diagram text, JSON (stand-in for ABC Diatype Mono) |
| `--font-sans` | **Geist** | 400, 500, 600 | Long card copy on landing (`t-body-sans`), all demo UI |
| `--font-display` | **Playfair Display** | 400–600, italic | Dashboard titles and numbers |
| `--font-ui` | **Source Sans 3** | 400, 600 | Dashboard UI |
| `--font-logo` | **Be Vietnam Pro** | 500, 800, `vietnamese` subset | Wordmark (800), taglines and brand-wipe line (800) |

### 2.2 Landing type scale (from monad.com text styles)

| Utility | Family | Size | Line height | Tracking | Notes |
| --- | --- | --- | --- | --- | --- |
| `t-display` | Serif, `opsz 28` | `clamp(48px, 7vw, 80px)` | 1.2 | −0.02em | Hero H1, closing CTA |
| `t-h1` | Serif, `opsz 28` | `clamp(40px, 5vw, 64px)` | 1.2 | −0.02em | Section titles |
| `t-h2` | Serif, `opsz 24` | `clamp(32px, 3.6vw, 48px)` | 1.2 | −0.02em | Sub-section titles, Approach H2, Stack H2 |
| `t-h3` | Serif, `opsz 20` | `clamp(24px, 2.4vw, 32px)` | 1.2 | −0.02em | Card titles, FAQ questions |
| `t-h4` | Serif, `opsz 18` | 24px | 1.2 | −0.02em | Small card titles, chapter titles, names |
| `t-number` | Serif, `opsz 32` | set per use (56–88px) | 1 | −0.03em | Statistic figures, lining numerals |
| `t-eyebrow` | Mono | 16px | 1.3 | +0.05em, UPPERCASE | Section eyebrows (“THE PROBLEM”) |
| `t-label` | Mono | 12px | 1.2 | +0.02em, UPPERCASE | Small labels |
| body | Mono | 16px (lead 18–20px) | 1.35 | −0.02em | Default `body` |
| `t-body-sans` | Geist | 13–16px | 1.4–1.45 | −0.01em | Long text inside cards and diagrams |

Text colours: headlines `--color-navy`; leads `--color-graphite`; meta `--color-smoke`; tags `--color-orange-deep`.

### 2.3 Demo type (shadcn scale)

| Role | Size / weight | Tracking |
| --- | --- | --- |
| Display numbers (“4 s to context”) | 48px / 600 | −0.05em |
| Headings (`ui-h`) | 18–26px / 600 | −0.025em, line height 1.15 |
| Body | 14px / 400 | 0, line height 1.43 |
| Buttons | 14px / 500 (16px on the courier’s big buttons) | 0 |
| Labels (`ui-label`) | 12px / 500 UPPERCASE | +0.05em, colour `--ui-muted` |
| Badges | 12px / 500 | 0 |
| OpenType | `"ss01" on, "cv11" on` | |

### 2.4 Dashboard type (Ember)

| Role | Style |
| --- | --- |
| Page title (`d-title`) | Playfair Display **italic** 400, 40–52px, −0.02em |
| Card title | Playfair italic 24–26px |
| Numbers (`d-num`) | Playfair 400, lining numerals, 30–44px |
| Overline (`d-overline`) | Source Sans 3 600, 11px, +0.08em, UPPERCASE, `--d-muted` |
| Body | Source Sans 3 400, 14–16px |
| Buttons, chips | Source Sans 3 600, 12–14px |

---

## 3. Layout, spacing, radius, elevation

| Item | Landing | Demo | Dashboard |
| --- | --- | --- | --- |
| Max width | 1432px (`container-page`), side padding 16px → 44px ≥ 768px | stage scaled to fit (base 1720×880) | 1240px content, 20–32px padding |
| Base unit | 8px | 4px | 4px |
| Section rhythm | `py-24 md:py-32` (96 → 128px) | — | 24–32px between blocks |
| Card radius | 16px (Monad cards); team photos 20px; tech band 32px | cards 24px, nested 18–20px, pills/buttons 18px | cards 12px, buttons 8px, chips/pills 9999px |
| Card padding | 24–40px | 20px (cards), 16–20px (phone) | 20–24px |
| Borders | 1px `--color-ash` | 1px `--ui-line` | 1px `--d-border` |
| Shadows | **none** on cards (Monad); only phones and floating chips | `--ui-shadow` | `--d-shadow` on hover / slide-over |
| Buttons | pill 100px radius, 48px tall | 36px (44–56px on phone), 18px radius | 40px (32px small), 8px radius |

Breakpoints (Tailwind): `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Mobile gutter 16px; no horizontal page scroll at 390px.

---

## 4. Landing components

### 4.1 Buttons (`btn` + variant)

| Variant | Spec |
| --- | --- |
| Base `btn` | inline-flex, gap 12px, **48px** tall, padding 0 32px, radius 100px, Geist Mono **18px**, UPPERCASE, tracking +0.01em, transitions 200ms on bg/colour/border |
| `btn-primary` | bg orange `#F05A00`, text ink `#121A2C`, hover `#FF6A12` — **one per view** |
| `btn-dark` | bg navy, text parchment, hover ink |
| `btn-ghost` | 1px ash border, navy text, hover border navy |
| `btn-sm` | 36px tall, padding 0 18px, 13px, gap 8px |
| Trailing glyph | chevron SVG 10×14, stroke 1.8, round caps (`Chevron`) |

### 4.2 Pill (`pill`)
inline-flex, gap 10px, 1px navy border, radius 9999px, padding 8×20, Geist Mono 15px UPPERCASE, bg parchment. Used for diagram nodes and tags.

### 4.3 Card (`card`)
1px ash border, radius 16px, padding 40px (24px under 640px), **no shadow**, transparent or parchment fill.

### 4.4 Eyebrow
`t-eyebrow` in navy (or smoke), placed 24px above an H1/H2.

### 4.5 Source note
`<p class="text-[12px] text-smoke">Source: …</p>` — always plain text, never a marker.

### 4.6 Brand marks (`Mark`)
16×16 viewBox: circle r 6.2, stroke 1.6, `currentColor`; inner: **dot** r 2 · **check** path `M5.4 8.2l1.8 1.8 3.4-3.6` · **square** 4×4 rx .8 · **wave** three bars (1.3 wide; heights 2.2 / 4.2 / 2.2). Sizes 12–32px.

### 4.7 Wordmark
“al” + ring + “di”: Be Vietnam Pro 800, tracking −0.045em; ring = 24-viewBox circle r 8.6, stroke 5.4 orange, three bars (x 8.55 / 11.25 / 13.95, widths 1.5, heights 3.5 / 6.2 / 3.5, rx .75) in the text colour; ring box width 0.66em, `translate-y 0.07em`, margin 0.02em. Nav size 34px, dashboard 28px, demo 24px. Outlined SVGs: `../04-brand/logo/`.

### 4.8 Atmospheric wash (`.wash`)
`position:absolute; border-radius:9999px; filter: blur(64px); pointer-events:none` + inline `radial-gradient(circle, <colour>, transparent 70%)`. Typical sizes 260–520px, opacity 0.5–0.9.

### 4.9 Real logos
- **Source logos**: height 34px (26px when width/height > 5), full colour; VECOM drawn as a navy silhouette through `mask-image` (its artwork is white); Shopee = simple-icons glyph + “Shopee” word in its brand colour, Be Vietnam Pro 800. Hover: `scale(1.05)`.
- **Tech logos**: simple-icons path in brand colour; colours `#000000 #1C3C3C #231F20 #191919` are replaced by navy.

---

## 5. Charts (landing + dashboard)

All charts are hand-built SVG, no chart library.

| Spec | Value |
| --- | --- |
| Bars | ≤ 24px thick, 4px rounded data end, square at the baseline, grow from the baseline (1.1–1.2s, ease above) when scrolled into view |
| Stacked segments | 2px surface gap between segments |
| Lines | 2–2.5px, round joins; end marker r 4.5–5 with a 2px surface ring; area wash at ~10% opacity |
| Gridlines | 1px, `--color-ash-soft` / `--d-border`, solid |
| Labels | Geist Mono 11–13px (landing) / Source Sans 11–12px (dashboard), text colours only — never the series colour |
| Direct labels | value at bar tip / line end; legend whenever there are ≥ 2 series |
| Tooltips | hover crosshair on lines, per-mark tooltip on bars: bordered card, 12px |
| Notes | every chart card ends with a note line + `Source:` line |

Landing chart cards: 1px ash border, 16px radius, padding 24–32px, title `t-h4`, chart, then a hairline and the note/source.

---

## 6. Motion system

### 6.1 Principles
- One easing for everything: **`cubic-bezier(0.22, 1, 0.36, 1)`** (`EASE`). Clip reveals use `cubic-bezier(0.76, 0, 0.24, 1)`.
- Things **rise out of a blur**: `opacity 0 → 1`, `y +24…40px → 0`, `blur 6–10px → 0`.
- Scroll drives meaning (Approach chapters, hero parallax); time drives liveness (pipeline chips, orbit, pulses).
- Everything respects `prefers-reduced-motion` (all animations collapse to ~0ms; reveals start visible).

### 6.2 Building blocks (code in Appendix C)

| Component | Behaviour | Parameters |
| --- | --- | --- |
| `SmoothScroll` | Lenis smooth scrolling on the landing page; keeps `position: sticky` working | `duration 1.15`, easing `1 − (1 − t)^4`, anchors offset −96px |
| `ScrollProgress` | 2px orange bar fixed at the top, `scaleX` = page progress | spring stiffness 140, damping 30, mass 0.3 |
| `Reveal` | Wrapper: in view once → rise from blur | `y 28`, blur 8px, duration 0.9s, viewport margin −70px, optional `delay` |
| `RevealText` | Headline word-by-word: each word rises from `y 105%`, `rotate 4°` out of its own overflow mask | stagger 0.045s (0.03 long, 0.06–0.07 display), duration 0.9s |
| `Figure` | Counts every number inside a string (“₫40,000”, “8–12%”, “+34.75%”) up from 0 | 1.6s, ease `[0.16, 1, 0.3, 1]`, en-US formatting |
| `useGrow` | 0 → 1 progress when an SVG enters view (chart growth) | 1.2s |
| `Parallax` | Drifts children ±amount px across their pass | default 60px |
| `VelocityMarquee` | Infinite marquee; speed follows scroll velocity, direction flips with scroll direction, slows to 15% on hover | speed 34–42 px/s |

### 6.3 Keyframes (CSS, Appendix A)

| Class | Animation |
| --- | --- |
| `.pulse-ring` | scale 1 → 2.2, opacity .55 → 0, 1.8s ease-out ∞ — incoming call, active step |
| `.blink` | opacity 1 ↔ .25, 1.2s — “live” dots |
| `.wave-bar` | `scaleY .25 ↔ 1`, 0.9s, staggered by `(i % 7) × 0.11s` — voice waveform |
| `.glow-breathe` | opacity .75 ↔ 1, scale 1 ↔ 1.06, 4s — hero hub glow |
| `.ring-spin` | rotate 360°, 18s linear — dotted ring around the hub |
| `orbit-spin` | rotate 360° (tech orbit, counter-rotated chips) |
| `.flow-dash` | dashed orange connector whose dashes travel down, 0.8s |
| `.agent-pulse` | dot scale .8 ↔ 1.3, opacity .25 ↔ 1, 2.5s, staggered 0.5s |
| `.orch-sheen` | white gradient sweep across the agent block, 3.2s |
| `marquee` | CSS fallback marquee, 48s linear |

### 6.4 Page transitions (React `<ViewTransition>`, Next 16)

| Class | Effect |
| --- | --- |
| `nav-forward` / `nav-back` | old page fades + slides 48px out (160ms / 420ms), new fades in after 140ms and slides 48px in (520ms) |
| `page-rise` | new page rises 24px from 0.985 scale and blur (320/600ms) |
| `morph` | shared element morph, 620ms, blur in the middle — phones and the ops panel keep their identity between `/demo` and the single-screen views (`name="phone-courier" | "phone-buyer" | "panel-console"`) |
| anchors | `dash-side` (dashboard sidebar) and `demo-nav` don’t move during transitions |
| theme switch | `document.startViewTransition` + circular `clip-path` from the clicked toggle, 700ms |

Dashboard sidebar links pass `transitionTypes={[i > current ? "nav-forward" : "nav-back"]}`.

---

## 7. Landing page — section by section

Copy for every section: `LANDING_CONTENT.md`. Screenshots: `screenshots/landing-*.png`. Order:

### 7.0 Announcement bar
Black `#000`, min-height 62px, centred 16px parchment text; white pill button “READ THE SCRIPT” (12px uppercase, hidden < 640px); × close at right 24px. Dismiss hides it for the session.

### 7.1 Navigation (sticky)
Height **120px**, shrinking to **84px** after 24px of scroll (500ms, EASE), background turns `parchment/90` + `backdrop-blur-md`. Left: wordmark 34px + links (Geist Mono 18px uppercase, gap 32px, visible ≥ 1280px, hover orange-deep). Right: `btn btn-dark` “Dashboard ›” + `btn btn-primary` “Watch demo ›” (≥ 768px). Mobile: outlined “MENU/CLOSE” pill opening a stacked list + primary button.

### 7.2 Hero (`pt-16 md:pt-24`)
- Centred column max 900px: H1 `t-display` with `RevealText` (stagger 0.06), lead 18→20px graphite max 580px, two buttons (dark + ghost) 44px below.
- **Scroll parallax**: text moves `y 0 → −90` and fades `1 → 0` over the first 55% of the hero; diagram scales `1 → 0.9` and moves `y 0 → 60`.
- **Pipeline diagram** (SVG 1440×500, Geist Mono): 7 input pills on the left (x ≤ 276, y = 44 + i·64, 40px tall, navy border, brand mark + uppercase label 15px) → curved lines into the hub → 5 output pills on the right (x 1160, y = 56 + i·90, peach fill `#FDEEE4`). Lines: ash base + an orange (inputs) / navy (outputs) highlight segment. **Chips travel along every line** (`animateMotion` 3.8–6.4s, opacity in/out) labelled EVENT / TAP A / TAP B / REFUSED / SLOTS / MEMO / CONTEXT.
- **Hub** at (720, 236): radial glow (orange → gold, `glow-breathe`), four 78px rounded diamonds (peach gradient, white stroke) labelled CHAT / CALL / EXTRACT / GUARD that light up in turn every 4s, a central paper diamond with a dotted spinning ring and the Alodi mark (orange ring + navy bars).
- Mobile (< 768px): stacked pills → navy agent card → peach output pills.

### 7.3 Sources strip
Container with 1px ash top and bottom borders, `py 36px`; grid `220px | 1fr`: eyebrow “BUILT ON PUBLIC FIGURES FROM” (smoke) vertically centred with a `VelocityMarquee` of colour logos (margins 36–48px, mask fading 8% at both ends).

### 7.4 Problem (`#problem`)
- Eyebrow + H1 (`RevealText`, stagger 0.03).
- **Four stat columns**: top border, 1/2/4 columns (sm/xl), vertical hairlines between columns; each: orange-deep eyebrow tag → `t-number` 60–88px with `Figure` count-up (nowrap) → 16px graphite text (max 320px) → source line. Staggered reveals 0.08s.
- **Four chart cards** in a 2×2 grid (gap 16px): refusal range bars, depot day split, stacked daily loss, GMV columns + two side figures (+34.75% orange-deep, ≈ 13 callers).
- **Three supporting facts**: one bordered 16px-radius container split into 3 columns by 1px gaps; each `t-h4` + text + source.

### 7.5 Approach (`#approach`) — pinned scrollytelling
- Section height **340vh** (desktop); inner `sticky top-84px`, height `100dvh − 84px`; grid `0.9fr | 1.1fr`, gap 64px.
- Left: eyebrow, H2 (`RevealText`), three chapter buttons. Active chapter: paper card with a 1px navy/10% ring, title `t-h4`, body expands (grid-rows 0fr → 1fr, 500ms) and a 2px progress line fills with the chapter’s scroll progress; inactive chapters at 45% opacity. Clicking jumps the scroll to the chapter.
- Right: one 620px stage card (paper, ash border, 18px radius, peach wash) whose content cross-fades between chapters (blur 10 → 0, y 24 → 0, 0.55s):
  1. **Frame** — three parchment stat tiles (2–3 / 5 / 40K), two timelines (“Day 0 · rescue cycle 1”, “Days 1–5 · still inside Shopee’s window”) whose navy fill and markers appear with scroll progress; source line.
  2. **Boundary** — two lanes: peach “AGENT ACTS” with orange-ringed cards, navy “HUMAN DECIDES” with translucent cards; cards fly in from the opposite side as progress grows; an orange vertical line between lanes with a glowing dot travelling up and down (5s).
  3. **Evals** — 300px loop circle (dashed ash, orange arc = progress, orange dot orbiting 3.2s) with four step pills around it and the held-out F1 in the centre (64px serif, re-animates each round v0…v6); a small line chart beside it.
- Mobile/tablet: no pinning; the three stages stack at 560px each.

### 7.6 What Alodi is (`#product`)
- Grid `1.1fr | 1fr`: eyebrow + H1 left, lead 20px right (bottom-aligned).
- **Architecture diagram — rebuild it from `../02-technical/diagrams/alodi-architecture.pdf`** (three columns, eight numbered steps), as an HTML/SVG component in a paper/70 card (16px radius, ash border, padding 24px):
  - **Column headers** (centred, 15px semibold, 2px underline): “SPX systems and data” (navy underline) · “Processing flow · orchestrated by the Alodi Agent” (orange) · “External services” (purple `#9B3FB5`).
  - **Left column** boxes (navy 1.5px border, 10px radius, white): Route planner SPX · OMS / Order DB SPX · Courier app · Timers + job queue · Recording storage · Alodi DB · CS dashboard (red border `#C0392B`). Each box: title 14px semibold, step tag top-right (`step 3 · 4 · 7`, coloured like its edge), then two rows **Demo** (orange-deep label) / **Production** (blue `#3F5FAE` label), optional grey note line.
  - **Centre column**: eight step cards with a numbered orange circle (step 8 = red), peach fill `#FFF4EC` and orange border; step 4 is blue `#EAF0FB`; decision diamonds in grey `#F3F4F6` (“Buyer replied before cut-off?”, “Delivery result?”, “Redelivered twice?”); the three morning outcomes as small cards; “Done” in green; “2-minute undo” in blue; “Button C” small red card.
  - **Right column** boxes (purple or teal border): OpenAI LLM · Shopee Chat / Zalo OA · AI call centre + TTS · ASR · AssemblyAI · PII masking · JSON extraction; a “Buyer” person node on the far right linked to chat and call.
  - **Edges** with the diagram’s legend colours: dark navy = processing flow / SPX, blue = courier app and Alodi data, purple = contact channels + LLM, teal = speech + extraction, red = CS. Animate a small dot along the main vertical flow (1 → 8) on a 6 s loop; highlight edges on hover of a box.
  - Footer note: *Demo = what we build for competition day on fake data. Production = when plugged into SPX. “step” in a box’s corner lists the flow steps that use it.*
  - Mobile: collapse to the eight centre steps as a vertical list; each step expands to show its Demo/Production components.
- The current site still shows the earlier C4 layer view (one agent + tools). Its agent block is accurate; the layer layout is superseded by this three-column diagram.

### 7.7 How Alodi works (`#how-it-works`) — Monad bento
- Grid `1fr | 2fr`, gap 16px. Left tall card (row-span 3), right three wide cards (min 310px, grid `1fr | 1.1fr`, each with a large wash behind the illustration).
- **One-Tap Rescue Pipeline** (tall): a vertical chain of white blocks (220px, 10px radius) joined by navy “handles” and condition pills (“↳ Always”, “Silent 60 min”, “Answered”), ending in an OR split into Auto-apply / Human review. A ticker (1.1s) highlights one element at a time with an orange 2px ring + soft glow. Coral and sky washes behind.
- **In-Flight Context Extraction**: white card with a quote, a divider “EXTRACTOR · STRICT JSON”, and three key/value rows whose values fade in and confidence bars fill one by one (ticker 1.2s). Mint → sky wash.
- **Rule-Based Escalation**: condition pills (Always / AND / OR) above a white “Policy guard rules” card listing 4 rules with key chips. Sky → mint wash.
- **Deploy Your Way**: three overlapping white cards (Demo / Pilot / On-prem) that drop into place with a 26px step, orange ring icon, green check, three tags each. Peach → gold wash.

### 7.8 Why Alodi (`#features`)
2-column grid of 8 cards: 16px radius, **navy/80 border**, padding 32–40px; a colour wash bloom top-left (per-card tint: orange 35%, sky, gold, coral, mint…); a 32px brand mark (dot / square / check rotating); title `t-h3`; body 18px graphite mono.

### 7.9 Expected outcomes (`#metrics`)
Eyebrow, H1, lead 20px. Four rows separated by ash hairlines: grid `1fr | 1.4fr | auto` — problem (label + text), metric `t-h2` + status pill (green “MEASURED” / amber “PROJECTED”, 11px uppercase bordered) + description, target `t-number` 48–64px right-aligned + note.

### 7.10 Tech stack (`#tech`)
- A **peach-mist band** (32px radius, inset 4–8px from the viewport edges) with a sky wash.
- Grid `1fr | 1.05fr`: left eyebrow, H2, lead, legend (inner orbit · demo / outer orbit · production), `btn btn-dark` “Explore the demo”.
- Right: **orbit** 540px (scaled 0.85 on tablet, 0.64 on phone): outer dashed ring r 236 (8 production logos, 90s), inner r 146 (6 demo logos, 60s, reverse); chips 52–56px white circles with shadow, counter-rotated so logos stay upright, scale 1.1 on hover with a navy name tooltip; centre: 112px navy circle with the Alodi mark + pulse ring; orange glow behind. Hovering pauses all rotation. Entrance: `scale .9 → 1`, `rotate −8° → 0`, 1.2s.
- Below: two `VelocityMarquee` rows of logo cards (290px, 14px radius; light row = demo, navy row = production), lift −4px + orange ring on hover.

### 7.11 Roadmap (`#roadmap`)
H1 + five cards in a row (2 cols md, 5 cols xl): `t-number` 56px index, date tag top-right (first one orange-deep), title `t-h4`, body Geist 15px.

### 7.12 Competitors (`#competitors`)
Eyebrow + H1; a horizontally scrollable table (min 1120px) in a 16px bordered container: Alodi column header is navy with the white wordmark; Alodi cells peach `#FDEEE4`; “Not disclosed” cells in smoke; row labels 12px uppercase smoke; competitor names `t-h4` 22px. Source line below.

### 7.13 Team (`#team`)
Eyebrow + H1 “Team Develarper”, lead right. 4 columns (2 on sm): portrait **4:5**, 20px radius, full colour, `scale 1.04 → 1` on hover (900ms); **clip-path reveal** from the bottom (`inset(100% 0 0 0) → inset(0)`, 1.1s, staggered 0.1s, ease `[0.76,0,0.24,1]`). Caption under the photo: name `t-h4` 26px, then the two roles in 13px uppercase orange-deep, a hairline below. Initials fallback if the image fails.

### 7.14 FAQ (`#faq`)
H1, then rows separated by ash bottom borders, padding 40px vertical: question `t-h3`, a down-arrow SVG (22px) rotating 180° when open; answer 18px graphite, max 860px, height animates (0.3s).

### 7.15 Closing CTA
Centred: large coral → sky elliptical wash, `t-display` “Make the second drop land.” (stagger 0.07), lead 20px, dark + primary buttons.

### 7.16 Sources and footer
Sources: eyebrow + 2-column unnumbered list, Geist 14px, links underlined with an ash decoration that turns orange on hover. Footer: grid `1.6fr 1fr 1fr 1fr` (logo + one-liner, Project, Demo, Team), bottom row © line + “Demo data is simulated.”

---

## 8. Demo — product UI

Screenshots: `screenshots/demo-*.png`.

### 8.1 Components (`.ui` scope)

| Class | Spec |
| --- | --- |
| `.ui-card` | white, 1px `#E5E5E5`, **24px** radius, `--ui-shadow` |
| `.ui-btn` | 36px, padding 0 14px, **18px** radius, 14px / 500, active `scale(.97)` |
| `.ui-btn-primary` | `#121A2C` bg, `#FAFAFA` text |
| `.ui-btn-accent` | orange bg, white text (the one accent action) |
| `.ui-btn-ghost` | `#F5F5F5` bg |
| `.ui-btn-outline` | white bg, 1px hairline |
| `.ui-badge` | 2×8 padding, 18px radius, 12px / 500 — variants solid, soft, outline, accent, good, warn |
| `.ui-label` | 12px / 500 uppercase +0.05em muted |
| `.ui-h` | 600, −0.025em, line height 1.15 |
| Hint ring | absolutely positioned 2px orange border at `-inset-[5px]`, `animate-pulse` — marks the control the presenter should press |

### 8.2 Phone frame
340×704, outer radius 52px, bezel `#0F1424` 9px, inner radius 44px white; status bar 48px (time from the demo clock, centred 98×28 island, “5G” + battery), dark text or white text when the call screen is up; shadow `0 40px 80px -40px rgba(18,26,44,.55)`.

### 8.3 Courier app
Header: initials avatar, name + route, day badge, orange progress bar with “7/24”. Screens cross-fade (`y 14 → 0`, blur 4 → 0, 0.35s):
- **Route** — three stop cards (current one with navy border, done ones at 45%); on day 2 the current stop shows the dark context card and a full-width “Delivered” primary button.
- **Failed attempt** — order card (name, “COD” badge, address, red “No answer, twice”), then three 56px buttons at the bottom: **No answer** (accent), **Rescheduled** (primary), **Refused** (outline); they stagger in.
- **Waiting** — centred pulsing Alodi mark, “Alodi is on it / Head to your next stop.”, progress badges Chat · Call 1 · Call 2 (solid when done), “AI call 1 in **58 min**”.
- **Memo** — “Repeat what they said / 10 seconds”, orange waveform, 96px orange record button with pulse, transcript bubble.
- **Context card** — `#121A2C` 20px-radius card: source line + white mark, window 26px / 600, Drop-off and Backup rows (white/55 labels).
- **Delivered** — 96px ring with an animated check (spring), “Delivered”, “Attempt 2 · 17:22”.
- **Handoff** — warn badge “With CS”, “Sent to support”.

### 8.4 Buyer phone
Header: navy circle with the white mark, “Delivery Assistant” + item, “Auto” badge. Chat on `#FAFAFA`: agent bubbles white with shadow (bottom-left corner 6px), buyer bubbles `#121A2C` white text (bottom-right 6px), quick replies as outline pills, timestamps 11px, system lines as grey centred chips. Composer: grey pill + orange round send button.
**Call screen** (slides up 6%, 0.4s): `#0F1424` full screen, 96px circle with the mark and a pulse ring while ringing, “Delivery Assistant”, “Verified caller” → live timer, orange waveform, **only the latest line** of the conversation (AI white/85, buyer peach `#FFB48A`) cross-fading; bottom: red End/Decline circle and green Answer circle (pulsing when the presenter should press), labels under them.

### 8.5 Operations panel
White `.ui-card`: tracking number 12px muted, buyer name 22px / 600, stage badge right. **Flow rail**: six 32px numbered circles (Tap · Chat · Call/Memo · Extract · Decide · Delivered) on a line that fills navy; current = orange with pulse, done = navy with a check. Body on `#FAFAFA` with 20px padding:
- warn bar with the action button when CS must act;
- **Now** card (big number e.g. “58 min to go” / “4 s to context”, or a 22px status line) and **Extracted** card (label, value, confidence bar green ≥ .85 / amber below, decision badge);
- **Activity** (last 4 events: coloured dot, time, text);
- **Order context · vN** accordion with the JSON in Geist Mono on `#121A2C`.

### 8.6 Stage and chrome
- **Nav** (64px): wordmark 24px + “Demo” outline badge; centred segmented tabs (Stage · Courier · Buyer · Ops) in a `#ECECEC` 18px container with a sliding white active pill (`layoutId`, spring 420/34); right: “Dashboard” outline, “Script” ghost.
- **Stage**: three columns (courier phone, buyer phone, ops panel) labelled 13px muted, scaled to fit (`useFit`, base 1720×880), entrance staggered 0.12s from blur 10px, `y 40`.
- **Dock** (floating, bottom centre, 24px radius, white/90 blur, shadow): scenario select, Reset (ghost), **Play/Pause/Replay** (accent, 96px min), Next → (ghost), clock 20px / 600 + day + “fast-forward” badge, Options (outline) opening a card with switches Auto-tap · Sound · Captions and speed 1× / 1.5× / 2×. Above the dock a dark caption pill shows the current step or the waiting hint with a blinking dot.
- Keyboard: Space play/pause, → next step, R reset, H hides chrome on single views.
- Single views (`/demo/shipper|buyer|console`) centre one element with the same chrome. In the current build tabs sync via `BroadcastChannel("alodi-demo")` (one browser only); the live three-device demo replaces this with server WebSockets — see §8A.

### 8.7 Brand wipe (intro scene)
Runs once per area per session (`demo`, `dash`): navy full-screen layer; the orange ring with bars appears and pulses, expands to fill the frame (1.7s, keyframes 44px → 260px → 2600px with a growing border), the tagline appears in ink on orange (Be Vietnam Pro 800, `clamp(22px, 3vw, 34px)`), then the page is revealed through a closing circle (`clip-path circle(150%) → circle(0%)`, 0.7s, `[0.76,0,0.24,1]`). Click to skip. Taglines: demo “One call. Delivered.”, dashboard “Operations, live.”. Code: Appendix D.

---

## 8A. Live demo — three devices

The stage demo runs on real hardware: **phone** = courier app, **iPad** = carrier ops dashboard, **laptop** = buyer phone. Setup: `../02-technical/PRD.md` §19. All three use the demo UI tokens (§1.6) except the iPad, which uses the dashboard system (§1.7, §9) because it plays “the carrier’s dashboard”.

### 8A.1 Phone · `/courier` (portrait, full-screen PWA)
- No phone frame: the real device is the frame. Respect safe areas (`env(safe-area-inset-*)`), `100dvh`, `viewport-fit=cover`, theme colour white.
- Same screens as §8.3, scaled up for a hand: base font 16px, buttons **56–64px tall**, 20px radius; the three outcome buttons fill the bottom third (No answer = accent, Rescheduled = primary, Refused = outline).
- After a tap: a full-width **undo bar** with a 2:00 countdown ring and an “Undo” button; when it ends, the screen moves to “Alodi is on it”.
- Memo: press-and-hold record button 96px; waveform; upload progress; transcript bubble.
- Context card arrival: slide up from the bottom (spring), light haptic-style scale pulse, card stays pinned on the stop.
- Header shows a small connection dot (green = live, amber = reconnecting).
- Manifest: name “Alodi Courier”, `display: standalone`, `orientation: portrait`, icon = orange app icon.

### 8A.2 iPad · `/ops` (landscape 1180 × 820 base, scales to 1366 × 1024)
Dashboard tokens (§1.7), light theme by default (projector-friendly), dark available.
- **Top bar** 64px: wordmark, “Carrier ops · Binh Thanh depot · live”, demo clock (Playfair numbers), connection dot.
- **Left 40% — Case timeline**: the eight architecture steps as a vertical rail; each step lights up when reached (orange = now, navy = done) with a time stamp; decision points show which branch was taken (e.g. “No reply → as planned”, “A · No answer”); pending event shows a circular 2:00 undo ring; timers show a countdown (“AI call 1 in 58:12”) with the policy-guard check line beneath, prefixed by the Alodi check mark (“11:04 inside 08:00–20:30 · OK”).
- **Right 60% — stacked live cards** (12px radius, each slides in from the right as it happens):
  1. **Conversation** — chat messages and, during a call, the live transcript lines with speaker labels and an audio level meter.
  2. **Extraction** — fields fill one by one with confidence bars (green ≥ 0.85, amber below) and the decision chip (“Auto-applied” / “Confirm in chat” / “Needs CS”).
  3. **Context card** — the exact card pushed to the courier, with “Pushed 11:05 · attempt 1 of 2”.
  4. **CS queue** (step 8) — when a case escalates: reason, suggested label, large touch buttons **Approve return** / **Call buyer** / **Claim** (48px).
- **Bottom strip**: today’s KPIs (orders loaded, windows asked, rescues in progress, cases with CS).
- Touch-first: no hover-only information; all targets ≥ 44px; swipe-free (Guided Access).
- Manifest: “Alodi Ops”, `orientation: landscape`.

### 8A.3 Laptop · `/buyer` (projected)
- The buyer phone from §8.4, centred on a parchment/canvas background at ~1.25× scale so it reads on a projector; a small caption above it: “Buyer’s phone”.
- Chat: the morning question shows **four window buttons + “Can’t receive today”**; the buyer actor taps or types.
- Call: incoming-call screen fills the phone; **Answer** starts the mic stream; the waveform reacts to the real voice level; the latest line shows as subtitles; End/Decline buttons work.
- A thin mic-level meter and connection dot outside the phone frame (for the operator, not the audience).

### 8A.4 Laptop second display · `/control`
Demo UI tokens. Cards: Scenario (select + Reset), Clock (big time, speed 1× / 60× / 600×, pause, “Jump to next timer”, “Jump to next day 17:20”), Devices (phone / iPad / laptop with green-amber-red dots and last ping), Modes (Auto-buyer, Offline replay), QR codes for `/courier` and `/ops`. Keyboard: Space, →, R.

### 8A.5 Motion across devices
When an event happens, the **same moment** should be visible on every screen: phone tap → iPad timeline step pulses orange within ~200 ms → laptop chat bubble pops in. Use the same EASE and 0.3–0.45 s durations everywhere; avoid long entrance animations on the iPad so the audience never waits for a card.

---

## 9. Dashboard

Screenshots: `screenshots/dashboard-*-light.png`, `-dark.png`.

- **Shell**: sidebar 256px (`--d-side`, right border): wordmark 28px, “Operations · Binh Thanh depot”, nav items 15px (active: primary-soft bg, primary text, 3px right accent bar), bottom: full-width primary “Open live demo”, Settings, Support. Header 72px: search pill (300px), theme toggle (Light/Dark segmented, active = primary), amber “23 to review” chip, 36px initials avatar. Content max 1240px.
- **Overview**: italic title 40–52px + 16px subline; **4 KPI tiles** (`--d-tint`, 12px radius): label, chip (neutral / primary “Live” / good / warn), number 40px with `CountUp`, 7-day spark bars (today solid, older faded); **Rescue rate over time** card (smooth line, area wash, baseline line at 25%, Daily/Weekly chips, hover crosshair + tooltip); **Failure reasons** tint card (donut with 2px gaps, centre number, hover enlarges a segment, legend rows); **Live exception queue** card: underline tabs (All, Needs a person, Agent rescuing, Card ready, Closed + counts), table (tracking ID, buyer name in Playfair 17px + district, reason, status chip, courier avatar + name, italic time, 4px progress bar + %), rows stagger in (0.035s), selected row has a 2px left primary bar; the live demo case is pinned first with a blinking dot.
- **Case slide-over**: 460px from the right (spring 320/34) over a blurred 20% black backdrop: status chip, italic name 28px, meta line, six-step rail, guard chips, warn action box, dark context card, Time-to-context tiles, extraction table, JSON block, audit log.
- **Metrics**: same shell; 4 tiles (Time-to-context, Extraction F1, Safe autonomy, Boundary breaches); cards *Extraction accuracy* (paired bars v0 vs v6), *Optimisation curve* (two lines, crosshair), *Time-to-context* (three tiles + F1 by source table), *Safe autonomy* (six rows), *Money* (five sliders + net figure on tint, assumptions note), each with a Measured/Projected chip.
- **Floating action**: 56px orange circle bottom-right linking to the demo.

---

## 10. Accessibility and responsiveness

- Body text ≥ 14px (demo), ≥ 16px (landing); muted text never lighter than `#737373` on white / `#6B7183` on parchment.
- Every chart has an `aria-label` summary; colour is never the only signal (labels, legends, badges with words).
- Animated headlines keep the full sentence in `aria-label`.
- `prefers-reduced-motion`: all keyframes and view transitions to ~0ms; reveals render final state.
- Mobile 390px: no horizontal scroll; diagram swaps to stacked pills; Approach unpins; orbit scales; tables scroll inside their container.

---

## 11. Do / don’t

| Do | Don’t |
| --- | --- |
| Serif 400 headlines with −0.02em tracking | Bold serif headlines |
| One orange action per view | Orange decoration everywhere |
| Hairlines and tonal contrast on the landing | Drop shadows on landing cards |
| Plain “Source:” lines | `[1]` markers or superscripts |
| Real logos only for real companies/technologies | Generic AI icons (sparkles, robots, brains) |
| Label mock/projected numbers | Present mock dashboard numbers as results |
| Geist Mono for mono text | JetBrains Mono, Fira Code, Menlo |
| Big numbers, few words in the demo | Paragraphs inside phone screens |

---

## 12. Implementation checklist

1. `npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir`, then `npm i motion lenis simple-icons`.
2. Replace `src/app/globals.css` with Appendix A; `layout.tsx` with Appendix B.
3. Add `src/components/landing/motion.tsx` (Appendix C), `velocity-marquee.tsx` (Appendix E), `src/components/site/brand.tsx` (Appendix F), `brand-wipe.tsx` (Appendix D).
4. Copy `../04-brand/png/app-icon/alodi-app-icon-orange-512.png` → `src/app/icon.png`, `…-180.png` → `src/app/apple-icon.png`; `../05-assets/team/` → `public/team/`; `../05-assets/logos/sources/` → `public/logos/`.
5. Put the copy from `LANDING_CONTENT.md` into `src/lib/content.ts`.
6. Build sections in the order of §7, then the live-demo routes `/courier`, `/ops`, `/buyer`, `/control` (§8A), then the dashboard (§9); keep `/demo` (§8) as the trailer/backup view.
7. Check against the screenshots in `screenshots/`.

---

## Appendix A · Complete stylesheet — `src/app/globals.css`

Verbatim from the current build (841 lines).

```css
@import "tailwindcss";

/*
 * Alodi design tokens.
 * Landing + demo follow DESIGN.md / monad.com; colour roles re-mapped onto Alodi:
 *   Monad Off-Black  -> Alodi Navy      #1f2a44
 *   Monad Ink        -> Alodi Deep Navy #121a2c
 *   Monad Lake Blue  -> Alodi Orange    #f05a00 (single primary action per screen)
 *   Monad Periwinkle -> Peach Mist       #fbe3d4
 * Fonts: Source Serif 4 (Untitled Serif), Geist Mono (ABC Diatype Mono), Geist (Untitled Sans).
 * JetBrains Mono and citation markers are banned — see /CLAUDE.md.
 */
:root {
  --color-parchment: #f6f3f1;
  --color-paper: #fbf9f7;
  --color-orange: #f05a00;
  --color-orange-deep: #c94b00;
  --color-peach-mist: #fbe3d4;
  --color-navy-mist: #e3e6ee;
  --color-peach: #ffb48a;
  --color-sky: #a0b5eb;
  --color-mint: #a7fccd;
  --color-gold: #ecda98;
  --color-navy: #1f2a44;
  --color-ink: #121a2c;
  --color-graphite: #4a5268;
  --color-smoke: #6b7183;
  --color-ash: #cecac8;
  --color-ash-soft: #e6e2df;

  /* Chart categorical order — validated with the dataviz validator on parchment */
  --chart-1: #f05a00;
  --chart-2: #3f5fae;
  --chart-3: #c9a227;

  --status-good: #1f8a5b;
  --status-warn: #b7791f;
  --status-bad: #c2410c;
}

@theme inline {
  --color-parchment: var(--color-parchment);
  --color-paper: var(--color-paper);
  --color-orange: var(--color-orange);
  --color-orange-deep: var(--color-orange-deep);
  --color-peach-mist: var(--color-peach-mist);
  --color-navy-mist: var(--color-navy-mist);
  --color-peach: var(--color-peach);
  --color-sky: var(--color-sky);
  --color-mint: var(--color-mint);
  --color-gold: var(--color-gold);
  --color-navy: var(--color-navy);
  --color-ink: var(--color-ink);
  --color-graphite: var(--color-graphite);
  --color-smoke: var(--color-smoke);
  --color-ash: var(--color-ash);
  --color-ash-soft: var(--color-ash-soft);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-good: var(--status-good);
  --color-warn: var(--status-warn);
  --color-bad: var(--status-bad);

  --font-serif: var(--font-serif-face), "Untitled Serif", Georgia, serif;
  --font-mono: var(--font-mono-face), "ABC Diatype Mono", ui-monospace, monospace;
  --font-sans: var(--font-sans-face), "Untitled Sans", ui-sans-serif, system-ui, sans-serif;
  --font-logo: var(--font-logo-face), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-display-face), Georgia, serif;
  --font-ui: var(--font-ui-face), ui-sans-serif, system-ui, sans-serif;
}

/* Lenis smooth scroll (copied from lenis/dist/lenis.css; native smooth scroll stays off) */
html.lenis,
html.lenis body {
  height: auto;
}
.lenis:not(.lenis-autoToggle).lenis-stopped {
  overflow: clip;
}
.lenis [data-lenis-prevent],
.lenis [data-lenis-prevent-wheel],
.lenis [data-lenis-prevent-touch] {
  overscroll-behavior: contain;
}
.lenis.lenis-smooth iframe {
  pointer-events: none;
}

body {
  background: var(--color-parchment);
  color: var(--color-navy);
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1.35;
  letter-spacing: -0.02em;
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--color-peach);
  color: var(--color-ink);
}

/* Type scale — monad.com text styles (heading-1 80px, heading-2 64px, heading-3 48px…) */
@utility t-display {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 28;
  font-size: clamp(48px, 7vw, 80px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
@utility t-h1 {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 28;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
@utility t-h2 {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 24;
  font-size: clamp(32px, 3.6vw, 48px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
@utility t-h3 {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 20;
  font-size: clamp(24px, 2.4vw, 32px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
@utility t-h4 {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 18;
  font-size: 24px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
@utility t-eyebrow {
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1.3;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
@utility t-label {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
@utility t-number {
  font-family: var(--font-serif);
  font-weight: 400;
  font-variation-settings: "opsz" 32;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: lining-nums;
}
@utility t-body-sans {
  font-family: var(--font-sans);
  letter-spacing: -0.01em;
}

/* Buttons — monad pill language: 48px tall, mono uppercase, trailing chevron */
@utility btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 48px;
  padding: 0 32px;
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}
@utility btn-primary {
  background: var(--color-orange);
  color: var(--color-ink);
  &:hover {
    background: #ff6a12;
  }
}
@utility btn-dark {
  background: var(--color-navy);
  color: var(--color-parchment);
  &:hover {
    background: var(--color-ink);
  }
}
@utility btn-ghost {
  border: 1px solid var(--color-ash);
  color: var(--color-navy);
  &:hover {
    border-color: var(--color-navy);
  }
}
@utility btn-sm {
  height: 36px;
  padding: 0 18px;
  font-size: 13px;
  gap: 8px;
}

@utility pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--color-navy);
  border-radius: 9999px;
  padding: 8px 20px;
  font-family: var(--font-mono);
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: var(--color-parchment);
  white-space: nowrap;
}

/* Monad cards: 1px hairline, ~16px radius, no shadow */
@utility card {
  border: 1px solid var(--color-ash);
  border-radius: 16px;
  padding: 40px;
  @media (max-width: 640px) {
    padding: 24px;
  }
}

@utility container-page {
  width: 100%;
  max-width: 1432px;
  margin: 0 auto;
  padding: 0 16px;
  @media (min-width: 768px) {
    padding: 0 44px;
  }
}

/* Soft atmospheric washes — decorative only */
.wash {
  position: absolute;
  border-radius: 9999px;
  filter: blur(64px);
  pointer-events: none;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
.marquee-track {
  display: flex;
  width: max-content;
  animation: marquee 48s linear infinite;
}
.marquee-track.reverse {
  animation-direction: reverse;
}
.marquee:hover .marquee-track {
  animation-play-state: paused;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
.pulse-ring {
  animation: pulse-ring 1.8s ease-out infinite;
  transform-origin: center;
  transform-box: fill-box;
}

@keyframes blink {
  50% {
    opacity: 0.25;
  }
}
.blink {
  animation: blink 1.2s ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.25);
  }
  50% {
    transform: scaleY(1);
  }
}
.wave-bar {
  transform-origin: center;
  animation: wave 0.9s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%,
  100% {
    opacity: 0.75;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}
.glow-breathe {
  animation: glow-breathe 4s ease-in-out infinite;
  transform-origin: center;
  transform-box: fill-box;
}

/* ---------------------------------------------------------------------------
 * Demo UI ("Component_demo and UI for application.md": shadcn-style, Geist,
 * 24px cards, 18px pills, hairlines) — monochrome surfaces, Alodi navy + orange.
 * ------------------------------------------------------------------------- */
.ui {
  --ui-canvas: #f5f5f5;
  --ui-paper: #ffffff;
  --ui-alt: #fafafa;
  --ui-ink: #1f2a44;
  --ui-ink-strong: #121a2c;
  --ui-muted: #737373;
  --ui-line: #e5e5e5;
  --ui-accent: #f05a00;
  --ui-accent-soft: #fff1e8;
  --ui-good: #15803d;
  --ui-good-soft: #e9f7ee;
  --ui-warn: #b45309;
  --ui-warn-soft: #fdf3e2;
  --ui-shadow: 0 0 0 1px rgba(23, 23, 23, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  background: var(--ui-canvas);
  color: var(--ui-ink);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.43;
  letter-spacing: 0;
  font-feature-settings: "ss01" on, "cv11" on;
}
.ui-card {
  background: var(--ui-paper);
  border: 1px solid var(--ui-line);
  border-radius: 24px;
  box-shadow: var(--ui-shadow);
}
.ui-h {
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
.ui-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ui-muted);
}
.ui-muted {
  color: var(--ui-muted);
}
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease,
    opacity 0.15s ease;
}
.ui-btn:active {
  transform: scale(0.97);
}
.ui-btn-primary {
  background: var(--ui-ink-strong);
  color: #fafafa;
}
.ui-btn-primary:hover {
  background: var(--ui-ink);
}
.ui-btn-accent {
  background: var(--ui-accent);
  color: #fff;
}
.ui-btn-accent:hover {
  background: #ff6a12;
}
.ui-btn-ghost {
  background: var(--ui-canvas);
  color: var(--ui-ink);
}
.ui-btn-ghost:hover {
  background: #ececec;
}
.ui-btn-outline {
  border: 1px solid var(--ui-line);
  color: var(--ui-ink);
  background: var(--ui-paper);
}
.ui-btn-outline:hover {
  background: var(--ui-alt);
}
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 18px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.ui-badge-solid {
  background: var(--ui-ink-strong);
  color: #fafafa;
}
.ui-badge-soft {
  background: var(--ui-canvas);
  color: var(--ui-ink);
}
.ui-badge-outline {
  border: 1px solid var(--ui-line);
  color: var(--ui-ink);
}
.ui-badge-accent {
  background: var(--ui-accent-soft);
  color: #c94b00;
}
.ui-badge-good {
  background: var(--ui-good-soft);
  color: var(--ui-good);
}
.ui-badge-warn {
  background: var(--ui-warn-soft);
  color: var(--ui-warn);
}
.ui-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-line) transparent;
}

/* Architecture diagram: flowing dashed connector, agent heartbeat, orchestrator sheen */
@keyframes flow-down {
  to {
    background-position: 0 12px;
  }
}
.flow-dash {
  background-image: linear-gradient(to bottom, var(--color-orange) 0 6px, transparent 6px 12px);
  background-size: 2px 12px;
  animation: flow-down 0.8s linear infinite;
}
@keyframes agent-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}
.agent-pulse {
  animation: agent-pulse 2.5s ease-in-out infinite;
}
@keyframes sheen {
  from {
    transform: translateX(-120%);
  }
  to {
    transform: translateX(220%);
  }
}
.orch-sheen {
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
  width: 45%;
  animation: sheen 3.2s ease-in-out infinite;
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}
.ring-spin {
  animation: ring-spin 18s linear infinite;
  transform-origin: center;
  transform-box: fill-box;
}

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--color-ash) transparent;
}

/* ---------------------------------------------------------------------------
 * Dashboard (Dashboard_Desig.md "Ember Studio"), Alodi colours, light + dark
 * ------------------------------------------------------------------------- */
.dash {
  --d-bg: #faf8f6;
  --d-side: #f4efea;
  --d-surface: #ffffff;
  --d-tint: #fbefe7;
  --d-raised: #f1e9e2;
  --d-border: #e4ddd6;
  --d-text: #1f2a44;
  --d-text-2: #4a5268;
  --d-muted: #7a7f8f;
  --d-primary: #d14e00;
  --d-primary-hover: #b34300;
  --d-primary-soft: #fde3d2;
  --d-accent: #f59e0b;
  --d-good: #15803d;
  --d-good-soft: #dcf3e4;
  --d-warn: #b45309;
  --d-warn-soft: #fdf0d8;
  --d-bad: #b91c1c;
  --d-bad-soft: #fde2e2;
  --d-chart-1: #f05a00;
  --d-chart-2: #3f5fae;
  --d-chart-3: #c9a227;
  --d-chart-track: #ebe4dd;
  --d-shadow: 0 4px 16px rgba(31, 42, 68, 0.06);
  background: var(--d-bg);
  color: var(--d-text);
  font-family: var(--font-ui);
  letter-spacing: 0;
}
.dash[data-theme="dark"] {
  --d-bg: #10172a;
  --d-side: #0c1222;
  --d-surface: #172038;
  --d-tint: #1d2742;
  --d-raised: #222d4a;
  --d-border: #2b3757;
  --d-text: #f3eee8;
  --d-text-2: #c3c8d6;
  --d-muted: #8e95aa;
  --d-primary: #ff6a1a;
  --d-primary-hover: #ff8540;
  --d-primary-soft: #3a2a26;
  --d-accent: #fbbf24;
  --d-good: #4ade80;
  --d-good-soft: #163626;
  --d-warn: #fbbf24;
  --d-warn-soft: #3a2f16;
  --d-bad: #f87171;
  --d-bad-soft: #3d1f24;
  --d-chart-1: #e45c16;
  --d-chart-2: #6a86d2;
  --d-chart-3: #b08d22;
  --d-chart-track: #26314f;
  --d-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

/* Dashboard building blocks (Ember: 12px cards, 8px buttons, pill chips, 4px progress) */
.d-card {
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: 12px;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}
.d-card-hover:hover {
  box-shadow: var(--d-shadow);
  transform: translateY(-2px);
}
.d-tint {
  background: var(--d-tint);
  border-radius: 12px;
}
.d-title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.02em;
}
.d-num {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: -0.02em;
  font-variant-numeric: lining-nums;
}
.d-overline {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--d-muted);
}
.d-muted {
  color: var(--d-muted);
}
.d-text2 {
  color: var(--d-text-2);
}
.d-border {
  border-color: var(--d-border);
}
.d-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.d-btn-primary {
  background: var(--d-primary);
  color: #fff;
}
.d-btn-primary:hover {
  background: var(--d-primary-hover);
  box-shadow: 0 4px 12px rgba(209, 78, 0, 0.25);
}
.d-btn-secondary {
  border: 1px solid var(--d-border);
  color: var(--d-text);
}
.d-btn-secondary:hover {
  background: var(--d-raised);
}
.d-btn-sm {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}
.d-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.d-chip-neutral {
  background: var(--d-raised);
  color: var(--d-text-2);
}
.d-chip-primary {
  background: var(--d-primary-soft);
  color: var(--d-primary);
}
.d-chip-good {
  background: var(--d-good-soft);
  color: var(--d-good);
}
.d-chip-warn {
  background: var(--d-warn-soft);
  color: var(--d-warn);
}
.d-chip-bad {
  background: var(--d-bad-soft);
  color: var(--d-bad);
}
.d-input {
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: 9999px;
  color: var(--d-text);
}
.d-input:focus {
  outline: none;
  border-color: var(--d-primary);
  box-shadow: 0 0 0 3px rgba(209, 78, 0, 0.12);
}
.d-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--d-border) transparent;
}

/* ---------------------------------------------------------------------------
 * View transitions (React <ViewTransition>, Next 16 navigations)
 * ------------------------------------------------------------------------- */
::view-transition {
  pointer-events: none;
}
@keyframes vt-fade {
  from {
    opacity: 0;
    filter: blur(6px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}
@keyframes vt-slide {
  from {
    translate: var(--vt-offset) 0;
  }
  to {
    translate: 0 0;
  }
}
@keyframes vt-rise {
  from {
    translate: 0 24px;
    scale: 0.985;
  }
  to {
    translate: 0 0;
    scale: 1;
  }
}
@keyframes vt-blur-mid {
  40% {
    filter: blur(4px);
  }
}
::view-transition-old(.nav-forward) {
  --vt-offset: -48px;
  animation:
    160ms ease-in both vt-fade reverse,
    420ms cubic-bezier(0.22, 1, 0.36, 1) both vt-slide reverse;
}
::view-transition-new(.nav-forward) {
  --vt-offset: 48px;
  animation:
    260ms ease-out 140ms both vt-fade,
    520ms cubic-bezier(0.22, 1, 0.36, 1) both vt-slide;
}
::view-transition-old(.nav-back) {
  --vt-offset: 48px;
  animation:
    160ms ease-in both vt-fade reverse,
    420ms cubic-bezier(0.22, 1, 0.36, 1) both vt-slide reverse;
}
::view-transition-new(.nav-back) {
  --vt-offset: -48px;
  animation:
    260ms ease-out 140ms both vt-fade,
    520ms cubic-bezier(0.22, 1, 0.36, 1) both vt-slide;
}
::view-transition-old(.page-rise) {
  animation: 180ms ease-in both vt-fade reverse;
}
::view-transition-new(.page-rise) {
  animation:
    320ms ease-out 120ms both vt-fade,
    600ms cubic-bezier(0.22, 1, 0.36, 1) both vt-rise;
}
::view-transition-group(.morph) {
  animation-duration: 620ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
::view-transition-image-pair(.morph) {
  animation-name: vt-blur-mid;
}
/* Dashboard sidebar and demo nav stay put while content moves */
::view-transition-group(dash-side),
::view-transition-group(demo-nav) {
  animation: none;
  z-index: 100;
}
::view-transition-old(dash-side),
::view-transition-old(demo-nav) {
  display: none;
}
::view-transition-new(dash-side),
::view-transition-new(demo-nav) {
  animation: none;
}
/* Theme switch: circular reveal from the toggle (document.startViewTransition) */
html.theme-vt::view-transition-old(root),
html.theme-vt::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
html.theme-vt::view-transition-new(root) {
  z-index: 2;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Appendix B · Fonts and root layout — `src/app/layout.tsx`

Verbatim from the current build (62 lines).

```tsx
import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist, Geist_Mono, Playfair_Display, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Landing + demo: stand-ins for Monad's Untitled Serif / ABC Diatype Mono / Untitled Sans
const serif = Source_Serif_4({
  variable: "--font-serif-face",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const mono = Geist_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sans = Geist({
  variable: "--font-sans-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Dashboard (Dashboard_Desig.md)
const display = Playfair_Display({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const ui = Source_Sans_3({
  variable: "--font-ui-face",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// Alodi wordmark + taglines (brand sheet: Be Vietnam Pro ExtraBold / Medium)
const logo = Be_Vietnam_Pro({
  variable: "--font-logo-face",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "800"],
});

export const metadata: Metadata = {
  title: "Alodi · Make the second drop land",
  description:
    "Alodi rescues failed deliveries. The courier taps one button; the agent messages and calls the buyer, then hands back structured context for the next attempt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${mono.variable} ${sans.variable} ${display.variable} ${ui.variable} ${logo.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

## Appendix C · Motion building blocks — `src/components/landing/motion.tsx`

Verbatim from the current build (160 lines).

```tsx
"use client";

import Lenis from "lenis";
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Lenis smooth scrolling for the long editorial pages. Keeps position: sticky working. */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -96 }, easing: (t) => 1 - Math.pow(1 - t, 4) });
    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [reduce]);
  return null;
}

/** Thin orange reading-progress line pinned to the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return <motion.div className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-orange" style={{ scaleX: x }} aria-hidden />;
}

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/**
 * Editorial headline reveal: each word rises out of its own masked line.
 * Pass plain text; the accessible name stays the full sentence.
 */
export function RevealText({
  text,
  as = "h2",
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Tag = as;
  const words = text.split(" ");
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-top" aria-hidden>
          <motion.span
            className="inline-block will-change-transform"
            initial={reduce ? false : { y: "105%", rotate: 4 }}
            animate={inView || reduce ? { y: "0%", rotate: 0 } : undefined}
            transition={{ duration: 0.9, delay: delay + i * stagger, ease: EASE }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </Tag>
  );
}

/** Scroll-linked drift: moves children by `amount` px across their pass through the viewport. */
export function Parallax({ children, amount = 60, className = "" }: { children: React.ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

/** Counts up every number in a string such as "₫40,000", "8–12%", "+34.75%" when scrolled into view. */
export function Figure({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, 1, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setP });
    return () => c.stop();
  }, [inView, reduce]);

  const prog = reduce ? 1 : p;
  const text = value.replace(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g, (m) => {
    const thousands = m.includes(",");
    const decimals = !thousands && m.includes(".") ? m.split(".")[1].length : 0;
    const n = parseFloat(m.replace(/,/g, ""));
    const cur = n * prog;
    if (thousands) return Math.round(cur).toLocaleString("en-US");
    return decimals ? cur.toFixed(decimals) : String(Math.round(cur));
  });

  return (
    <span ref={ref} className={className} aria-label={value}>
      {text}
    </span>
  );
}

/** 0→1 progress when scrolled into view (chart grow-in). */
export function useGrow() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, 1, { duration: 1.2, ease: EASE, onUpdate: setP });
    return () => c.stop();
  }, [inView, reduce]);
  return { ref, p: reduce ? 1 : p };
}
```

## Appendix D · Brand wipe intro — `src/components/site/brand-wipe.tsx`

Verbatim from the current build (76 lines).

```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// Plays once per area per page session (module memory survives client navigations, resets on reload).
const played = new Set<string>();

/**
 * Scene cut from the branding sheet: the dot blinks on navy, the orange ring expands,
 * orange fills the frame, then the page is revealed through a closing circle.
 */
export function BrandWipe({ tagline = "Make the second drop land.", id = "default" }: { tagline?: string; id?: string }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (played.has(id) || reduce) return;
    played.add(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot intro on first mount
    setShow(true);
  }, [reduce, id]);

  // Separate effect so a StrictMode remount re-arms the timer instead of leaving the overlay up.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 2300);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-hidden bg-navy"
          onClick={() => setShow(false)}
          exit={{ clipPath: "circle(0% at 50% 50%)" }}
          initial={{ clipPath: "circle(150% at 50% 50%)" }}
          animate={{ clipPath: "circle(150% at 50% 50%)" }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden
        >
          {/* 1 · dot blinks */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="rounded-full border-orange"
              initial={{ width: 44, height: 44, borderWidth: 10, opacity: 0 }}
              animate={{
                width: [44, 44, 44, 260, 2600],
                height: [44, 44, 44, 260, 2600],
                borderWidth: [10, 10, 10, 70, 1300],
                opacity: [0, 1, 1, 1, 1],
              }}
              transition={{ duration: 1.7, times: [0, 0.12, 0.42, 0.7, 1], ease: [0.76, 0, 0.24, 1] }}
              style={{ borderStyle: "solid", transform: "translate(-50%, -50%)", position: "absolute", left: 0, top: 0 }}
            />
            <motion.span
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-parchment"
              animate={{ opacity: [0, 1, 0.2, 1, 0.2, 1, 1], backgroundColor: ["#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#f6f3f1", "#121a2c"] }}
              transition={{ duration: 1.9, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.9] }}
            />
          </div>
          {/* 3 · orange fill with the line */}
          <motion.div
            className="absolute inset-x-0 bottom-[18%] text-center font-[family-name:var(--font-logo)] text-[clamp(22px,3vw,34px)] font-extrabold tracking-[-0.02em] text-ink"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: [0, 0, 1], y: [16, 16, 0] }}
            transition={{ duration: 2, times: [0, 0.78, 1] }}
          >
            {tagline}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## Appendix E · Scroll-velocity marquee — `src/components/landing/velocity-marquee.tsx`

Verbatim from the current build (71 lines).

```tsx
"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useRef, useState } from "react";

function wrap(min: number, max: number, v: number) {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
}

/**
 * Infinite marquee whose speed follows scroll velocity and whose direction flips with scroll
 * direction. Hovering slows it to a crawl. Children are rendered twice for a seamless loop.
 */
export function VelocityMarquee({
  children,
  speed = 40,
  reverse = false,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(base, (v) => `${wrap(-50, 0, v)}%`);
  const dir = useRef(reverse ? 1 : -1);
  const [hover, setHover] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  useAnimationFrame((_, delta) => {
    if (reduce || !track.current) return;
    const width = track.current.scrollWidth / 2 || 1;
    const f = factor.get();
    const initial = reverse ? 1 : -1;
    if (f > 0.02) dir.current = initial;
    else if (f < -0.02) dir.current = -initial;
    const move = dir.current * (speed / width) * 50 * (delta / 1000) * (1 + Math.abs(f));
    base.set(base.get() + move * (hover ? 0.15 : 1));
  });

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.div ref={track} className="flex w-max" style={{ x }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
```

## Appendix F · Brand marks and wordmark — `src/components/site/brand.tsx`

Verbatim from the current build (110 lines).

```tsx
import Link from "next/link";

/** The three sound bars inside the ring — brand mark C (“one call”). */
function Waves({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <rect x="8.55" y="10.25" width="1.5" height="3.5" rx="0.75" />
      <rect x="11.25" y="8.9" width="1.5" height="6.2" rx="0.75" />
      <rect x="13.95" y="10.25" width="1.5" height="3.5" rx="0.75" />
    </g>
  );
}

/** Orange ring of the "o" — Alodi brand mark C: sound bars = a call. */
export function DropRing({
  size = 24,
  dot = "var(--color-navy)",
  className = "",
}: {
  size?: number;
  dot?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="var(--color-orange)" strokeWidth="5.2" />
      <Waves fill={dot} />
    </svg>
  );
}

/**
 * The only glyph language allowed: the three brand marks from the branding sheet.
 * dot = landing point, check = done, square = parcel, wave = a call.
 */
export function Mark({
  kind = "dot",
  size = 14,
  ring = "currentColor",
  className = "",
}: {
  kind?: "dot" | "check" | "square" | "wave";
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke={ring} strokeWidth="1.6" />
      {kind === "dot" && <circle cx="8" cy="8" r="2" fill={ring} />}
      {kind === "square" && <rect x="6" y="6" width="4" height="4" rx="0.8" fill={ring} />}
      {kind === "wave" && (
        <g fill={ring}>
          <rect x="5.4" y="6.9" width="1.3" height="2.2" rx="0.65" />
          <rect x="7.35" y="5.9" width="1.3" height="4.2" rx="0.65" />
          <rect x="9.3" y="6.9" width="1.3" height="2.2" rx="0.65" />
        </g>
      )}
      {kind === "check" && (
        <path d="M5.4 8.2l1.8 1.8 3.4-3.6" fill="none" stroke={ring} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function Wordmark({ className = "", tone = "navy" }: { className?: string; tone?: "navy" | "light" }) {
  const color = tone === "navy" ? "var(--color-navy)" : "#ffffff";
  return (
    <span
      className={`inline-flex items-baseline font-[family-name:var(--font-logo)] font-extrabold leading-none tracking-[-0.045em] ${className}`}
      style={{ color }}
      aria-label="alodi"
    >
      al
      <span className="relative mx-[0.02em] inline-block w-[0.66em] self-center translate-y-[0.07em]" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-auto w-full">
          <circle cx="12" cy="12" r="8.6" fill="none" stroke="var(--color-orange)" strokeWidth="5.4" />
          <Waves fill={color} />
        </svg>
      </span>
      di
    </span>
  );
}

export function LogoLink({ tone = "navy", size = "text-[32px]" }: { tone?: "navy" | "light"; size?: string }) {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Alodi home">
      <Wordmark className={size} tone={tone} />
    </Link>
  );
}

/** Plain-text attribution. Never numbered markers. */
export function SourceNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[12px] leading-[1.45] text-smoke ${className}`}>Source: {children}</p>;
}

/** Monad eyebrow: plain uppercase mono line above a heading. */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`t-eyebrow text-navy ${className}`}>{children}</div>;
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" className={`shrink-0 ${className}`} aria-hidden>
      <path d="M2.5 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

## Appendix G · Logo rendering — `src/components/site/logos.tsx`

Verbatim from the current build (106 lines).

```tsx
"use client";

import {
  siApachekafka,
  siAsterisk,
  siDocker,
  siFastapi,
  siFramer,
  siGrafana,
  siHuggingface,
  siKubernetes,
  siLanggraph,
  siMinio,
  siNextdotjs,
  siNvidia,
  siOpenai,
  siPostgresql,
  siRedis,
  siShopee,
  siSqlite,
  siTailwindcss,
  siTemporal,
  siTypescript,
  siZalo,
  type SimpleIcon,
} from "simple-icons";

const ICONS: Record<string, SimpleIcon> = {
  siApachekafka,
  siAsterisk,
  siDocker,
  siFastapi,
  siFramer,
  siGrafana,
  siHuggingface,
  siKubernetes,
  siLanggraph,
  siMinio,
  siNextdotjs,
  siNvidia,
  siOpenai,
  siPostgresql,
  siRedis,
  siShopee,
  siSqlite,
  siTailwindcss,
  siTemporal,
  siTypescript,
  siZalo,
};

/** A real technology logo: simple-icons glyph in its brand colour, or an image from /public/logos. */
export function TechIcon({ icon, size = 24, mono = false, className = "" }: { icon: string; size?: number; mono?: boolean; className?: string }) {
  const s = ICONS[icon];
  if (s) {
    const dark = ["000000", "1C3C3C", "231F20", "191919"].includes(s.hex.toUpperCase());
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`} role="img" aria-label={s.title}>
        <path d={s.path} fill={mono ? "currentColor" : dark ? "var(--color-navy)" : `#${s.hex}`} />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;
}

/**
 * Source logo for the "built on public figures" strip, shown in the company's own colours.
 * `mono` artwork (white wordmarks made for dark backgrounds) is drawn as a navy silhouette instead.
 */
export function SourceLogo({ name, src, ratio, height = 34, mono = false }: { name: string; src: string; ratio: number; height?: number; mono?: boolean }) {
  if (ICONS[src]) {
    return (
      <span className="flex items-center gap-2.5 transition-transform duration-300 hover:scale-105" style={{ height }} aria-label={name} role="img">
        <TechIcon icon={src} size={height * 0.92} />
        <span className="font-[family-name:var(--font-logo)] text-[27px] font-extrabold tracking-[-0.03em] leading-none" style={{ color: `#${ICONS[src].hex}` }}>
          {name}
        </span>
      </span>
    );
  }
  const w = height * ratio;
  if (mono) {
    return (
      <span
        className="block shrink-0 bg-navy transition-transform duration-300 hover:scale-105"
        style={{
          width: w,
          height,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
        role="img"
        aria-label={name}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className="block shrink-0 object-contain transition-transform duration-300 hover:scale-105" style={{ width: w, height }} />;
}
```
