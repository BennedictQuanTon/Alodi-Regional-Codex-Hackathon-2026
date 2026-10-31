"""Generate MOCK survey data (customers + couriers) to build the EDA notebook and charts
before the real interviews come in. Every row is marked data_status = MOCK.

Usage (from prep/06-survey):  python3 -I generate_mock_survey.py
Deterministic: seed 30102026.
"""
import csv
import random
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
R = random.Random(30102026)

FREQ = {1: "Never", 2: "Rarely", 3: "Sometimes", 4: "Often", 5: "Very often"}
AGREE = {1: "Strongly disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly agree"}


def clamp(v, lo=1, hi=5):
    return max(lo, min(hi, int(round(v))))


def pick(weights: dict):
    return R.choices(list(weights), weights=list(weights.values()))[0]


# ------------------------------------------------------------------ customers
PERSONAS = {
    # name: (share, age range, occupation weights, schedule, busy_bias, missed_bias, ai_ok_bias)
    "Busy office worker": (0.34, (24, 42), {"Office worker": 1}, "Fixed office hours", 1.2, 0.8, 0.3),
    "Student": (0.20, (18, 24), {"Student": 1}, "Flexible", 0.3, 0.6, 0.6),
    "Shift worker": (0.14, (22, 45), {"Factory worker": 0.5, "Healthcare / shift worker": 0.5}, "Shift work", 0.9, 1.2, 0.0),
    "Self-employed / online seller": (0.16, (25, 50), {"Self-employed": 0.6, "Freelancer": 0.4}, "Flexible", 0.6, 0.4, 0.4),
    "Homemaker / retired": (0.16, (35, 68), {"Homemaker": 0.6, "Retired": 0.4}, "Not working", -0.4, -0.2, -0.6),
}
CITIES = {"Ho Chi Minh City": 0.5, "Hanoi": 0.28, "Da Nang": 0.08, "Can Tho": 0.06, "Binh Duong": 0.08}
AREA = {"Ho Chi Minh City": {"Urban core": 0.65, "Suburban": 0.35}, "Hanoi": {"Urban core": 0.6, "Suburban": 0.4},
        "Da Nang": {"Urban core": 0.5, "Suburban": 0.5}, "Can Tho": {"Urban core": 0.4, "Suburban": 0.4, "Rural": 0.2},
        "Binh Duong": {"Suburban": 0.6, "Rural": 0.4}}
HOUSING = {"Urban core": {"Apartment with security desk": 0.5, "Alley house": 0.3, "Townhouse": 0.15, "Dormitory": 0.05},
           "Suburban": {"Alley house": 0.4, "Townhouse": 0.3, "Apartment with security desk": 0.2, "Dormitory": 0.1},
           "Rural": {"Townhouse": 0.6, "Alley house": 0.4}}
INCOME = ["< 5M", "5–10M", "10–20M", "20–40M", "> 40M"]
PLATFORMS = {"Shopee": 0.62, "TikTok Shop": 0.22, "Lazada": 0.1, "Tiki": 0.06}
CARRIERS = ["SPX Express", "GHN", "GHTK", "J&T Express", "BEST Express", "Viettel Post"]
FRUSTRATIONS = ["Calls at a bad time", "Can't reach the courier back", "My instructions are forgotten",
                "No way to choose a time", "Order returned after a missed call"]
CUST_COMMENTS = {
    "Calls at a bad time": ("Shipper gọi đúng lúc đang họp, tắt máy xong gọi lại thì không ai nghe.",
                            "The courier called during my meeting; when I called back nobody answered."),
    "Can't reach the courier back": ("Gọi lại số shipper 3 lần không được, hôm sau đơn bị hoàn.",
                                     "Called the courier back three times with no answer; the order was returned the next day."),
    "My instructions are forgotten": ("Đã dặn gửi bảo vệ mà lần nào cũng gọi bắt xuống lấy.",
                                      "I asked them to leave it with security but they always call me down."),
    "No way to choose a time": ("Muốn chọn giao sau 5h chiều mà app không cho chọn.",
                                "I want delivery after 5 pm but the app doesn't let me choose."),
    "Order returned after a missed call": ("Lỡ một cuộc gọi thôi mà đơn bị hủy, mất mã giảm giá.",
                                           "One missed call and the order was cancelled; I lost the voucher."),
}


