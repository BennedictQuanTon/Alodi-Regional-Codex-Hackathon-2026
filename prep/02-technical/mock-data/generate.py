"""Generate the Alodi mock data pack (fictional) for one hub: 20 couriers, 4,000 orders a day.

Usage: python3 -I generate.py .   (run from prep/02-technical/mock-data)
Deterministic (fixed seed) so the PRD numbers and the files always agree.
"""
import csv
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
R = random.Random(31102026)

DAY = "2026-10-31"  # Saturday
TOMORROW = "2026-11-01"
TZ = "+07:00"
WINDOWS = [
    {"id": "W1", "from": "08:00", "to": "10:00", "label": "08:00–10:00"},
    {"id": "W2", "from": "10:00", "to": "12:00", "label": "10:00–12:00"},
    {"id": "W3", "from": "14:00", "to": "17:00", "label": "14:00–17:00"},
    {"id": "W4", "from": "17:00", "to": "20:00", "label": "17:00–20:00"},
]
WARDS = ["Binh Thanh", "Gia Dinh", "Thanh My Tay", "Binh Loi Trung"]
STREETS = {
    "Binh Thanh": ["Xo Viet Nghe Tinh", "Dien Bien Phu", "Bach Dang", "No Trang Long", "Ung Van Khiem"],
    "Gia Dinh": ["Phan Dang Luu", "Le Quang Dinh", "Phan Van Tri", "Hoang Hoa Tham"],
    "Thanh My Tay": ["Nguyen Huu Canh", "Ngo Tat To", "Nguyen Van Thuong", "D2"],
    "Binh Loi Trung": ["Nguyen Xi", "Dinh Bo Linh", "Bui Dinh Tuy", "Chu Van An"],
}
BUILDINGS = ["Tower A", "Tower B", "Block C", "Block 2"]
SURNAMES = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vo", "Dang", "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Truong", "Phan"]
GIVEN = ["Minh", "Tram", "Bao", "Lien", "Huy", "Ha", "Khoa", "Ngoc", "Tai", "Anh", "Linh", "Quang", "Thu", "Phuong", "Nam",
         "Trang", "Duc", "Mai", "Son", "Vy", "Hieu", "Thao", "Long", "Hanh", "Tuan", "Yen", "Khanh", "Loan", "Dat", "Nhi"]
ITEMS = [("6L air fryer", 1290000), ("Phone case", 89000), ("Running shoes", 790000), ("Skincare set", 450000),
         ("Bluetooth earbuds", 590000), ("Rice cooker", 990000), ("Baby formula 900g", 620000), ("T-shirt x3", 249000),
         ("Desk lamp", 320000), ("Mechanical keyboard", 1450000), ("Water bottle", 159000), ("Backpack", 540000),
         ("Vitamin C", 210000), ("Robot vacuum", 3200000), ("Book bundle", 280000), ("Phone charger", 180000)]
CANT_REASONS = ["Out of town until Monday", "Working a night shift today", "Family event all day",
                "In hospital with my mother", "Moving house today", "On a business trip"]
COURIERS = ["Tuan Nguyen", "Hoa Le", "Long Vu", "Phat Ho", "An Tran", "Binh Pham", "Cuong Do", "Dung Ngo",
            "Hai Bui", "Hieu Dang", "Kiet Vo", "Lam Truong", "Loc Phan", "Nhan Ly", "Phuc Duong", "Quan Ho",
            "Sang Nguyen", "Thinh Le", "Vinh Tran", "Vu Hoang"]


def ts(day, hhmm):
    return f"{day}T{hhmm}:00{TZ}"


def at(day, minutes):
    d = datetime.fromisoformat(f"{day}T00:00:00") + timedelta(minutes=minutes)
    return d.strftime("%Y-%m-%dT%H:%M:00") + TZ


# ---------- hub, couriers, windows ----------
hub = {
    "hub_id": "HCM-BTH-01",
    "name": "Binh Thanh hub (fictional)",
    "city": "Ho Chi Minh City",
    "service_area_wards": WARDS,
    "date": DAY,
    "couriers": 20,
    "orders": 4000,
    "stops_per_route": 200,
    "morning_run": "06:30",
    "route_cutoff": "08:00",
    "call_hours": "08:00–20:30",
    "note": "Fictional hub. Ward names follow the HCMC ward-level structure in force since 1 July 2025; addresses, people and phone numbers are invented.",
}
couriers = []
for i, name in enumerate(COURIERS, start=1):
    couriers.append({
        "courier_id": f"C{i:02d}",
        "name": name,
        "route_id": f"HCM-BTH-R{i:02d}",
        "ward": WARDS[(i - 1) % len(WARDS)],
        "vehicle": "motorbike",
        "shift": "08:00–20:30",
        "device": "demo phone /courier" if i == 7 else "simulated",
    })
