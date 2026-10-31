"""Render the pitch charts (SVG + PNG, light and dark) from the cost model and the survey CSVs.

Usage (any Python with matplotlib):  python3 make_charts.py
Reads ../../02-technical/cost-model/cost_model_output.json and ../../06-survey/*.csv
Palette validated with the dataviz checks: light #3f5fae / #f05a00 on #f6f3f1, dark #6d8ad6 / #f05a00 on #121a2c.
"""
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch

HERE = Path(__file__).parent
OUT = HERE
for f in (HERE / "fonts").glob("*.ttf"):
    font_manager.fontManager.addfont(str(f))
plt.rcParams.update({"svg.fonttype": "path", "font.family": "Geist"})
import textwrap

THEMES = {
    "light": {"bg": "#f6f3f1", "ink": "#1f2a44", "ink2": "#5a6173", "muted": "#8a8f9c", "grid": "#e2dcd6",
              "blue": "#3f5fae", "orange": "#f05a00", "neutral": "#c9c3bd", "track": "#e9e3de"},
    "dark":  {"bg": "#121a2c", "ink": "#f6f3f1", "ink2": "#b8bfcf", "muted": "#7c849a", "grid": "#26314a",
              "blue": "#6d8ad6", "orange": "#f05a00", "neutral": "#4a5571", "track": "#1f2a44"},
}
W, H, DPI = 16, 9, 120   # 1920 × 1080

MODEL = json.loads((HERE / "../../02-technical/cost-model/cost_model_output.json").read_text())
HEAD = next(r for r in MODEL["rows"] if r["setup"] == "local_first" and r["messaging"] == "risky_only" and r["scenario"] == "best_in_class")
SCEN = {r["scenario"]: r for r in MODEL["rows"] if r["setup"] == "local_first" and r["messaging"] == "risky_only"}
LOSS_MID = MODEL["loss_mid"]
M = lambda v: f"{v / 1e6:,.0f}M VND"
B = lambda v: f"{v / 1e9:,.1f}B VND"


def frame(t, title, subtitle=None):
    fig = plt.figure(figsize=(W, H), dpi=DPI, facecolor=t["bg"])
    fig.text(0.06, 0.90, title, color=t["ink"], fontsize=34, fontweight=500, ha="left", va="bottom")
    if subtitle:
        fig.text(0.06, 0.855, subtitle, color=t["ink2"], fontsize=18, ha="left", va="bottom")
    return fig


def source(fig, t, text):
    fig.text(0.06, 0.03, "\n".join(textwrap.wrap(text, 118)), color=t["muted"], fontsize=12.5, ha="left", va="bottom",
             family="Geist Mono", linespacing=1.5)


def mock_badge(fig, t):
    fig.text(0.94, 0.90, "MOCK DATA", color=t["orange"], fontsize=14, ha="right", va="bottom", family="Geist Mono",
             bbox=dict(boxstyle="round,pad=0.5", fc="none", ec=t["orange"], lw=1.2))


def axes(fig, t, rect=(0.06, 0.14, 0.88, 0.66)):
    ax = fig.add_axes(rect, facecolor=t["bg"])
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(colors=t["ink2"], labelsize=15, length=0)
    return ax


def rbar(ax, x, y, w, h, color, horizontal=True):
    """Bar with a 4 px-ish rounded data end, square at the baseline."""
    if horizontal:
        ax.add_patch(plt.Rectangle((x, y - h / 2), max(w - 0.004 * ax.get_xlim()[1], 0), h, color=color, lw=0))
        ax.add_patch(FancyBboxPatch((x + w * 0.5, y - h / 2), w * 0.5, h, boxstyle="round,pad=0,rounding_size=0.06",
                                    mutation_aspect=1 / 60, color=color, lw=0))
    else:
        ax.bar(x, w, width=h, bottom=y, color=color, lw=0)


def save(fig, name, theme):
    for ext in ("svg", "png"):
        fig.savefig(OUT / f"{name}-{theme}.{ext}", facecolor=fig.get_facecolor())
    plt.close(fig)