def age_group(a):
    return "18–24" if a < 25 else "25–34" if a < 35 else "35–44" if a < 45 else "45–54" if a < 55 else "55+"


def segment(n):
    return "Light (1–2)" if n <= 2 else "Regular (3–5)" if n <= 5 else "Heavy (6–10)" if n <= 10 else "Power (> 10)"


customers = []
names = list(PERSONAS)
shares = [PERSONAS[n][0] for n in names]
for i in range(1, 101):
    persona = R.choices(names, weights=shares)[0]
    _, (a0, a1), occ_w, schedule, busy_b, missed_b, ai_b = PERSONAS[persona]
    age = R.randint(a0, a1)
    city = pick(CITIES)
    area = pick(AREA[city])
    housing = pick(HOUSING[area])
    occupation = pick(occ_w)
    inc_idx = {"Student": 0, "Homemaker / retired": 1}.get(persona, 2)
    income = INCOME[max(0, min(4, inc_idx + R.choice([-1, 0, 0, 1, 1]) + (1 if city in ("Ho Chi Minh City", "Hanoi") and persona == "Busy office worker" else 0)))]
    orders = max(1, int(R.gauss({"Student": 5, "Busy office worker": 7, "Self-employed / online seller": 10}.get(persona, 4), 3)))
    carriers = sorted(R.sample(CARRIERS, R.choice([1, 2, 2, 3])), key=CARRIERS.index)
    if "SPX Express" not in carriers and R.random() < 0.7:
        carriers.insert(0, "SPX Express")

    q01 = clamp(R.gauss(3.0 + busy_b, 0.8))                      # courier called while busy
    q02 = clamp(R.gauss(2.8 + missed_b, 0.9))                    # missed the call, couldn't reach back
    q03 = clamp(R.gauss(2.6 + 0.4 * missed_b, 0.9))              # called back, courier unreachable
    q04 = clamp(R.gauss(2.6 + (0.6 if age < 35 else -0.3), 1.0))  # ignored unknown number
    q05 = clamp(R.gauss(2.7 + busy_b, 0.9))                      # courier came when not home
    q06 = clamp(R.gauss(2.8 + (0.6 if housing == "Apartment with security desk" else 0), 0.9))  # had to remind courier
    q07 = clamp(R.gauss(2.4 + (0.9 if housing == "Apartment with security desk" else 0), 0.9))  # note not followed
    failed_3m = max(0, int(R.gauss(0.25 * orders + 0.4 * (q02 - 2), 1.0)))
    returned = "Yes" if failed_3m >= 2 and R.random() < 0.55 else ("Yes" if failed_3m == 1 and R.random() < 0.15 else "No")
    q10 = clamp(R.gauss(4.2 + 0.2 * busy_b, 0.7))                # want to choose a window
    q12 = clamp(R.gauss(3.3 + ai_b + (0.3 if age < 30 else 0), 0.9))  # OK with an automated call
    q13 = clamp(R.gauss(2.8 + (0.6 if age >= 45 else 0), 0.9))  # privacy concern about recording
    channel = pick({"Shopee chat": 0.36, "Zalo": 0.3, "Phone call": 0.14, "SMS": 0.08, "AI call": 0.12} if age < 45
                   else {"Phone call": 0.4, "Zalo": 0.35, "Shopee chat": 0.12, "SMS": 0.1, "AI call": 0.03})
    contact_time = pick({"Morning (08–12)": 0.25, "Noon (12–14)": 0.25, "Afternoon (14–17)": 0.15, "Evening (17–20)": 0.35}
                        if schedule == "Fixed office hours" else
                        {"Morning (08–12)": 0.3, "Noon (12–14)": 0.15, "Afternoon (14–17)": 0.3, "Evening (17–20)": 0.25})
    scores = {"Calls at a bad time": q01, "Can't reach the courier back": q03, "My instructions are forgotten": q07,
              "No way to choose a time": q10 - 1, "Order returned after a missed call": 4 if returned == "Yes" else 1}
    frustration = max(scores, key=lambda k: scores[k] + R.random())
    would_use = pick({"Yes": 0.8, "Maybe": 0.2} if q10 >= 4 else {"Yes": 0.35, "Maybe": 0.45, "No": 0.2})
    pain_index = round((q01 + q02 + q03 + q05 + q06 + q07) / 6, 2)
    cvi, cen = CUST_COMMENTS[frustration] if R.random() < 0.6 else ("", "")
    customers.append({
        "respondent_id": f"C{i:03d}",
        "data_status": "MOCK",
        "audience": "customer",
        "submitted_at": f"2026-10-3{R.choice([0, 0, 1])}T{R.randint(19, 23):02d}:{R.randint(0, 59):02d}:00+07:00",
        "collection_channel": pick({"Google Form": 0.85, "In-person interview": 0.15}),
        "persona_segment": persona,
        "age": age,
        "age_group": age_group(age),
        "gender": pick({"Female": 0.56, "Male": 0.42, "Prefer not to say": 0.02}),
        "city": city,
        "area_type": area,
        "housing_type": housing,
        "occupation": occupation,
        "work_schedule": schedule,
        "income_band_vnd_month": income,
        "orders_per_month": orders,
        "shopper_segment": segment(orders),
        "main_platform": pick(PLATFORMS),
        "carriers_used": "|".join(carriers),
        "payment_preference": pick({"COD": 0.48, "Prepaid": 0.27, "Mixed": 0.25}),
        "q01_courier_called_while_busy": q01,
        "q02_missed_courier_call": q02,
        "q03_called_back_courier_unreachable": q03,
        "q04_ignored_unknown_number": q04,
        "q05_courier_came_when_not_home": q05,
        "q06_had_to_remind_courier": q06,
        "q07_instruction_not_followed": q07,
        "q08_failed_deliveries_last_3m": failed_3m,
        "q09_order_returned_last_3m": returned,
        "q10_want_to_choose_window": q10,
        "q11_preferred_contact_channel": channel,
        "q12_ok_with_automated_call": q12,
        "q13_concern_call_recording": q13,
        "q14_preferred_contact_time": contact_time,
        "q15_biggest_frustration": frustration,
        "q16_would_use_alodi_like_service": would_use,
        "pain_index_1to5": pain_index,
        "comment_vi": cvi,
        "comment_en": cen,
    })

