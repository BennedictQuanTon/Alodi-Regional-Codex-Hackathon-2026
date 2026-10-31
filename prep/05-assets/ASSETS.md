# Assets

## Team portraits — `team/`

| File | Person | Role | Crop hint (object-position) |
| --- | --- | --- | --- |
| `nomura-yoshio.jpg` | Nomura Yoshio | Team Lead · Project Presenter | 50% 30% |
| `long-quan-ton.jpg` | Long Quan Ton | AI Engineer · Solution Architect | 53% 22% (photo at the NVIDIA booth, Vietnam AI Open Hackathon) |
| `khanh-tuong-huynh.jpg` | Khanh Tuong Huynh | AI Engineer · Deployment Engineer | 50% 30% |
| `thanh-loi-tran.jpg` | Thanh Loi Tran | Data Engineer · Backend Developer | 50% 30% |

Copied from the team’s portfolio site, where they are already public. Show in full colour, 4:5 crop, 20 px radius. Always provide initials as a fallback if an image fails.

## Source logos — `logos/sources/`

Logos of the organisations whose figures we cite. Taken from each organisation’s own website. Use only next to the figure they support (the “Built on public figures from” strip, slide footers).

| File | Organisation | Aspect ratio (w/h) | Note |
| --- | --- | --- | --- |
| *(simple-icons `siShopee`)* | Shopee | 1 | Use `../logos/tech/shopee.svg` + the word “Shopee” |
| `vecom.svg` | VECOM | 3.35 | Artwork is white for dark backgrounds — render as a navy silhouette (CSS mask) on light |
| `metric.svg` | Metric | 5.24 | |
| `ghn.png` | Giao Hang Nhanh (GHN) | 3.5 | |
| `shipsy.png` | Shipsy | 3.25 | |
| `vtv.svg` | VTV | 4.67 | |
| `nld.png` | Nguoi Lao Dong | 6.55 | |
| `assemblyai.svg` / `assemblyai-mark.svg` | AssemblyAI | 5.75 / ~1 | |
| `vinai.png` / `vinai-mark.png` | VinAI (PhoWhisper) | 2.95 / ~1 | |

Display height 34 px (26 px for very wide logos, ratio > 5), full colour, slight scale on hover.

## Tech logos — `logos/tech/`

33 technologies exported from `simple-icons` in brand colour and in a `-mono` (currentColor) version, plus AssemblyAI and VinAI marks. Full list with brand hex values: [`logos/tech/INDEX.md`](logos/tech/INDEX.md). Which ones belong to the demo stack vs production stack: [`../02-technical/PRD.md`](../02-technical/PRD.md) §21.

Very dark brand colours (Next.js, Temporal, OpenAI — #000/#191919) should be drawn in navy `#1F2A44` on the site so they match the palette.

## Diagrams

Live in [`../02-technical/diagrams/`](../02-technical/diagrams/): `alodi-architecture.pdf/.png`, `alodi-flow.pdf/.png`.