# ------------------------------------------------------------------ 1. refusal rates by context
def chart_refusal(theme):
    t = THEMES[theme]
    fig = frame(t, "Up to 1 in 4 orders are refused at the door", "Share of COD orders refused (“bombed”), Vietnam")
    ax = axes(fig, t, (0.20, 0.16, 0.72, 0.62))
    rows = [("Nationwide", 8, 12), ("Today (expert)", 10, 15), ("Remote areas", 0, 20), ("Sale season", 25, 30)]
    ax.set_xlim(0, 34)
    ax.set_ylim(-0.6, len(rows) - 0.4)
    for i, (lab, lo, hi) in enumerate(reversed(rows)):
        col = t["orange"] if lab == "Sale season" else t["blue"]
        if lo == 0:
            ax.barh(i, hi, height=0.36, color=col, lw=0)
            txt = f"up to {hi}%"
        else:
            ax.barh(i, hi - lo, left=lo, height=0.36, color=col, lw=0)
            ax.barh(i, lo, height=0.36, color=t["track"], lw=0)
            txt = f"{lo}–{hi}%"
        ax.text(hi + 0.6, i, txt, va="center", color=t["ink"], fontsize=20, fontweight=500)
    ax.set_yticks(range(len(rows)), [r[0] for r in reversed(rows)], fontsize=18, color=t["ink"])
    ax.set_xticks([0, 10, 20, 30], ["0%", "10%", "20%", "30%"])
    ax.grid(axis="x", color=t["grid"], lw=1)
    ax.set_axisbelow(True)
    source(fig, t, "Source: VECOM (nationwide, remote) and Tran Anh Tung, UEF (today, sale season) — Nguoi Lao Dong, 19 Jul 2025")
    save(fig, "01-problem-refusal-rates", theme)


# ------------------------------------------------------------------ 2. monthly loss per area
def chart_loss(theme):
    t = THEMES[theme]
    items = MODEL["loss"]["items"]
    rows = [(k, sum(v) / 2) for k, v in items.items()]
    rows.sort(key=lambda r: r[1])
    labels = {"Return fees paid by sellers": "Return fees paid by sellers",
              "Courier pay for redelivery attempts": "Courier pay for redelivery",
              "Courier time lost when the buyer doesn't answer": "Courier time at unanswered doors",
              "Hub / CS staff calling buyers back": "CS staff calling buyers back"}
    fig = frame(t, f"One area loses ≈ {M(LOSS_MID)} every month", "20 couriers · 4,000 orders a day · 8% fail on the first attempt")
    ax = axes(fig, t, (0.30, 0.16, 0.62, 0.62))
    ax.set_xlim(0, max(v for _, v in rows) * 1.25)
    for i, (k, v) in enumerate(rows):
        ax.barh(i, v, height=0.38, color=t["orange"] if v == max(x for _, x in rows) else t["blue"], lw=0)
        ax.text(v + 4e6, i, M(v), va="center", color=t["ink"], fontsize=20, fontweight=500)
    ax.set_yticks(range(len(rows)), [labels[k] for k, _ in rows], fontsize=17, color=t["ink"])
    ax.set_xticks([])
    source(fig, t, "Source: Shopee Return & Refund Policy §7.1 (40,000 VND) · VECOM 8% · Shipsy 25% rescue (vendor) · GHN 6–8k VND per order · Glints courier income. Midpoints; model in PRD §18.8")
    save(fig, "02-problem-monthly-loss", theme)


