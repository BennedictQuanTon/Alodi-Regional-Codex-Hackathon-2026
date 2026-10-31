"""Alodi cost vs loss model for one area / hub (20 couriers, 4,000 orders a day).

Compares two ways to run Alodi in production:
  * local_first  — one on-prem server per hub (one-time purchase), open-weight models run locally
                   (OpenAI gpt-oss-20b as a fallback, VinAI PhoWhisper); OpenAI GPT-Live-1, Decisions API (GPT-6 Luna) and GPT-5.6 Terra in the cloud;
                   AWS only for encrypted off-site backup.
  * aws_managed  — the earlier design: dedicated Multi-AZ stack on AWS + Bedrock/Transcribe/Connect.

Usage:  python3 -I cost_model.py        (prints tables, writes cost_model_output.json)
Each input carries a type: sourced | vendor | listed-price | estimate.  Sources are in PRD §18.8 and §30.
"""
import json
from pathlib import Path

FX = 26_000            # VND per USD (estimate)
DAYS = 30              # days per month
HOURS = 730            # hours per month

# ------------------------------------------------------------------ the hub
ORDERS_PER_DAY = 4_000                     # estimate (team sizing: one area, 20 couriers)
FAIL_RATE = 0.08                           # sourced: VECOM 8–12% (Nguoi Lao Dong, 19 Jul 2025) — low end
BASELINE_RESCUE = 0.25                     # vendor: Shipsy, industry rescue 20–30%
RETURN_FEE = 40_000                        # sourced: Shopee Return & Refund Policy §7.1 (11 Mar 2026)
EXTRA_ATTEMPTS = 1.5                       # estimate inside Shopee's 2–3 contact attempts (Help Center 79569)
COURIER_PAY_PER_ATTEMPT = (6_000, 8_000)   # sourced: GHN blog, courier earns ₫6–8k per order
COURIER_INCOME_MONTH = (8_000_000, 15_000_000)  # sourced: Glints VN, full-time courier ₫8–15M/month
COURIER_HOURS_MONTH = 26 * 9               # estimate: 26 days × 9 h
DOOR_MIN_PER_FAIL = 5                      # estimate: two calls + waiting at the door
CS_CALLS_PER_FAIL = 2                      # estimate (STATS §4: 2 calls × 4 min)
CS_MIN_PER_CALL = 4                        # estimate
CS_COST_HOUR = 35_000                      # estimate (team assumption, STATS / PRD §23.5)

SCENARIOS = {   # projected. Shipsy (vendor): industry rescue 20–30%, best-in-class 50–65%; outreach adds 15–30 points
    "conservative":  {"extra_rescue_pts": 0.15, "attempts_after": 1.50, "auto_share": 0.40},
    "base":          {"extra_rescue_pts": 0.20, "attempts_after": 1.35, "auto_share": 0.60},   # 0.60 = mock-day auto share
    "best_in_class": {"extra_rescue_pts": 0.40, "attempts_after": 1.20, "auto_share": 0.65},   # 25% → 65% rescue (HEADLINE)
}

# ------------------------------------------------------------------ usage per day (mock-data/expected-day-summary.json)
BILLED_CALL_MIN = 134         # ≤ 134 billed minutes (67 answered calls × 2 min)
LLM_TOKENS_IN, LLM_TOKENS_OUT = 6.0e6, 0.72e6
TERRA_SHARE = 0.20            # estimate: share of LLM traffic the Decisions API escalates to GPT-5.6 Terra
ZNS_PER_DAY = {"risky_only": 1_250, "all_orders": 6_110}   # 547 risky orders (high COD / failed before) + replies + 484 rescue messages

# ------------------------------------------------------------------ local-first: one-time hardware per hub (listed-price, VN retail)
HARDWARE = {
    "2 × NVIDIA RTX 5060 Ti 16 GB (Phong Vu, ₫16.4–21.0M each)": (32_800_000, 42_000_000),
    "Workstation: 12–16-core CPU, 64 GB RAM, 2 × 2 TB NVMe (RAID 1), 1000 W PSU, case": (35_000_000, 45_000_000),
    "UPS 1.5–2 kVA (online)": (5_000_000, 8_000_000),
    "4G/5G failover router": (2_000_000, 3_000_000),
}

