"""Build web/src/lib/dash/hub-day.ts from prep/02-technical/mock-data (fictional hub)."""
import collections
import json
import sys
from pathlib import Path

MOCK = Path(sys.argv[1])
OUT = Path(sys.argv[2])

hub = json.loads((MOCK / "hub.json").read_text())
summary = json.loads((MOCK / "expected-day-summary.json").read_text())
plan = json.loads((MOCK / "day-plan.json").read_text())
orders = {o["tracking_id"]: o for o in json.loads((MOCK / "orders.json").read_text())}
couriers = json.loads((MOCK / "couriers.json").read_text())
by_route = {c["route_id"]: c for c in couriers}

routes = collections.OrderedDict()
for c in couriers:
    routes[c["route_id"]] = dict(route=c["route_id"], courier=c["name"], ward=c["ward"], orders=0, delivered=0,
                                 a=0, b=0, refused=0, rescued=0, cs=0, windows=0)
hours = collections.OrderedDict((f"{h:02d}", dict(h=f"{h:02d}", a=0, b=0, refused=0)) for h in range(8, 21))
queue = []
TERMINAL_RESCUED = {"auto_applied", "confirmed_in_chat"}

for r in plan:
    o = orders[r["tracking_id"]]
    row = routes[o["route_id"]]
    row["orders"] += 1
    if (r.get("morning") or {}).get("answer_type") == "windows":
        row["windows"] += 1
    fa = r.get("first_attempt")
    if fa == "DELIVERED":
        row["delivered"] += 1
    elif fa in ("A", "B", "C"):
        key = {"A": "a", "B": "b", "C": "refused"}[fa]
        row[key] += 1
        hours[r["attempt_at"][11:13]][key] += 1
        end = r["path"][-1]
        if end in TERMINAL_RESCUED:
            row["rescued"] += 1
        if end.startswith("with_cs") or end == "cs_review":
            row["cs"] += 1
            if len(queue) < 400:
                queue.append(dict(
                    id=o["tracking_id"], buyer=o["buyer_name"], ward=o["district"], item=o["item"], cod=o["cod_amount"],
                    route=o["route_id"], courier=by_route[o["route_id"]]["name"], at=r["attempt_at"][11:16],
                    reason={"with_cs:refused": "Refused at door", "with_cs:unreachable": "Unreachable after 2 calls",
                            "cs_review": "Low confidence"}[end],
                    tap={"A": "No answer", "B": "Rescheduled", "C": "Refused"}[fa],
                ))

queue.sort(key=lambda q: q["at"], reverse=True)

ts = f"""// Generated from prep/02-technical/mock-data (fixed seed 31102026). Fictional hub, not real data.
// Regenerate: python3 -I prep/02-technical/mock-data/export_dashboard.py prep/02-technical/mock-data web/src/lib/dash/hub-day.ts

export const HUB = {json.dumps(dict(id=hub["hub_id"], name=hub["name"].replace(" (fictional)", ""), date=hub["date"], couriers=hub["couriers"], wards=hub["service_area_wards"], morningRun=hub["morning_run"], cutoff=hub["route_cutoff"], callHours=hub["call_hours"]), ensure_ascii=False)} as const;

export const DAY = {json.dumps({k: v for k, v in summary.items() if k != "note"}, ensure_ascii=False)} as const;

export type RouteRow = {{ route: string; courier: string; ward: string; orders: number; delivered: number; a: number; b: number; refused: number; rescued: number; cs: number; windows: number }};
export const ROUTES: RouteRow[] = {json.dumps(list(routes.values()), ensure_ascii=False)};

export const FAILS_BY_HOUR = {json.dumps(list(hours.values()))};

export type QueueRow = {{ id: string; buyer: string; ward: string; item: string; cod: number; route: string; courier: string; at: string; reason: string; tap: string }};
export const CS_QUEUE: QueueRow[] = {json.dumps(queue, ensure_ascii=False)};
"""
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(ts)
print(len(queue), sum(r["orders"] for r in routes.values()))