# Persona Tuan drives R07 in the live demo.
couriers[0]["name"], couriers[6]["name"] = couriers[6]["name"], couriers[0]["name"]

# ---------- scripted demo cases (route R07) ----------
DEMO = [
    {"scenario": "A_main", "tracking_id": "SPXVN0123456789", "buyer_name": "Minh Hoang", "stop_index": 37,
     "address": "Unit 12.08, Tower B, Sky Garden, 205 Nguyen Xi", "ward": "Binh Loi Trung", "item": "6L air fryer",
     "cod_amount": 1290000, "risk_flags": ["high_cod"]},
    {"scenario": "B_memo", "tracking_id": "SPXVN0123451120", "buyer_name": "Lien Pham", "stop_index": 41,
     "address": "Unit 5.03, Tower A, River View, 92 Nguyen Huu Canh", "ward": "Thanh My Tay", "item": "Skincare set",
     "cod_amount": 0, "risk_flags": []},
    {"scenario": "REFUSE", "tracking_id": "SPXVN0123450333", "buyer_name": "Huy Dang", "stop_index": 44,
     "address": "18/4 Phan Van Tri", "ward": "Gia Dinh", "item": "Mechanical keyboard",
     "cod_amount": 1490000, "risk_flags": ["high_cod", "refused_before"]},
    {"scenario": "A_lowconf", "tracking_id": "SPXVN0123457781", "buyer_name": "Bao Tran", "stop_index": 52,
     "address": "77 Dinh Bo Linh", "ward": "Binh Loi Trung", "item": "Robot vacuum",
     "cod_amount": 2150000, "risk_flags": ["high_cod"]},
    {"scenario": "A_noanswer", "tracking_id": "SPXVN0123458845", "buyer_name": "Tai Do", "stop_index": 58,
     "address": "Block 2, 31 Bach Dang", "ward": "Binh Thanh", "item": "Bluetooth earbuds",
     "cod_amount": 420000, "risk_flags": []},
    {"scenario": "A_midway", "tracking_id": "SPXVN0123452290", "buyer_name": "Ha Vo", "stop_index": 63,
     "address": "Unit 9.11, Block C, 12 Ung Van Khiem", "ward": "Binh Thanh", "item": "Rice cooker",
     "cod_amount": 650000, "risk_flags": []},
    {"scenario": "CANT_TODAY", "tracking_id": "SPXVN0123459012", "buyer_name": "Tram Nguyen", "stop_index": 70,
     "address": "140 Le Quang Dinh", "ward": "Gia Dinh", "item": "Baby formula 900g",
     "cod_amount": 389000, "risk_flags": []},
]
demo_by_route_stop = {("HCM-BTH-R07", d["stop_index"]): d for d in DEMO}

# ---------- orders + day plan ----------
orders, plan = [], []
counter = 0
summary = {
    "orders": 0, "window_questions_sent": 0,
    "morning": {"windows": 0, "cannot_today": 0, "no_reply": 0},
    "attempted_today": 0, "delivered_first_attempt": 0,
    "failed_first_attempt": {"A": 0, "B": 0, "C": 0},
    "flow_a": {"chat_sent": 0, "replied_in_chat": 0, "call_1": 0, "call_1_answered": 0, "call_2": 0,
               "call_2_answered": 0, "unreachable_to_cs": 0, "calls_moved_to_next_morning": 0},
    "flow_b": {"memos": 0},
    "extraction": {"auto_applied": 0, "confirmed_in_chat": 0, "cs_review": 0},
    "opt_out": 0,
    "cs_queue": {"refused": 0, "unreachable": 0, "low_confidence": 0, "total": 0},
    "rescheduled_with_card": 0,
    "messages_sent": 0, "call_minutes_answered": 0.0, "memo_seconds": 0,
}


def extraction_outcome(p_auto, p_confirm):
    r = R.random()
    if r < p_auto:
        return "auto_applied"
    if r < p_auto + p_confirm:
        return "confirmed_in_chat" if R.random() < 0.7 else "cs_review"
    return "cs_review"