# ------------------------------------------------------------------ local-first: monthly running cost (VND)
def local_first_month(msg_policy: str) -> dict:
    # OpenAI stack (listed prices, developers.openai.com, checked 31 Oct 2026):
    #   Decisions API on GPT-6 Luna triages every message: $0.10 per 1M input tokens, no output charge.
    #   GPT-5.6 Terra orchestrates the cases triage escalates (TERRA_SHARE of LLM traffic): $2 / $12 per 1M tokens.
    #   GPT-Live-1 runs the AI calls: $0.05 per session minute; its backend calls are the Terra share above.
    luna_usd = LLM_TOKENS_IN / 1e6 * 0.10 * DAYS
    terra_usd = TERRA_SHARE * (LLM_TOKENS_IN / 1e6 * 2.00 + LLM_TOKENS_OUT / 1e6 * 12.00) * DAYS
    live_usd = BILLED_CALL_MIN * 0.05 * DAYS
    sip = BILLED_CALL_MIN * DAYS * 780 + 50_000                    # Viettel Mobile SIP: ₫780/min off-net, ₫50k/month per line
    zns = ZNS_PER_DAY[msg_policy] * DAYS * 300                     # ZNS transactional template ≈ ₫300 (oazns.vn, worldfone)
    kwh = 0.35 * 24 * DAYS * 1.08                                  # ~350 W average + UPS loss
    power = kwh * 3_000                                            # EVN business tariff ≈ ₫2,666 normal / ₫5,025 peak → ₫3,000 blended
    return {
        "Decisions API on GPT-6 Luna (triage of every message)": luna_usd * FX,
        "GPT-5.6 Terra (orchestration, ~20% of LLM traffic after triage)": terra_usd * FX,
        "GPT-Live-1 (AI calls, $0.05 a minute)": live_usd * FX,
        "Local models: gpt-oss-20b fallback, PhoWhisper for memos": 0,
        "Viettel Mobile SIP trunk (calls + line)": sip,
        f"Zalo ZNS ({msg_policy.replace('_', ' ')})": zns,
        "Electricity (≈ 272 kWh)": power,
        "Business fibre with static IP": 800_000,                  # estimate
        "Off-site encrypted backup (Amazon S3, ~10 GB)": 2 * FX,   # listed-price, rounded up
        "Remote ops 0.1 FTE (shared across hubs)": 3_600_000,      # estimate
        "Hardware upkeep reserve (5% of hardware a year)": 0.05 * sum(sum(v) / 2 for v in HARDWARE.values()) / 12,
    }


# ------------------------------------------------------------------ AWS managed (earlier design, for comparison)
def aws_month(msg_policy: str) -> dict:
    platform_usd = 1_069                                   # 1-year commitment, PRD §18.8 (previous version)
    ai_usd = (6.0 * 1 + 0.72 * 5 + 100 * 0.024 + BILLED_CALL_MIN * 0.095 + 1.4) * DAYS
    return {
        "AWS platform (EKS, EC2, RDS Multi-AZ, …, 1-year commitment)": platform_usd * FX,
        "Bedrock + Transcribe + Connect + TTS": ai_usd * FX,
        f"Zalo ZNS ({msg_policy.replace('_', ' ')})": ZNS_PER_DAY[msg_policy] * DAYS * 300,
        "Ops 0.25 FTE": 9_000_000,
    }


# ------------------------------------------------------------------ loss and savings
def loss_month():
    failed = ORDERS_PER_DAY * FAIL_RATE
    returned = failed * (1 - BASELINE_RESCUE)
    hourly = tuple(i / COURIER_HOURS_MONTH for i in COURIER_INCOME_MONTH)
    items = {
        "Return fees paid by sellers": (returned * RETURN_FEE * DAYS,) * 2,
        "Courier pay for redelivery attempts": tuple(failed * EXTRA_ATTEMPTS * p * DAYS for p in COURIER_PAY_PER_ATTEMPT),
        "Courier time lost when the buyer doesn't answer": tuple(failed * DOOR_MIN_PER_FAIL / 60 * h * DAYS for h in hourly),
        "Hub / CS staff calling buyers back": (failed * CS_CALLS_PER_FAIL * CS_MIN_PER_CALL / 60 * CS_COST_HOUR * DAYS,) * 2,
    }
    total = (sum(v[0] for v in items.values()), sum(v[1] for v in items.values()))
    return {"failed_per_day": failed, "returned_per_day": returned, "items": items, "total": total}


