# Survey · customers and shippers

> **Everything in this folder is MOCK data.** It exists so the EDA notebook and charts can be built before the real interviews (30–31 October 2026) come in. Every row carries `data_status = MOCK` and the file names end in `_MOCK`. Replace the files with the real responses before any number is shown to judges. Never quote a mock percentage as a finding.

## Files

| File | Rows | Content |
| --- | --- | --- |
| [`customers.csv`](customers.csv) | 100 | One row per buyer: profile tags + 16 questions + derived pain index + comment (Vietnamese and English) |
| [`couriers.csv`](couriers.csv) | 12 | One row per shipper (SPX Express 4, GHN 2, J&T Express 2, BEST Express 2, GHTK 1, Viettel Post 1): profile + 15 questions + comment |
| [`codebook.csv`](codebook.csv) | 45 | Every coded column: question in English and Vietnamese (use the Vietnamese wording on the real form), type, allowed values |
| [`summary_MOCK.csv`](summary_MOCK.csv) | 21 | Headline shares and means, the numbers a slide would use |
| [`generate_mock_survey.py`](generate_mock_survey.py) | — | Regenerates the mock files (`python3 -I generate_mock_survey.py`, seed 30102026) |

CSV files are UTF-8 with a BOM so Excel and Google Sheets show Vietnamese correctly. Multi-select answers (`carriers_used`) are `|`-separated.

## Structure

**Tidy and wide:** one row per respondent, one column per question. Likert answers are integers (1–5) so they can be averaged and correlated; labels are in the codebook.

| Group | Customer columns | Shipper columns |
| --- | --- | --- |
| Meta | `respondent_id`, `data_status`, `audience`, `submitted_at`, `collection_channel` | same |
| Profile tags | `persona_segment`, `age`, `age_group`, `gender`, `city`, `area_type`, `housing_type`, `occupation`, `work_schedule`, `income_band_vnd_month`, `orders_per_month`, `shopper_segment`, `main_platform`, `carriers_used`, `payment_preference` | `company`, `city`, `area_type`, `age`, `age_group`, `gender`, `years_experience`, `experience_band`, `employment_type`, `orders_per_day`, `cod_share_pct` |
| Pain frequency (1 Never … 5 Very often) | q01 called while busy · q02 missed call · q03 called back, unreachable · q04 ignored unknown number · q05 came when not home · q06 had to remind shipper · q07 instruction not followed | q06 forgot buyer instruction · q07 buyer calls while riding |
| Counts | q08 failed deliveries (3 months) · q09 order returned (Yes/No) | q01 calls/day · q02 unanswered % · q03 minutes on calls · q04 failed/day · q05 reschedules/day · q09 refusals/week · q10 wasted return trips/week |
| Attitude | q10 want to choose a window · q11 preferred channel · q12 OK with automated call · q13 recording concern · q14 best contact time · q15 biggest frustration | q08 where notes are kept · q11 app lets buyer pick a time |
| Adoption | q16 would use an Alodi-like service (Yes / Maybe / No) | **q12 would like an Alodi-like system (Yes / Not sure / No)** · q13 minutes saved per day · q14 most useful feature · q15 main concern |
| Derived | `pain_index_1to5` = mean of q01, q02, q03, q05, q06, q07 | — |

Customer segments (`persona_segment`): Busy office worker 36 · Student 21 · Shift worker 15 · Homemaker / retired 15 · Self-employed / online seller 13.

## Mock headline numbers (placeholders)

| Audience | Metric | Mock value |
| --- | --- | --- |
| Customer | Shipper called while busy, often or very often | 56% |
| Customer | Called back and could not reach the shipper, sometimes or more | 66% |
| Customer | Had to remind the shipper, sometimes or more | 81% |
| Customer | Want to choose a delivery window | 86% |
| Customer | Would use an Alodi-like service: Yes / Maybe / No | 65% / 34% / 1% |
| Shipper | Would like an Alodi-like system: Yes / Not sure / No | 10 (83%) / 2 (17%) / 0 |
| Shipper | Mean calls to buyers per day · unanswered share | 108 · 27% |
| Shipper | Mean minutes saved per day expected | 46 |

## Suggested EDA charts

| Chart | Data | Question it answers |
| --- | --- | --- |
| Diverging stacked bars (Never → Very often) | q01–q07 | Which pain is most frequent? |
| Grouped bars by `persona_segment` | `pain_index_1to5` | Who suffers most? (office and shift workers) |
| Heatmap `housing_type` × q07 | q07 | Do apartment buyers see notes ignored more? |
| Box plot `shopper_segment` × q08 | q08 | Do heavier shoppers fail more? |
| 100% bars by `age_group` | q11 preferred channel, q12 automated call | Which channel per age; is AI calling acceptable? |
| Donut | q16 (customers), q12 (shippers) | Adoption intent |
| Bar | q14 most useful feature (shippers) | What to show first in the demo |
| Correlation matrix | q01–q13 numeric | Which pains move together |

## Before the real interviews

1. Build the Google Form from `codebook.csv` (Vietnamese wording, same answer options), so exports drop into the same columns.
2. Keep `respondent_id`, add `data_status = REAL`, and drop names and phone numbers before saving (Vietnam PDPL).
3. Shipper interviews: ask q12 exactly as written, in a neutral voice; record “Not sure” and “No” honestly. The claim on stage is whatever the real answers say.
4. Re-run the notebook on the real files and replace the table above.
