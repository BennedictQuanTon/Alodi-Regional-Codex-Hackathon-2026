# Alodi brand

**alodi** — navy wordmark, the “o” is an orange ring with three sound bars inside (*a call*). One mark everywhere: the landing page, the demo, the dashboard and the app icon.

All SVGs have the text converted to outlines (from Be Vietnam Pro ExtraBold), so they render identically without the font installed.

## Files

| File | Use |
| --- | --- |
| `logo/alodi-wordmark-navy.svg` | Default logo on light backgrounds (parchment, white) |
| `logo/alodi-wordmark-white.svg` | Logo on navy, photos or video (transparent background) |
| `logo/alodi-wordmark-on-navy.svg` | Logo with its own navy tile (social posts, slide title) |
| `lockup/alodi-lockup-make-the-second-drop-land-{light,dark}.svg` | Logo + main tagline — title slide, closing slide, video end card |
| `lockup/alodi-lockup-one-call-delivered-{light,dark}.svg` | Logo + secondary tagline — demo intro, app store |
| `mark/alodi-mark.svg` | The ring alone (navy bars) — avatars, bullets, loaders |
| `mark/alodi-mark-on-dark.svg` | The ring alone with white bars, for dark backgrounds |
| `app-icon/alodi-app-icon-orange.svg` | **Primary app icon**: white ring, navy bars on orange tile |
| `app-icon/alodi-app-icon-navy.svg` | Alternative app icon: orange ring, white bars on navy tile |
| `favicon/favicon.svg` | Browser favicon (same as the orange app icon) |
| `png/…` | PNG exports: logos and lockups @2x, marks 512, app icons 1024/512/180, favicon 512/192/32/16 |
| `source/alodi-app-icon-original.png` | The designer’s original 1024 icon, for reference |
| `fonts/BeVietnamPro-ExtraBold.ttf`, `BeVietnamPro-Medium.ttf`, `OFL.txt` | Brand font (SIL Open Font License) |

For Next.js: copy `png/app-icon/alodi-app-icon-orange-512.png` to `app/icon.png` and `-180.png` to `app/apple-icon.png`.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| **Navy** | `#1F2A44` | Wordmark, text, dark surfaces |
| **Alodi Orange** | `#F05A00` | The ring, the one primary button per view, highlights |
| **Night navy** | `#121A2C` | Icon backgrounds, video backgrounds, deepest surfaces |
| **Slate** | `#5A6173` | Taglines on light backgrounds |
| **White** | `#FFFFFF` | Text on dark |
| Parchment (site canvas) | `#F6F3F1` | Landing background — warm off-white, never pure white |

## Type

| Role | Font | Weight |
| --- | --- | --- |
| Wordmark | Be Vietnam Pro | ExtraBold (800), tracking −4.5% |
| Taglines | Be Vietnam Pro | Medium (500) |
| Landing headings | Source Serif 4 | 400, never bold |
| Landing UI / body | Geist Mono, Geist | 400 / 500 |
| Demo UI | Geist | 400 / 500 / 600 |
| Dashboard | Playfair Display (italic titles) + Source Sans 3 | 400 / 600 |

Be Vietnam Pro covers Vietnamese diacritics.

## Taglines

- **Make the second drop land.** — main
- **One call. Delivered.** — demo / product moments

## Construction

- The ring sits on the x-height centre between “al” and “di”; outer diameter ≈ 1.12 × x-height; ring stroke ≈ 44% of the outer radius.
- Sound bars: three rounded bars, centre bar ≈ 1.8× the side bars, colour = wordmark colour (navy on light, white on dark).
- Clear space: at least the height of the ring on every side.
- Minimum size: wordmark 72 px wide on screen; mark 16 px (favicon).

## Motion

Scene cut used at the start of the demo and dashboard (and for video transitions): the bars blink like an incoming call → the orange ring expands to fill the frame → the tagline appears on orange → the page is revealed through a closing circle. Spec in `../03-design/DESIGN.md` §11.

## Don’t

- Don’t recolour the ring (always orange, or white on an orange tile).
- Don’t put the navy wordmark on navy or the white one on parchment.
- Don’t stretch, outline, add shadows or gradients.
- Don’t replace the bars with another symbol — Alodi uses mark C only.