def savings_month(s):
    failed = ORDERS_PER_DAY * FAIL_RATE
    hourly_mid = sum(COURIER_INCOME_MONTH) / 2 / COURIER_HOURS_MONTH
    attempts_saved = failed * (EXTRA_ATTEMPTS - s["attempts_after"])
    items = {
        "Return fees avoided": failed * s["extra_rescue_pts"] * RETURN_FEE * DAYS,
        "Redelivery attempts avoided": attempts_saved * sum(COURIER_PAY_PER_ATTEMPT) / 2 * DAYS,
        "Courier door time saved": attempts_saved * DOOR_MIN_PER_FAIL / 60 * hourly_mid * DAYS,
        "CS calls handled by the agent": failed * CS_CALLS_PER_FAIL * CS_MIN_PER_CALL / 60 * CS_COST_HOUR * s["auto_share"] * DAYS,
    }
    return {"items": items, "total": sum(items.values())}


def run():
    L = loss_month()
    loss_mid = sum(L["total"]) / 2
    hw = (sum(v[0] for v in HARDWARE.values()), sum(v[1] for v in HARDWARE.values()))
    out = {"loss": L, "loss_mid": loss_mid, "hardware_one_time": hw, "rows": []}
    for setup, fn in (("local_first", local_first_month), ("aws_managed", aws_month)):
        for msg in ("risky_only", "all_orders"):
            cost_items = fn(msg)
            cost = sum(cost_items.values())
            for name, s in SCENARIOS.items():
                S = savings_month(s)
                out["rows"].append({
                    "setup": setup, "messaging": msg, "scenario": name,
                    "cost_items": cost_items, "cost_month": cost,
                    "saving_items": S["items"], "gross_month": S["total"],
                    "gross_pct": S["total"] / loss_mid,
                    "net_month": S["total"] - cost, "net_pct": (S["total"] - cost) / loss_mid,
                    "net_year": (S["total"] - cost) * 12,
                    "hardware_payback_months": (sum(hw) / 2) / (S["total"] - cost) if setup == "local_first" and S["total"] > cost else None,
                })
    return out


if __name__ == "__main__":
    r = run()
    Path(__file__).with_name("cost_model_output.json").write_text(json.dumps(r, indent=2, ensure_ascii=False))
    M = lambda v: f"₫{v / 1e6:,.1f}M"
    L = r["loss"]
    print("failed/day", L["failed_per_day"], "returned/day", L["returned_per_day"])
    for k, v in L["items"].items():
        print(f"  loss  {k:52} {M(v[0])} – {M(v[1])}")
    print(f"  LOSS / month {M(L['total'][0])} – {M(L['total'][1])}  mid {M(r['loss_mid'])}  year {M(r['loss_mid'] * 12)}")
    print("hardware one-time", [M(x) for x in r["hardware_one_time"]])
    for x in r["rows"]:
        if x["scenario"] == "best_in_class":
            print(f"\n{x['setup']} / {x['messaging']}: cost {M(x['cost_month'])}")
            for k, v in x["cost_items"].items():
                print(f"    {k:70} {M(v)}")
    print()
    for x in r["rows"]:
        pb = x["hardware_payback_months"]
        print(f"{x['setup']:12} {x['messaging']:10} {x['scenario']:12} gross {M(x['gross_month'])} ({x['gross_pct']:.1%}) "
              f"cost {M(x['cost_month'])} net {M(x['net_month'])} ({x['net_pct']:.1%}) year {M(x['net_year'])}"
              + (f" hw payback {pb:.1f} mo" if pb else ""))
    b = next(x for x in r["rows"] if x["setup"] == "local_first" and x["messaging"] == "risky_only" and x["scenario"] == "best_in_class")
    for k, v in b["saving_items"].items():
        print(f"  saving {k:40} {M(v)}")