# ------------------------------------------------------------------ 3. before / after
def chart_before_after(theme):
    t = THEMES[theme]
    remaining = LOSS_MID - HEAD["gross_month"]
    cost = HEAD["cost_month"]
    fig = frame(t, f"Alodi cuts {HEAD['net_pct']:.0%} of it: {M(HEAD['net_month'])} a month",
                "One area, per month · best-in-class rescue rate · local-first server")
    ax = axes(fig, t, (0.10, 0.16, 0.62, 0.62))
    ax.set_xlim(-0.6, 1.6)
    ax.set_ylim(0, LOSS_MID * 1.15)
    ax.bar(0, LOSS_MID, width=0.42, color=t["blue"], lw=0)
    ax.bar(1, remaining, width=0.42, color=t["blue"], lw=0)
    ax.bar(1, cost, width=0.42, bottom=remaining + LOSS_MID * 0.006, color=t["orange"], lw=0)
    ax.text(0, LOSS_MID + LOSS_MID * 0.02, M(LOSS_MID), ha="center", color=t["ink"], fontsize=24, fontweight=500)
    ax.text(1, remaining + cost + LOSS_MID * 0.02, M(remaining + cost), ha="center", color=t["ink"], fontsize=24, fontweight=500)
    ax.annotate("", xy=(1, remaining + cost + LOSS_MID * 0.09), xytext=(0.3, LOSS_MID * 0.98),
                arrowprops=dict(arrowstyle="->", color=t["ink2"], lw=1.4, connectionstyle="arc3,rad=-0.2"))
    ax.set_xticks([0, 1], ["Today", "With Alodi"], fontsize=20, color=t["ink"])
    ax.set_yticks([])
    # legend + callouts
    fig.text(0.76, 0.66, f"−{M(HEAD['net_month'])}", color=t["ink"], fontsize=46, fontweight=600)
    fig.text(0.76, 0.61, "saved a month, after costs", color=t["ink2"], fontsize=18)
    fig.text(0.76, 0.50, f"≈ {B(HEAD['net_year'])}", color=t["ink"], fontsize=40, fontweight=600)
    fig.text(0.76, 0.455, "saved a year", color=t["ink2"], fontsize=18)
    for y, col, lab in ((0.32, t["blue"], "Delivery-failure loss"), (0.27, t["orange"], f"Alodi running cost ({M(cost)})")):
        fig.patches.append(plt.Rectangle((0.76, y), 0.014, 0.025, color=col, transform=fig.transFigure, figure=fig))
        fig.text(0.782, y + 0.003, lab, color=t["ink"], fontsize=16)
    source(fig, t, "Projected. Rescue 25% → 65% = Shipsy best-in-class 50–65% (vendor). Loss inputs as chart 02. Running cost: Viettel SIP, Zalo ZNS, EVN tariff, OpenAI fallback. PRD §18.8")
    save(fig, "03-output-before-after", theme)


# ------------------------------------------------------------------ 4. scenarios
def chart_scenarios(theme):
    t = THEMES[theme]
    fig = frame(t, "Net saving per area, per month", "After the 21M VND running cost · share of the monthly loss in brackets")
    ax = axes(fig, t, (0.26, 0.16, 0.66, 0.62))
    rows = [("Conservative · 40% rescue", SCEN["conservative"]), ("Base · 45% rescue", SCEN["base"]),
            ("Best-in-class · 65% rescue", SCEN["best_in_class"])]
    ax.set_xlim(0, HEAD["net_month"] * 1.3)
    for i, (lab, r) in enumerate(rows):
        ax.barh(i, r["net_month"], height=0.38, color=t["orange"] if "Best" in lab else t["blue"], lw=0)
        ax.text(r["net_month"] + 3e6, i, f"{M(r['net_month'])}  ({r['net_pct']:.0%})", va="center", color=t["ink"], fontsize=20, fontweight=500)
    ax.set_yticks(range(len(rows)), [r[0] for r in rows], fontsize=17, color=t["ink"])
    ax.set_xticks([])
    source(fig, t, "Projected. Today’s rescue 25%; Shipsy industry 20–30% and best-in-class 50–65% (vendor). Model: PRD §18.8, cost-model/cost_model.py")
    save(fig, "04-output-scenarios", theme)