# ------------------------------------------------------------------ couriers
COMPANIES = ["SPX Express", "SPX Express", "SPX Express", "SPX Express", "GHN", "GHN", "J&T Express", "J&T Express",
             "BEST Express", "BEST Express", "GHTK", "Viettel Post"]
FEATURES = {"Time window known before delivery": 0.32, "Auto follow-up after a failed call": 0.24,
            "Context card for the next attempt": 0.2, "Voice memo instead of typing": 0.12,
            "CS handles refusals, not me": 0.12}
CONCERNS = {"None": 0.3, "Another app to learn": 0.2, "Buyers may not answer a bot": 0.22,
            "Is the information accurate?": 0.18, "Phone battery and data": 0.1}
SHIP_COMMENTS = [
    ("Mỗi ngày gọi cả trăm cuộc, khách không nghe là mất thời gian quay lại.", "I make a hundred calls a day; when buyers don't answer I waste time coming back."),
    ("Khách dặn giờ qua điện thoại, nhiều đơn quá nên quên.", "Buyers tell me a time on the phone; with so many orders I forget."),
    ("Đang chạy xe mà khách gọi liên tục, nguy hiểm lắm.", "Buyers keep calling while I'm riding; it's dangerous."),
    ("Có hệ thống hỏi giờ trước thì đỡ chạy lòng vòng.", "If a system asked for the time first I'd ride around less."),
    ("Đơn bom là mình chịu, chạy không công.", "Refused orders are on me; I ride for nothing."),
    ("App có chỗ ghi chú nhưng không ai đọc lại.", "The app has a note field but nobody reads it again."),
    ("Chưa rõ máy gọi thì khách có nghe không.", "Not sure buyers will pick up a machine's call."),
]

