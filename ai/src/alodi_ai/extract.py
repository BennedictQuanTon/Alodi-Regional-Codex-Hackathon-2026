import json
import re
from datetime import timedelta

from openai import AsyncOpenAI

from .privacy import mask
from .schema import DeliveryContext, empty_context


async def extract(
    settings, snapshot, text, source, metrics=None, expected_context=None
):
    safe = mask(text, snapshot.known_pii)
    if settings.mode != "live":
        result = empty_context().model_dump(by_alias=True, mode="json")
        if re.search(r"stop contact|đừng (?:gọi|liên hệ)|ngừng liên hệ", safe, re.I):
            result["opt_out"] = True
        if re.search(r"tomorrow|ngày mai|mai", safe, re.I):
            times = list(
                re.finditer(
                    r"after five|sau (?:năm|5)|17:00|after six|sau (?:sáu|6)|18:00",
                    safe,
                    re.I,
                )
            )
            if times:
                hour = (
                    "18:00"
                    if re.search(r"six|sáu|6|18:00", times[-1].group(), re.I)
                    else "17:00"
                )
                result["time_window"] = {
                    "date": str(snapshot.business_now.date() + timedelta(days=1)),
                    "from": hour,
                    "to": "20:00",
                    "confidence": 0.95,
                }
        locations = list(re.finditer(r"security|bảo vệ|reception|lễ tân", safe, re.I))
        if locations:
            is_reception = bool(
                re.search(r"reception|lễ tân", locations[-1].group(), re.I)
            )
            result["drop_location"] = {
                "type": "reception" if is_reception else "security_desk",
                "note": "reception" if is_reception else "security desk",
                "confidence": 0.9,
            }
        return DeliveryContext.model_validate(result)
    client = AsyncOpenAI(api_key=settings.openai_api_key.get_secret_value(), timeout=30)
    schema = DeliveryContext.model_json_schema(by_alias=True)
    schema["required"] = list(schema["properties"])
    try:
        response = await client.responses.create(
            model=settings.openai_model,
            reasoning={"effort": settings.openai_reasoning_effort},
            instructions="For assistant_readback, expected_context is a checklist, never evidence: extract only details explicitly spoken. Do not fill missing or contradictory details from the checklist. Only for free-text drop_location.note, delivery_notes, alt_receiver.relation and cannot_receive.reason: use the exact expected string if and only if the spoken paraphrase explicitly preserves every material instruction, condition and timing with no contradiction or added restriction. Otherwise return the actual different value or null. Never canonicalize conflicting date, time, drop_location.type, address, or phone values. Extract only explicitly stated delivery details. Return null for missing fields. Resolve Vietnamese relative dates using the business date. The text may contain multiple buyer turns in chronological order. Merge details across turns; a corrected answer replaces only the earlier conflicting field. Preserve explicit optional delivery instructions in delivery_notes, otherwise null. A brief negative answer to the optional notes question means no additional notes, not cannot_receive. Never infer phone numbers. Interpret after HH as HH:00-20:00, before HH as 08:00-HH:00; morning 08:00-12:00, afternoon 14:00-17:00, evening 17:00-20:00.",
            input=json.dumps(
                {
                    "source": source,
                    "expected_context": expected_context.model_dump(
                        by_alias=True, mode="json"
                    )
                    if expected_context is not None
                    else None,
                    "business_date": str(snapshot.business_now.date()),
                    "offered_windows": snapshot.offered_windows,
                    "text": safe,
                },
                ensure_ascii=False,
            ),
            text={
                "format": {
                    "type": "json_schema",
                    "name": "delivery_context",
                    "strict": True,
                    "schema": schema,
                }
            },
        )
    finally:
        await client.close()
    if metrics is not None and response.usage is not None:
        metrics.append(
            {
                "type": "usage",
                "service": "text_extraction",
                "model": settings.openai_model,
                "tokens": response.usage.model_dump(mode="json"),
            }
        )
    return DeliveryContext.model_validate_json(response.output_text)
