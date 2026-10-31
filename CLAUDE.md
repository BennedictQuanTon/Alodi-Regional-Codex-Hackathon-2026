# Project rules

The product is called **Alodi** (formerly Dropee). Brand assets: `prep/04-brand/source/alodi-brand-sheet.png`, `prep/04-brand/source/alodi-icon-C-orange.png`; the site uses mark C (sound bars).

These rules are absolute. They apply to every page, component, document and generated asset in this repo.

## Banned, never ship again

1. **No citation markers.** Never render bracketed or superscript reference numbers such as `[4]`, `[1][2]`, `¹`, or footnote digits next to text, numbers or charts. Attribute data with a plain-text source line instead (e.g. `Source: Shopee Return & Refund Policy §7.1, Mar 2026`) and list full links in the Sources section without numbering. Exception: the pitch deck (prep/01-pitch/Alodi-Pitch.pptx) uses numbered references [n] with a References slide at the end, at the team’s request.
2. **No monospace faces anywhere.** No JetBrains Mono, Geist Mono, Fira Code, Source Code Pro, Cascadia, Consolas or Menlo. UI text, labels, numbers in tables and JSON use **Geist** (sans) with tabular figures; the `--font-mono` token is kept as a role name but resolves to Geist.
3. **No decorative AI-style icons.** UI glyphs are limited to the Alodi brand marks (ring + dot, ring + check, ring + sound bars, ring + square) and plain arrows (→ ↓ ›). Real brand logos are allowed only where they identify a real company or technology (the sources strip and the tech stack), taken from `simple-icons` or the company’s own site, stored in `web/public/logos/`.

## Language

All UI copy, docs and the demo script are in **English**.

## Type

- Landing: **Source Serif 4** (weight 400, never bold) for headings and big numbers, **Geist** for body, nav, buttons and labels, **Geist** for long card copy. Follows `DESIGN.md` / monad.com.
- Demo (`/demo/*`): **Geist** only, following `Component_demo and UI for application.md` (shadcn-style: 24px cards, 18px pills, hairlines, minimal copy), with Alodi navy + orange instead of black + red.
- Dashboard (`/console`, `/metrics`): **Geist** only, in the demo UI language (white cards on a neutral canvas, hairlines, navy + one orange action), laid out like an SPX hub operations screen: KPI strip, rescue pipeline by business step, policy guard, exception queue, routes, CS queue. Figures come from `prep/02-technical/mock-data` via `export_dashboard.py`. Light and dark mode.
- Wordmark and taglines: **Be Vietnam Pro** (ExtraBold for the logo, Medium for taglines), per `prep/04-brand/source/alodi-brand-sheet.png`.

## Colour

Alodi navy `#1f2a44`, deep navy `#121a2c`, orange `#f05a00` (one primary action per view), parchment `#f6f3f1`.

## Assets

Team portraits live in `web/public/team/` and are committed so every build and deploy shows them (copied from the MyWebsite repo, where they are already public; this repo is private). Components still fall back to initials if a portrait fails to load.

## Commits

Commits and PRs carry the team’s authorship only. Never add AI attribution: no `Co-Authored-By: Claude` (or any AI) trailer, no “Generated with Claude Code” line, no tool credit in commit messages, PR titles or PR bodies.