for c in couriers:
    for stop in range(1, 201):
        demo = demo_by_route_stop.get((c["route_id"], stop))
        if demo:
            tid = demo["tracking_id"]
            name, address, ward = demo["buyer_name"], demo["address"], demo["ward"]
            item, cod, flags = demo["item"], demo["cod_amount"], demo["risk_flags"]
        else:
            counter += 1
            tid = f"SPXVN26{counter:08d}"
            name = f"{R.choice(GIVEN)} {R.choice(SURNAMES)}"
            ward = c["ward"] if R.random() < 0.8 else R.choice(WARDS)
            if R.random() < 0.35:
                address = f"Unit {R.randint(2, 25)}.{R.randint(1, 20):02d}, {R.choice(BUILDINGS)}, {R.randint(1, 300)} {R.choice(STREETS[ward])}"
            else:
                address = f"{R.randint(1, 300)}/{R.randint(1, 40)} {R.choice(STREETS[ward])}"
            item, price = R.choice(ITEMS)
            cod = price if R.random() < 0.6 else 0
            flags = []
            if cod >= 1000000:
                flags.append("high_cod")
            if R.random() < 0.04:
                flags.append("failed_before")
        orders.append({
            "tracking_id": tid,
            "buyer_name": name,
            "buyer_phone": f"TEST-{len(orders) + 1:04d}",
            "buyer_phone_masked": f"TEST *** {len(orders) + 1:04d}",
            "address": address,
            "district": ward,
            "item": item,
            "cod_amount": cod,
            "route_id": c["route_id"],
            "stop_index": stop,
            "risk_flags": flags,
            "delivery_date": DAY,
            "attempt_count": 0,
            "status": "scheduled",
        })

        # ---- simulated behaviour (non-demo orders) ----
        if demo:
            plan.append({"tracking_id": tid, "scenario": demo["scenario"], "scripted": True})
            continue
        summary["orders"] += 1
        summary["window_questions_sent"] += 1
        summary["messages_sent"] += 1
        p = {"tracking_id": tid, "scripted": False}
        r = R.random()
        if r < 0.35:
            picks = sorted(R.sample([w["id"] for w in WINDOWS], R.choice([2, 2, 3])))
            p["morning"] = {"answer_type": "windows", "windows": picks}
            summary["morning"]["windows"] += 1
            summary["messages_sent"] += 1  # confirmation
            p_fail = 0.05
        elif r < 0.40:
            p["morning"] = {"answer_type": "cannot_today", "reason": R.choice(CANT_REASONS)}
            summary["morning"]["cannot_today"] += 1
            summary["messages_sent"] += 1
            p["outcome"] = "moved_tomorrow"
            plan.append(p)
            continue
        else:
            p["morning"] = {"answer_type": "no_reply"}
            summary["morning"]["no_reply"] += 1
            p_fail = 0.12
        summary["attempted_today"] += 1
        # stop time: route runs 08:30–19:30, linear in stop index with noise
        stop_min = 8 * 60 + 30 + int((stop - 1) * 3.3) + R.randint(-6, 6)
        p["attempt_at"] = at(DAY, stop_min)
        if R.random() >= p_fail:
            p["first_attempt"] = "DELIVERED"
            summary["delivered_first_attempt"] += 1
            plan.append(p)
            continue
        btn = R.choices(["A", "B", "C"], weights=[60, 25, 15])[0]
        p["first_attempt"] = btn
        summary["failed_first_attempt"][btn] += 1
        commit = stop_min + 2
        if btn == "C":
            p["path"] = ["pending_2min", "with_cs:refused"]
            summary["cs_queue"]["refused"] += 1
            plan.append(p)
            continue
        if btn == "B":
            secs = R.randint(5, 10)
            summary["flow_b"]["memos"] += 1
            summary["memo_seconds"] += secs
            out = extraction_outcome(0.85, 0.12)
            p["path"] = ["pending_2min", f"memo_{secs}s", "asr", "extract", out]
        else:
            summary["flow_a"]["chat_sent"] += 1
            summary["messages_sent"] += 1
            path = ["pending_2min", "chat_sent"]
            if R.random() < 0.01:
                path.append("opt_out")
                summary["opt_out"] += 1
                p["path"] = path
                plan.append(p)
                continue
            source = None
            if R.random() < 0.40:
                path.append("replied_in_chat")
                summary["flow_a"]["replied_in_chat"] += 1
                source = "chat"
            else:
                due = commit + 60
                if due > 20 * 60 + 30:
                    summary["flow_a"]["calls_moved_to_next_morning"] += 1
                    path.append("call_1_moved_to_08:00_next_day")
                summary["flow_a"]["call_1"] += 1
                if R.random() < 0.45:
                    summary["flow_a"]["call_1_answered"] += 1
                    summary["call_minutes_answered"] += R.uniform(1.0, 1.6)
                    path.append("call_1_answered")
                    source = "ai_call"
                else:
                    summary["flow_a"]["call_2"] += 1
                    path.append("call_1_missed")
                    if R.random() < 0.35:
                        summary["flow_a"]["call_2_answered"] += 1
                        summary["call_minutes_answered"] += R.uniform(1.0, 1.6)
                        path.append("call_2_answered")
                        source = "ai_call"
                    else:
                        path.append("call_2_missed")
                        path.append("with_cs:unreachable")
                        summary["flow_a"]["unreachable_to_cs"] += 1
                        summary["cs_queue"]["unreachable"] += 1
            if source:
                out = extraction_outcome(0.80 if source == "ai_call" else 0.82, 0.15)
                path += ["extract", out]
            p["path"] = path
            out = path[-1] if source else None
        if out:
            summary["extraction"][out] += 1
            if out == "confirmed_in_chat":
                summary["messages_sent"] += 2
            if out == "cs_review":
                summary["cs_queue"]["low_confidence"] += 1
            else:
                summary["rescheduled_with_card"] += 1
                summary["messages_sent"] += 1  # confirmation
        plan.append(p)