couriers = []
for i, company in enumerate(COMPANIES, start=1):
    age = R.randint(21, 45)
    years = max(0.5, round(R.uniform(0.5, min(12, age - 19)), 1))
    orders = R.randint(70, 140) if company == "SPX Express" else R.randint(55, 120)
    calls = int(orders * R.uniform(0.9, 1.4))
    unanswered = R.randint(18, 35)
    failed = max(2, int(orders * R.uniform(0.06, 0.13)))
    would_like = "Yes" if i not in (6, 11) else "Not sure"     # most yes, a minority not sure, nobody says no
    c_vi, c_en = SHIP_COMMENTS[(i - 1) % len(SHIP_COMMENTS)]
    couriers.append({
        "respondent_id": f"S{i:02d}",
        "data_status": "MOCK",
        "audience": "courier",
        "submitted_at": f"2026-10-3{R.choice([0, 1])}T{R.randint(19, 22):02d}:{R.randint(0, 59):02d}:00+07:00",
        "collection_channel": pick({"In-person interview": 0.6, "Google Form": 0.4}),
        "company": company,
        "city": pick({"Ho Chi Minh City": 0.6, "Hanoi": 0.3, "Binh Duong": 0.1}),
        "area_type": pick({"Urban core": 0.6, "Suburban": 0.4}),
        "age": age,
        "age_group": age_group(age),
        "gender": "Male" if R.random() < 0.9 else "Female",
        "years_experience": years,
        "experience_band": "< 1 year" if years < 1 else "1–3 years" if years < 3 else "3–5 years" if years < 5 else "> 5 years",
        "employment_type": pick({"Full-time": 0.55, "Part-time": 0.15, "Gig / per order": 0.3}),
        "orders_per_day": orders,
        "cod_share_pct": R.randint(45, 80),
        "q01_calls_to_buyers_per_day": calls,
        "q02_unanswered_call_pct": unanswered,
        "q03_minutes_per_day_on_calls": int(calls * R.uniform(0.6, 1.0)),
        "q04_failed_deliveries_per_day": failed,
        "q05_reschedule_requests_per_day": max(1, int(failed * R.uniform(0.4, 0.8))),
        "q06_forgot_buyer_instruction": clamp(R.gauss(3.4, 0.7)),
        "q07_buyer_calls_while_riding": clamp(R.gauss(4.1, 0.6)),
        "q08_where_notes_are_kept": pick({"Memory": 0.42, "Phone notes app": 0.25, "Paper": 0.13, "Carrier app note field": 0.2}),
        "q09_refusals_per_week": R.randint(3, 15),
        "q10_wasted_return_trips_per_week": R.randint(4, 20),
        "q11_app_lets_buyer_pick_time": "Partly (date + half-day)" if company == "GHTK" else "No",
        "q12_would_like_alodi_like_system": would_like,
        "q13_expected_minutes_saved_per_day": R.choice([20, 30, 30, 40, 45, 60, 60, 90]) if would_like == "Yes" else R.choice([0, 10, 15]),
        "q14_most_useful_feature": pick(FEATURES),
        "q15_main_concern": pick(CONCERNS) if would_like == "Yes" else "Buyers may not answer a bot",
        "comment_vi": c_vi,
        "comment_en": c_en,
    })