# ------------------------------------------------------------------ 5. cost vs loss (proportion bar)
def chart_cost_share(theme):
    t = THEMES[theme]
    share = HEAD["cost_month"] / LOSS_MID
    fig = frame(t, f"Running Alodi costs {share:.1%} of what is lost", f"{M(HEAD['cost_month'])} a month against {M(LOSS_MID)} a month · one-time server 75–98M VND")
    ax = axes(fig, t, (0.06, 0.40, 0.88, 0.16))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.barh(0.5, 1, height=0.6, color=t["track"], lw=0)
    ax.barh(0.5, share, height=0.6, color=t["orange"], lw=0)
    ax.set_xticks([])
    ax.set_yticks([])
    fig.text(0.06, 0.30, f"{M(HEAD['cost_month'])}  Alodi running cost", color=t["ink"], fontsize=18)
    fig.text(0.94, 0.30, f"{M(LOSS_MID)}  monthly delivery-failure loss", color=t["ink2"], fontsize=18, ha="right")
    source(fig, t, "Source: Phong Vu RTX 5060 Ti listing · Viettel Mobile SIP price list · Zalo ZNS price tables · EVN business tariff · OpenAI pricing (third-party lists). PRD §18.8")
    save(fig, "05-output-cost-share", theme)


# ------------------------------------------------------------------ 6. survey pain frequency (mock, diverging)
def chart_survey(theme):
    t = THEMES[theme]
    rows = list(csv.DictReader(open(HERE / "../../06-survey/customers.csv", encoding="utf-8-sig")))
    qs = [("q01_courier_called_while_busy", "Courier called while I was busy"),
          ("q06_had_to_remind_courier", "I had to remind the courier"),
          ("q03_called_back_courier_unreachable", "I called back, courier unreachable"),
          ("q07_instruction_not_followed", "My instruction was ignored"),
          ("q02_missed_courier_call", "I missed the courier’s call")]
    fig = frame(t, "Buyers feel it every month", f"Customer survey, n = {len(rows)} · last 3 months")
    mock_badge(fig, t)
    ax = axes(fig, t, (0.34, 0.20, 0.58, 0.58))
    cols = {1: t["blue"], 2: t["blue"], 3: t["neutral"], 4: t["orange"], 5: t["orange"]}
    alphas = {1: 1.0, 2: 0.55, 3: 1.0, 4: 0.6, 5: 1.0}
    ax.set_xlim(-100, 100)
    for i, (q, lab) in enumerate(reversed(qs)):
        n = len(rows)
        p = {k: 100 * sum(1 for r in rows if int(r[q]) == k) / n for k in range(1, 6)}
        left = -(p[1] + p[2] + p[3] / 2)
        for k in range(1, 6):
            ax.barh(i, p[k] - 0.6, left=left + 0.3, height=0.42, color=cols[k], alpha=alphas[k], lw=0)
            left += p[k]
        often = p[4] + p[5]
        ax.text(98, i, f"{often:.0f}% often", va="center", ha="right", color=t["ink"], fontsize=17, fontweight=500)
    ax.axvline(0, color=t["grid"], lw=1)
    ax.set_yticks(range(len(qs)), [q[1] for q in reversed(qs)], fontsize=16, color=t["ink"])
    ax.set_xticks([])
    keys = [("Never", t["blue"], 1.0), ("Rarely", t["blue"], 0.55), ("Sometimes", t["neutral"], 1.0), ("Often", t["orange"], 0.6), ("Very often", t["orange"], 1.0)]
    x = 0.34
    for lab, c, a in keys:
        fig.patches.append(plt.Rectangle((x, 0.115), 0.012, 0.022, color=c, alpha=a, transform=fig.transFigure, figure=fig))
        fig.text(x + 0.017, 0.117, lab, color=t["ink2"], fontsize=14)
        x += 0.11
    source(fig, t, "Source: Alodi buyer survey, Oct 2026 — MOCK placeholder, replace with real responses (06-survey)")
    save(fig, "06-problem-survey-buyers-MOCK", theme)