summary["cs_queue"]["total"] = sum(v for k, v in summary["cs_queue"].items() if k != "total")
summary["failed_first_attempt"]["total"] = sum(summary["failed_first_attempt"][k] for k in "ABC")
summary["call_minutes_answered"] = round(summary["call_minutes_answered"], 1)
summary["calls_placed"] = summary["flow_a"]["call_1"] + summary["flow_a"]["call_2"]
summary["scripted_demo_orders"] = len(DEMO)
summary["note"] = "Simulated with fixed seed 31102026. Rates are team assumptions for testing, not measurements."

# ---------- demo cases with expectations ----------
demo_cases = [
    {
        "scenario": "A_main", "title": "No answer → AI call 1 answered → auto-applied → delivered next day",
        "tracking_id": "SPXVN0123456789",
        "steps": [
            {"clock": ts(DAY, "06:30"), "actor": "system", "do": "morning_load", "expect_ws": {"ops": "orders_loaded 4000 · 4 windows"}},
            {"clock": ts(DAY, "06:32"), "actor": "agent", "do": "ask_window", "expect_ws": {"buyer": "chat_message with 4 windows + Can't receive today"}},
            {"clock": ts(DAY, "08:00"), "actor": "system", "do": "route_cutoff", "expect": "answer_type=no_reply, deliver as planned"},
            {"clock": ts(DAY, "10:02"), "actor": "courier", "do": "tap A", "expect_ws": {"ops": "event_pending commit_at 10:04"}},
            {"clock": ts(DAY, "10:04"), "actor": "system", "do": "commit", "expect_ws": {"buyer": "chat 'We just missed you…'", "ops": "timer AI call 1 due 11:04"}},
            {"clock": ts(DAY, "11:04"), "actor": "agent", "do": "place_call attempt=1", "expect": "policy_check call_hours ok, calls 1/2"},
            {"clock": ts(DAY, "11:05"), "actor": "buyer", "do": "speak utterance A_main.call", "expect_ws": {"ops": "transcript + extraction"}},
            {"clock": ts(DAY, "11:05"), "actor": "agent", "do": "extract", "expect": {"time_window": [TOMORROW, "17:00", "20:00", 0.94], "drop_location": ["security_desk", "Tower B security", 0.88], "alt_receiver": ["wife", 0.91], "decision": "auto_applied"}},
            {"clock": ts(DAY, "11:05"), "actor": "agent", "do": "save + push card", "expect_ws": {"courier": "context_card", "ops": "attempt 1 of 2"}},
            {"clock": ts(TOMORROW, "17:22"), "actor": "courier", "do": "tap DELIVERED", "expect": "order delivered, case closed"},
        ],
    },
    {
        "scenario": "B_memo", "title": "Answered but rescheduled → courier memo → card",
        "tracking_id": "SPXVN0123451120",
        "steps": [
            {"clock": ts(DAY, "10:40"), "actor": "courier", "do": "tap B", "expect_ws": {"ops": "event_pending"}},
            {"clock": ts(DAY, "10:41"), "actor": "courier", "do": "record memo utterance B_memo.memo (9 s)"},
            {"clock": ts(DAY, "10:42"), "actor": "system", "do": "commit + ASR + mask + extract", "expect": {"time_window": [TOMORROW, "08:00", "10:00", 0.93], "drop_location": ["reception", "Tower A reception", 0.9], "decision": "auto_applied"}},
            {"clock": ts(DAY, "10:42"), "actor": "agent", "do": "push card", "expect_ws": {"courier": "context_card"}},
        ],
    },
    {
        "scenario": "REFUSE", "title": "Refused at the door → no contact → CS approves return",
        "tracking_id": "SPXVN0123450333",
        "steps": [
            {"clock": ts(DAY, "11:10"), "actor": "courier", "do": "tap C"},
            {"clock": ts(DAY, "11:12"), "actor": "system", "do": "commit", "expect": "policy_block on any contact; case_escalated reason=refused; suggested_label='suspected bomb' (not applied)"},
            {"clock": ts(DAY, "11:13"), "actor": "cs", "do": "approve_label + return", "expect": "label set by cs:lan; audit event with CS name"},
        ],
    },
    {
        "scenario": "A_lowconf", "title": "Vague answer → confirm in chat → CS picks the window",
        "tracking_id": "SPXVN0123457781",
        "steps": [
            {"clock": ts(DAY, "12:20"), "actor": "courier", "do": "tap A"},
            {"clock": ts(DAY, "13:22"), "actor": "agent", "do": "place_call attempt=1"},
            {"clock": ts(DAY, "13:23"), "actor": "buyer", "do": "speak utterance A_lowconf.call", "expect": {"time_window_conf": 0.52, "drop_location_conf": 0.41, "decision": "confirm_in_chat"}},
            {"clock": ts(DAY, "13:24"), "actor": "agent", "do": "send_chat with 2 concrete windows"},
            {"clock": ts(DAY, "13:54"), "actor": "system", "do": "no clear answer → needs_review", "expect_ws": {"ops": "CS queue reason low_confidence"}},
            {"clock": ts(DAY, "14:00"), "actor": "cs", "do": "apply 14:00–17:00 tomorrow", "expect": "decision cs_applied, card pushed"},
        ],
    },
    {
        "scenario": "A_noanswer", "title": "Two missed calls → CS, hotline routing on",
        "tracking_id": "SPXVN0123458845",
        "steps": [
            {"clock": ts(DAY, "14:30"), "actor": "courier", "do": "tap A"},
            {"clock": ts(DAY, "15:32"), "actor": "agent", "do": "place_call attempt=1", "expect": "missed after 30 s"},
            {"clock": ts(DAY, "17:32"), "actor": "agent", "do": "place_call attempt=2", "expect": "missed"},
            {"clock": ts(DAY, "17:33"), "actor": "system", "do": "escalate", "expect": "case_escalated reason=two_calls_unanswered; no third call possible"},
        ],
    },
    {
        "scenario": "A_midway", "title": "Buyer replies before call 1 → pending call cancelled",
        "tracking_id": "SPXVN0123452290",
        "steps": [
            {"clock": ts(DAY, "15:10"), "actor": "courier", "do": "tap A"},
            {"clock": ts(DAY, "15:12"), "actor": "system", "do": "commit + chat", "expect_ws": {"ops": "timer AI call 1 due 16:12"}},
            {"clock": ts(DAY, "15:52"), "actor": "buyer", "do": "chat utterance A_midway.chat", "expect": "timer cancelled; extraction time_window 0.92, drop_location null → confirm in chat"},
            {"clock": ts(DAY, "15:53"), "actor": "buyer", "do": "tap 'Hand it to me'", "expect": "auto_applied; card pushed"},
        ],
    },
    {
        "scenario": "CANT_TODAY", "title": "Morning answer: can't receive today → moved to tomorrow",
        "tracking_id": "SPXVN0123459012",
        "steps": [
            {"clock": ts(DAY, "06:32"), "actor": "agent", "do": "ask_window"},
            {"clock": ts(DAY, "06:47"), "actor": "buyer", "do": "tap Can't receive today + reason 'Out of town until Monday'", "expect": "order moved to 2026-11-02 (Mon), reason saved, stop removed from today's route"},
        ],
    },
]