# ------------------------------------------------------------------ codebook
CODEBOOK = [
    ("customer", "persona_segment", "Respondent group (assigned when coding)", "Nhóm đối tượng", "category", "Busy office worker | Student | Shift worker | Self-employed / online seller | Homemaker / retired"),
    ("customer", "age_group", "Age group", "Nhóm tuổi", "ordinal", "18–24 | 25–34 | 35–44 | 45–54 | 55+"),
    ("customer", "area_type", "Area type", "Loại khu vực", "category", "Urban core | Suburban | Rural"),
    ("customer", "housing_type", "Where you receive parcels", "Nơi nhận hàng", "category", "Apartment with security desk | Alley house | Townhouse | Dormitory"),
    ("customer", "work_schedule", "Work schedule", "Lịch làm việc", "category", "Fixed office hours | Shift work | Flexible | Not working"),
    ("customer", "income_band_vnd_month", "Monthly income (VND)", "Thu nhập/tháng", "ordinal", " | ".join(INCOME)),
    ("customer", "orders_per_month", "Online orders per month", "Số đơn online mỗi tháng", "integer", "≥ 1"),
    ("customer", "shopper_segment", "Shopper segment (from orders_per_month)", "Phân khúc mua sắm", "ordinal", "Light (1–2) | Regular (3–5) | Heavy (6–10) | Power (> 10)"),
    ("customer", "carriers_used", "Carriers that delivered to you (multi-select, | separated)", "Đơn vị vận chuyển đã nhận", "multi", " | ".join(CARRIERS)),
    ("customer", "q01_courier_called_while_busy", "In the last 3 months, how often did a courier call while you were busy (meeting, driving, working)?", "3 tháng qua, shipper gọi lúc bạn đang bận (họp, chạy xe, làm việc) bao nhiêu lần?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q02_missed_courier_call", "How often did you miss the courier's call?", "Bạn lỡ cuộc gọi của shipper thường xuyên không?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q03_called_back_courier_unreachable", "How often did you call the courier back and could not reach them?", "Bạn gọi lại shipper nhưng không liên lạc được bao nhiêu lần?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q04_ignored_unknown_number", "How often do you ignore calls from unknown numbers?", "Bạn có hay bỏ qua cuộc gọi số lạ không?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q05_courier_came_when_not_home", "How often did the courier come when you were not home?", "Shipper đến lúc bạn không có nhà bao nhiêu lần?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q06_had_to_remind_courier", "How often did you have to remind the courier of a time or instruction you had already given?", "Bạn phải nhắc lại shipper giờ hẹn/lời dặn đã nói trước đó bao nhiêu lần?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q07_instruction_not_followed", "How often was your instruction (e.g. leave with security) not followed?", "Lời dặn (vd: gửi bảo vệ) không được làm theo bao nhiêu lần?", "likert_freq", "1 Never … 5 Very often"),
    ("customer", "q08_failed_deliveries_last_3m", "Number of failed deliveries to you in the last 3 months", "Số lần giao không thành công trong 3 tháng qua", "integer", "≥ 0"),
    ("customer", "q09_order_returned_last_3m", "Was any order returned or cancelled because delivery failed?", "Có đơn nào bị hoàn/hủy vì giao không thành công?", "binary", "Yes | No"),
    ("customer", "q10_want_to_choose_window", "I would like to choose a delivery time window", "Tôi muốn được chọn khung giờ giao hàng", "likert_agree", "1 Strongly disagree … 5 Strongly agree"),
    ("customer", "q11_preferred_contact_channel", "Preferred way for the carrier to contact you", "Kênh liên lạc mong muốn", "category", "Shopee chat | Zalo | Phone call | SMS | AI call"),
    ("customer", "q12_ok_with_automated_call", "I am comfortable receiving an automated call from the carrier", "Tôi thoải mái nhận cuộc gọi tự động từ đơn vị vận chuyển", "likert_agree", "1 … 5"),
    ("customer", "q13_concern_call_recording", "I am concerned about calls being recorded", "Tôi lo ngại việc ghi âm cuộc gọi", "likert_agree", "1 … 5"),
    ("customer", "q14_preferred_contact_time", "Best time to contact you", "Thời gian liên lạc phù hợp", "category", "Morning (08–12) | Noon (12–14) | Afternoon (14–17) | Evening (17–20)"),
    ("customer", "q15_biggest_frustration", "Biggest frustration with deliveries", "Điều phiền nhất khi nhận hàng", "category", " | ".join(FRUSTRATIONS)),
    ("customer", "q16_would_use_alodi_like_service", "If the carrier messaged you to pick a time and remembered your instructions, would you use it?", "Nếu đơn vị vận chuyển nhắn hỏi giờ và nhớ lời dặn của bạn, bạn có dùng không?", "category", "Yes | Maybe | No"),
    ("customer", "pain_index_1to5", "Mean of q01, q02, q03, q05, q06, q07 (derived)", "Chỉ số phiền (tính toán)", "float", "1–5"),
    ("courier", "company", "Carrier you work for", "Công ty", "category", "SPX Express | GHN | J&T Express | BEST Express | GHTK | Viettel Post"),
    ("courier", "experience_band", "Experience band", "Thâm niên", "ordinal", "< 1 year | 1–3 years | 3–5 years | > 5 years"),
    ("courier", "employment_type", "Employment type", "Hình thức làm việc", "category", "Full-time | Part-time | Gig / per order"),
    ("courier", "orders_per_day", "Orders you deliver per day", "Số đơn giao mỗi ngày", "integer", "≥ 0"),
    ("courier", "q01_calls_to_buyers_per_day", "Calls you make to buyers per day", "Số cuộc gọi cho khách mỗi ngày", "integer", "≥ 0"),
    ("courier", "q02_unanswered_call_pct", "Share of your calls that buyers do not answer (%)", "% cuộc gọi khách không nghe", "integer", "0–100"),
    ("courier", "q03_minutes_per_day_on_calls", "Minutes per day spent calling buyers", "Số phút gọi khách mỗi ngày", "integer", "≥ 0"),
    ("courier", "q04_failed_deliveries_per_day", "Failed deliveries per day", "Số đơn giao không thành công mỗi ngày", "integer", "≥ 0"),
    ("courier", "q05_reschedule_requests_per_day", "Buyers asking to reschedule per day", "Số khách hẹn lại mỗi ngày", "integer", "≥ 0"),
    ("courier", "q06_forgot_buyer_instruction", "How often do you forget a time or instruction a buyer gave you?", "Anh/chị có hay quên giờ/lời dặn của khách không?", "likert_freq", "1 Never … 5 Very often"),
    ("courier", "q07_buyer_calls_while_riding", "How often do buyers call you while you are riding?", "Khách gọi lúc đang chạy xe thường xuyên không?", "likert_freq", "1 Never … 5 Very often"),
    ("courier", "q08_where_notes_are_kept", "Where you keep buyers' instructions", "Anh/chị ghi lời dặn của khách ở đâu?", "category", "Memory | Phone notes app | Paper | Carrier app note field"),
    ("courier", "q09_refusals_per_week", "Refused (bombed) orders per week", "Số đơn bom mỗi tuần", "integer", "≥ 0"),
    ("courier", "q10_wasted_return_trips_per_week", "Return trips that ended in another failure per week", "Số lần quay lại vẫn không giao được mỗi tuần", "integer", "≥ 0"),
    ("courier", "q11_app_lets_buyer_pick_time", "Does your app let buyers pick a delivery time?", "App có cho khách chọn giờ giao không?", "category", "Yes | Partly (date + half-day) | No"),
    ("courier", "q12_would_like_alodi_like_system", "If a system asked buyers for a time and gave you a card with the time, drop-off and backup contact, saving you time and keeping everyone on the same page, would you like it?", "Nếu có hệ thống hỏi giờ khách trước và đưa anh/chị thẻ ghi giờ, nơi để hàng, người nhận thay — tiết kiệm thời gian và thống nhất hơn — anh/chị có thích không?", "category", "Yes | Not sure | No"),
    ("courier", "q13_expected_minutes_saved_per_day", "Minutes you think it would save per day", "Ước tính tiết kiệm bao nhiêu phút mỗi ngày", "integer", "≥ 0"),
    ("courier", "q14_most_useful_feature", "Most useful feature", "Tính năng hữu ích nhất", "category", " | ".join(FEATURES)),
    ("courier", "q15_main_concern", "Main concern", "Lo ngại lớn nhất", "category", " | ".join(CONCERNS)),
]