# ------------------------------------------------------------------ 7. courier adoption (mock, dot grid)
def chart_couriers(theme):
    t = THEMES[theme]
    rows = list(csv.DictReader(open(HERE / "../../06-survey/couriers.csv", encoding="utf-8-sig")))
    yes = sum(1 for r in rows if r["q12_would_like_alodi_like_system"] == "Yes")
    unsure = sum(1 for r in rows if r["q12_would_like_alodi_like_system"] == "Not sure")
    no = len(rows) - yes - unsure
    fig = frame(t, f"{yes} of {len(rows)} couriers want it. None said no.",
                "“If a system asked buyers for a time and gave you a card, would you like it?”")
    mock_badge(fig, t)
    ax = axes(fig, t, (0.06, 0.22, 0.60, 0.50))
    ax.set_xlim(-0.6, 5.6)
    ax.set_ylim(-0.6, 1.6)
    ax.set_aspect("equal")
    for i in range(len(rows)):
        c = t["orange"] if i < yes else (t["neutral"] if i < yes + unsure else t["blue"])
        ax.add_patch(plt.Circle((i % 6, 1 - i // 6), 0.36, color=c, lw=0))
    ax.set_xticks([])
    ax.set_yticks([])
    fig.text(0.70, 0.60, f"{yes}", color=t["ink"], fontsize=72, fontweight=600)
    fig.text(0.70, 0.555, "Yes", color=t["ink2"], fontsize=18)
    fig.text(0.80, 0.60, f"{unsure}", color=t["ink"], fontsize=72, fontweight=600)
    fig.text(0.80, 0.555, "Not sure", color=t["ink2"], fontsize=18)
    fig.text(0.90, 0.60, f"{no}", color=t["ink"], fontsize=72, fontweight=600)
    fig.text(0.90, 0.555, "No", color=t["ink2"], fontsize=18)
    source(fig, t, "Source: Alodi courier interviews (SPX, GHN, J&T, BEST, GHTK, Viettel Post), Oct 2026 — MOCK placeholder (06-survey)")
    save(fig, "07-problem-survey-couriers-MOCK", theme)


# ------------------------------------------------------------------ 8. the three output numbers (stat tiles)
def chart_tiles(theme):
    t = THEMES[theme]
    fig = frame(t, "What Alodi delivers, per area", "Money is projected; time and autonomy are measured in the demo and eval")
    tiles = [
        (f"{HEAD['net_month'] / 1e6:,.0f}M", "VND saved a month", f"{HEAD['net_pct']:.0%} of the loss · ≈\u00a0{B(HEAD['net_year'])} a year", "Projected"),
        ("6 s", "from the buyer’s answer to the courier’s card", "today the answer is said on the phone and lost", "Mock · measure in demo"),
        ("65%", "of failed deliveries resolved without a person", "0 calls out of hours · 0 labels without approval", "Mock · measure in eval"),
    ]
    for i, (big, lab, sub, tag) in enumerate(tiles):
        x = 0.06 + i * 0.30
        fig.patches.append(FancyBboxPatch((x, 0.22), 0.27, 0.52, boxstyle="round,pad=0,rounding_size=0.02",
                                          transform=fig.transFigure, figure=fig, fc=t["track"], ec="none"))
        fig.text(x + 0.025, 0.66, tag.upper(), color=t["orange"] if i == 0 else t["ink2"], fontsize=13, family="Geist Mono")
        fig.text(x + 0.025, 0.48, big, color=t["ink"], fontsize=64, fontweight=600)
        fig.text(x + 0.025, 0.42, "\n".join(textwrap.wrap(lab, 30)), color=t["ink"], fontsize=17, va="top", linespacing=1.35)
        fig.text(x + 0.025, 0.30, "\n".join(textwrap.wrap(sub, 38)), color=t["ink2"], fontsize=13.5, va="top", linespacing=1.35)
    source(fig, t, "Money: PRD §18.8 (Shopee §7.1, VECOM, Shipsy best-in-class, GHN, Glints). Time-to-context and autonomy: targets until the eval run replaces them")
    save(fig, "08-output-three-numbers", theme)


if __name__ == "__main__":
    for th in THEMES:
        for fn in (chart_refusal, chart_loss, chart_before_after, chart_scenarios, chart_cost_share, chart_survey, chart_couriers, chart_tiles):
            fn(th)
    print(sorted(p.name for p in OUT.glob("*.png")))