utterances = {
    "A_main": {
        "call": {"en": "Tomorrow after five, please. I'm out until late, so leave it with security in Tower B. Or call my wife.",
                 "vi": "Mai sau năm giờ chiều nha em. Chị đi làm về trễ, em gửi bảo vệ tòa B giùm chị, không thì gọi vợ anh."},
        "gold": {"time_window": {"date": TOMORROW, "from": "17:00", "to": "20:00"}, "drop_location": {"type": "security_desk", "note": "Tower B security"}, "alt_receiver": {"relation": "wife"}, "address_correction": None, "cannot_receive": None, "opt_out": False},
    },
    "B_memo": {
        "memo": {"en": "She wants tomorrow before ten, leave it at Tower A reception.",
                 "vi": "Khách hẹn sáng mai trước mười giờ, gửi lễ tân tòa A."},
        "gold": {"time_window": {"date": TOMORROW, "from": "08:00", "to": "10:00"}, "drop_location": {"type": "reception", "note": "Tower A reception"}, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False},
    },
    "A_lowconf": {
        "call": {"en": "Maybe in the afternoon… or tonight, anywhere is fine I guess.",
                 "vi": "Chắc buổi chiều… hoặc tối, để đâu cũng được em."},
        "gold": {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False},
    },
    "A_midway": {
        "chat": {"en": "after 5 tomorrow", "vi": "mai sau 5h nha"},
        "gold": {"time_window": {"date": TOMORROW, "from": "17:00", "to": "20:00"}, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False},
    },
    "CANT_TODAY": {
        "chat": {"en": "Out of town until Monday", "vi": "Em đi công tác tới thứ hai mới về"},
        "gold": {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": {"reason": "Out of town until Monday"}, "opt_out": False},
    },
    "agent_lines": {
        "window_question": "Hi {first_name}, your {item} arrives today. Pick at least two windows that work, or tell us you can't receive today.",
        "rescue_chat": "We just missed you. When and where should we come back?",
        "call_greeting": "Hello, this is the automated delivery assistant calling about your {item}. This call is recorded so we get the delivery right — is that okay?",
        "call_ask": "Our courier missed you this morning. Tomorrow we have 8 to 10, 10 to 12, 2 to 5, or 5 to 8 in the evening. Which works for you?",
        "call_confirm": "Confirming: {window}, {drop}{alt}. Is that right?",
        "confirm_in_chat": "Just to be sure — which works better: {w1} or {w2}?",
        "confirmation": "Got it: {window}, {drop}. Reply “change” anytime.",
        "opt_out_ack": "Understood. We won't contact you again about this order.",
    },
}

# ---------- eval starter set (templated + hand-written hard cases) ----------
TIMES = [
    ("chiều mai sau 5h", "after 5 pm tomorrow", TOMORROW, "17:00", "20:00"),
    ("sáng mai trước 10 giờ", "tomorrow before 10", TOMORROW, "08:00", "10:00"),
    ("mai tầm 10 đến 12h trưa", "tomorrow 10 to 12", TOMORROW, "10:00", "12:00"),
    ("chiều mai từ 2h tới 5h", "tomorrow 2 to 5 pm", TOMORROW, "14:00", "17:00"),
    ("thứ hai buổi sáng", "Monday morning", "2026-11-02", "08:00", "12:00"),
    ("chiều thứ ba sau 3 giờ", "Tuesday after 3 pm", "2026-11-03", "15:00", "20:00"),
    ("tối nay sau 6h", "tonight after 6", DAY, "18:00", "20:00"),
]
DROPS = [
    ("gửi bảo vệ tòa B", "leave it with Tower B security", "security_desk", "Tower B security"),
    ("để ở lễ tân sảnh A", "leave it at the lobby A reception", "reception", "Lobby A reception"),
    ("gửi hàng xóm phòng 1205", "give it to the neighbour in 1205", "neighbour", "Neighbour, unit 1205"),
    ("bỏ tủ locker dưới sảnh", "put it in the lobby locker", "locker", "Lobby locker"),
    ("đưa tận tay chị", "hand it to me", "hand_to_buyer", "Hand to buyer"),
]
ALTS = [
    ("không có thì gọi vợ anh", "or call my wife", "wife"),
    ("hoặc gọi chồng chị", "or call my husband", "husband"),
    ("mẹ em ở nhà nhận giùm", "my mother is home to receive it", "mother"),
    ("", "", None),
]
eval_rows = []
sid = 0
for ti, t in enumerate(TIMES):
    for di, d in enumerate(DROPS):
        a = ALTS[(ti + di) % len(ALTS)]
        source = ["chat", "call", "memo"][(ti * 5 + di) % 3]
        vi = f"{t[0]}, {d[0]}" + (f", {a[0]}" if a[0] else "")
        if source == "memo":
            vi = "Khách hẹn " + vi
        sid += 1
        eval_rows.append({
            "id": f"S{sid:03d}", "source": source, "split": "dev", "kind": "templated", "text_vi": vi,
            "text_en": f"{t[1]}, {d[1]}" + (f", {a[1]}" if a[1] else ""),
            "gold": {"time_window": {"date": t[2], "from": t[3], "to": t[4]},
                     "drop_location": {"type": d[2], "note": d[3]},
                     "alt_receiver": {"relation": a[2]} if a[2] else None,
                     "address_correction": None, "cannot_receive": None, "opt_out": False},
        })
HARD = [
    ("chat", "Đừng nhắn nữa, tôi không nhận đâu", "Stop texting me, I won't take it",
     {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": True}),
    ("chat", "stop", "stop",
     {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": True}),
    ("call", "Mai chị về quê rồi, thứ hai giao lại nha, buổi chiều", "I'm going home tomorrow, deliver Monday afternoon",
     {"time_window": {"date": "2026-11-02", "from": "14:00", "to": "17:00"}, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False}),
    ("chat", "Em chuyển nhà rồi, giao qua 45 Phan Đăng Lưu giùm em, chiều mai", "I've moved, deliver to 45 Phan Dang Luu, tomorrow afternoon",
     {"time_window": {"date": TOMORROW, "from": "14:00", "to": "17:00"}, "drop_location": None, "alt_receiver": None, "address_correction": {"text": "45 Phan Dang Luu", "same_district": False}, "cannot_receive": None, "opt_out": False}),
    ("call", "Sáng mai hoặc chiều mai đều được, à mà thôi tối đi", "Tomorrow morning or afternoon, actually no, evening",
     {"time_window": {"date": TOMORROW, "from": "17:00", "to": "20:00"}, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False}),
    ("chat", "để đâu cũng được", "leave it anywhere",
     {"time_window": None, "drop_location": {"type": "other", "note": "Anywhere"}, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False}),
    ("chat", "Hôm nay em đi viện, không nhận được", "I'm at the hospital today, can't receive",
     {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": {"reason": "At the hospital today"}, "opt_out": False}),
    ("memo", "Khách nói thứ bảy tuần sau mới về", "Buyer says back next Saturday",
     {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": {"reason": "Away until next Saturday (beyond 5-day horizon)"}, "opt_out": False}),
    ("call", "Ờ… để chị coi lại lịch đã", "Uh… let me check my calendar",
     {"time_window": None, "drop_location": None, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False}),
    ("chat", "mai 5h chiều, gọi số 0903 xxx 214 nha", "tomorrow 5 pm, call 0903 xxx 214",
     {"time_window": {"date": TOMORROW, "from": "17:00", "to": "20:00"}, "drop_location": None, "alt_receiver": {"relation": "unspecified"}, "address_correction": None, "cannot_receive": None, "opt_out": False}),
    ("memo", "Khách ở tầng 12 tòa B chứ không phải tòa A, chiều mai giao", "Buyer is on floor 12 of Tower B, not Tower A, deliver tomorrow afternoon",
     {"time_window": {"date": TOMORROW, "from": "14:00", "to": "17:00"}, "drop_location": None, "alt_receiver": None, "address_correction": {"text": "Floor 12, Tower B (same building complex)", "same_district": True}, "cannot_receive": None, "opt_out": False}),
    ("call", "Trưa mai tầm mười một giờ, đưa bảo vệ cũng được", "Tomorrow around 11, the guard is fine",
     {"time_window": {"date": TOMORROW, "from": "10:00", "to": "12:00"}, "drop_location": {"type": "security_desk", "note": "Security guard"}, "alt_receiver": None, "address_correction": None, "cannot_receive": None, "opt_out": False}),
]
for src, vi, en, gold in HARD:
    sid += 1
    eval_rows.append({"id": f"S{sid:03d}", "source": src, "split": "dev", "kind": "hard_case", "text_vi": vi, "text_en": en, "gold": gold})

# ---------- test cases ----------
tests = [
    {"id": "TC-01", "covers": ["AC-01", "FR-03"], "scenario": "A_main", "given": "4,000 orders seeded, clock 06:28", "when": "clock passes 06:30", "then": "4,000 availability_reply rows with 4 slots_offered; 4,000 chat_message events; /ops shows 'orders loaded 4,000'"},
    {"id": "TC-02", "covers": ["AC-02", "BR-03"], "scenario": "unit", "given": "buyer picks only W4", "when": "reply webhook", "then": "agent asks for one more window; no note created"},
    {"id": "TC-03", "covers": ["AC-03", "BR-06"], "scenario": "A_main", "given": "courier taps A at 10:02", "when": "Undo at 10:03", "then": "shipper_event.status=undone; no chat_message to buyer; /ops shows 'undone'"},
    {"id": "TC-04", "covers": ["AC-04", "BR-09", "BR-10"], "scenario": "A_noanswer", "given": "chat at 14:32, no reply", "when": "clock runs", "then": "call 1 at 15:32, call 2 at 17:32, escalation at 17:33"},
    {"id": "TC-05", "covers": ["AC-05", "BR-11"], "scenario": "unit", "given": "tap A at 19:40 (chat 19:42)", "when": "call 1 due 20:42", "then": "policy_block call_hours; call moved to 08:00 next day"},
    {"id": "TC-06", "covers": ["AC-06", "BR-13"], "scenario": "A_midway", "given": "call 1 pending (due 16:12)", "when": "buyer chats at 15:52", "then": "timer cancelled event; no call placed"},
    {"id": "TC-07", "covers": ["AC-07", "BR-14"], "scenario": "A_main", "given": "call transcript A_main", "when": "extract", "then": "0.94/0.88/0.91 → auto_applied; attempt_count=1; card on /courier < 10 s"},
    {"id": "TC-08", "covers": ["AC-08", "BR-15"], "scenario": "A_lowconf", "given": "conf 0.52/0.41", "when": "extract", "then": "confirm_in_chat; then needs_review with reason low_confidence"},
    {"id": "TC-09", "covers": ["AC-09", "BR-07"], "scenario": "REFUSE", "given": "tap C", "when": "commit", "then": "zero buyer contacts; case in CS queue; label suggested, not applied"},
    {"id": "TC-10", "covers": ["AC-10", "BR-19"], "scenario": "REFUSE", "given": "suggested label", "when": "CS approves", "then": "label applied with actor cs:<name> in events"},
    {"id": "TC-11", "covers": ["AC-11", "BR-17"], "scenario": "unit", "given": "attempt_count=2", "when": "3rd attempt fails", "then": "status with_cs; no new rescue case"},
    {"id": "TC-12", "covers": ["AC-12", "BR-20"], "scenario": "unit", "given": "pending call", "when": "buyer writes 'stop'", "then": "opt_out=true; all timers cancelled; no further contact"},
    {"id": "TC-13", "covers": ["AC-13", "NFR-04"], "scenario": "A_main", "given": "iPad offline 20 s", "when": "reconnect", "then": "GET /state restores identical case view < 3 s"},
    {"id": "TC-14", "covers": ["AC-14", "NFR-10"], "scenario": "eval", "given": "all eval samples", "when": "run extraction", "then": "logged prompts contain no unmasked phone or street number"},
    {"id": "TC-15", "covers": ["BR-04", "FR-05"], "scenario": "CANT_TODAY", "given": "morning question", "when": "Can't receive today + reason", "then": "order moved to next day; reason stored; stop removed from R07"},
    {"id": "TC-16", "covers": ["FR-13", "FR-25"], "scenario": "B_memo", "given": "tap B + 9 s memo (audio/mp4)", "when": "upload", "then": "ASR transcript, masked, extracted; card pushed"},
    {"id": "TC-17", "covers": ["BR-16"], "scenario": "eval", "given": "sample with cross-ward address change", "when": "extract", "then": "same_district=false → needs_review regardless of confidence"},
    {"id": "TC-18", "covers": ["BR-18"], "scenario": "eval", "given": "'next Saturday'", "when": "extract", "then": "date beyond 5 days rejected → cannot_receive / CS"},
    {"id": "TC-19", "covers": ["NFR-01"], "scenario": "A_main", "given": "3 devices on hotspot", "when": "tap A on phone", "then": "event_pending visible on iPad within 300 ms (p95 over 20 taps)"},
    {"id": "TC-20", "covers": ["FR-70", "FR-72"], "scenario": "control", "given": "/control", "when": "Reset, speed 600×, offline mode", "then": "DB back to seed, clock 06:28, cached outputs replayed"},
]

# ---------- write ----------
def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

dump("hub.json", hub)
dump("couriers.json", couriers)
dump("windows.json", WINDOWS)
dump("orders.json", orders)
dump("day-plan.json", plan)
dump("demo-cases.json", demo_cases)
dump("utterances.json", utterances)
dump("test-cases.json", tests)
dump("expected-day-summary.json", summary)
with open(OUT / "eval-starter.jsonl", "w", encoding="utf-8") as f:
    for row in eval_rows:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
with open(OUT / "orders.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    keys = [k for k in orders[0] if k != "risk_flags"] + ["risk_flags"]
    w.writerow(keys)
    for o in orders:
        w.writerow([o[k] if k != "risk_flags" else "|".join(o[k]) for k in keys])

print(json.dumps(summary, indent=2))
print("orders", len(orders), "eval", len(eval_rows), "tests", len(tests))