def write(name, rows, fields=None):
    fields = fields or list(rows[0])
    with open(HERE / name, "w", newline="", encoding="utf-8-sig") as f:   # BOM so Excel shows Vietnamese correctly
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


write("customers.csv", customers)
write("couriers.csv", couriers)
write("codebook.csv", [dict(zip(["audience", "column", "question_en", "question_vi", "type", "values"], c)) for c in CODEBOOK])

# ------------------------------------------------------------------ headline summary (for slides)
n = len(customers)


def share(rows, col, pred):
    return sum(1 for r in rows if pred(r[col])) / len(rows)


summary = [
    ("customer", "Courier called while busy, often or very often", share(customers, "q01_courier_called_while_busy", lambda v: v >= 4)),
    ("customer", "Missed the courier's call, often or very often", share(customers, "q02_missed_courier_call", lambda v: v >= 4)),
    ("customer", "Called back and could not reach the courier, sometimes or more", share(customers, "q03_called_back_courier_unreachable", lambda v: v >= 3)),
    ("customer", "Had to remind the courier, sometimes or more", share(customers, "q06_had_to_remind_courier", lambda v: v >= 3)),
    ("customer", "Instruction not followed, sometimes or more", share(customers, "q07_instruction_not_followed", lambda v: v >= 3)),
    ("customer", "Had an order returned or cancelled in the last 3 months", share(customers, "q09_order_returned_last_3m", lambda v: v == "Yes")),
    ("customer", "Want to choose a delivery window (agree or strongly agree)", share(customers, "q10_want_to_choose_window", lambda v: v >= 4)),
    ("customer", "Comfortable with an automated call (agree or strongly agree)", share(customers, "q12_ok_with_automated_call", lambda v: v >= 4)),
    ("customer", "Would use an Alodi-like service: Yes", share(customers, "q16_would_use_alodi_like_service", lambda v: v == "Yes")),
    ("customer", "Would use an Alodi-like service: Maybe", share(customers, "q16_would_use_alodi_like_service", lambda v: v == "Maybe")),
    ("customer", "Would use an Alodi-like service: No", share(customers, "q16_would_use_alodi_like_service", lambda v: v == "No")),
    ("courier", "Would like an Alodi-like system: Yes", share(couriers, "q12_would_like_alodi_like_system", lambda v: v == "Yes")),
    ("courier", "Would like an Alodi-like system: Not sure", share(couriers, "q12_would_like_alodi_like_system", lambda v: v == "Not sure")),
    ("courier", "Would like an Alodi-like system: No", share(couriers, "q12_would_like_alodi_like_system", lambda v: v == "No")),
    ("courier", "Buyers call while riding, often or very often", share(couriers, "q07_buyer_calls_while_riding", lambda v: v >= 4)),
    ("courier", "Keep buyers' instructions only in memory", share(couriers, "q08_where_notes_are_kept", lambda v: v == "Memory")),
]
means = [
    ("courier", "Mean calls to buyers per day", sum(c["q01_calls_to_buyers_per_day"] for c in couriers) / len(couriers)),
    ("courier", "Mean unanswered call share (%)", sum(c["q02_unanswered_call_pct"] for c in couriers) / len(couriers)),
    ("courier", "Mean minutes per day on calls", sum(c["q03_minutes_per_day_on_calls"] for c in couriers) / len(couriers)),
    ("courier", "Mean expected minutes saved per day (Yes answers)",
     sum(c["q13_expected_minutes_saved_per_day"] for c in couriers if c["q12_would_like_alodi_like_system"] == "Yes")
     / max(1, sum(1 for c in couriers if c["q12_would_like_alodi_like_system"] == "Yes"))),
    ("customer", "Mean pain index (1–5)", sum(c["pain_index_1to5"] for c in customers) / n),
]
rows = [{"data_status": "MOCK", "audience": a, "metric": m, "value": f"{v:.1%}", "n": len(customers) if a == "customer" else len(couriers)} for a, m, v in summary]
rows += [{"data_status": "MOCK", "audience": a, "metric": m, "value": f"{v:.1f}", "n": len(customers) if a == "customer" else len(couriers)} for a, m, v in means]
write("summary_MOCK.csv", rows)

for r in rows:
    print(f'{r["audience"]:8} {r["value"]:>7}  {r["metric"]}')
print(Counter(c["persona_segment"] for c in customers))
print(Counter(c["company"] for c in couriers), Counter(c["q12_would_like_alodi_like_system"] for c in couriers))
