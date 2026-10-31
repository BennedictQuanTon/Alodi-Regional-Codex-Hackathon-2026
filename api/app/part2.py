"""Part 2 injection boundary and labelled fixtures. No cloud provider implementation."""

import json
from pathlib import Path
from typing import Protocol

from app.contracts import Extraction, Part2Input, Proposal


class Part2Adapter(Protocol):
    mode: str

    async def extract(self, request: Part2Input) -> Proposal: ...

    async def request_call(self, request: Part2Input) -> list[dict]: ...

    async def cancel_call(self, call_id: str, generation_id: str) -> None: ...


class FixtureAdapter:
    """Deterministic mock/replay responses, not ASR or measured AI extraction."""

    def __init__(self, pack: Path, mode="stub"):
        self.mode = mode
        self.gold = json.loads((pack / "utterances.json").read_text(encoding="utf-8"))
        self.cases = {
            row["tracking_id"]: row["scenario"]
            for row in json.loads((pack / "demo-cases.json").read_text(encoding="utf-8"))
        }

    async def extract(self, request: Part2Input) -> Proposal:
        scenario = self.cases.get(request.tracking_id)
        values = {
            "time_window": None,
            "drop_location": None,
            "alt_receiver": None,
            "address_correction": None,
            "cannot_receive": None,
            "opt_out": False,
        }
        # Fixtures are deliberately selected by scenario, never presented as inference.
        if scenario in {"A_main", "B_memo", "A_midway"}:
            source = self.gold[scenario]["gold"]
            if source.get("time_window"):
                values["time_window"] = {
                    **source["time_window"],
                    "confidence": 0.93 if scenario == "B_memo" else 0.94,
                }
            if source.get("drop_location"):
                values["drop_location"] = {**source["drop_location"], "confidence": 0.9}
            if source.get("alt_receiver"):
                values["alt_receiver"] = {
                    **source["alt_receiver"],
                    "phone_masked": "***",
                    "confidence": 0.91,
                }
            if scenario == "A_midway" and request.text == "Hand it to me":
                values["drop_location"] = {
                    "type": "hand_to_buyer",
                    "note": "Hand to buyer",
                    "confidence": 1,
                }
        return Proposal(
            request_id=request.request_id,
            tracking_id=request.tracking_id,
            rescue_case_id=request.rescue_case_id,
            generation_id=request.generation_id,
            context_version=request.context_version,
            source=request.source,
            mode=self.mode,
            fields=Extraction.model_validate(values),
        )

    async def request_call(self, request: Part2Input) -> list[dict]:
        if not request.auto_buyer:
            return []
        scenario = self.cases.get(request.tracking_id)
        if scenario == "A_noanswer" or scenario is None:
            return [{"status": "missed"}]
        text = self.gold.get(scenario, {}).get("call", {}).get("en", "Unclear answer")
        return [
            {"status": "connected", "recording_consent": True},
            {"status": "ended", "masked_text": text},
        ]

    async def cancel_call(self, call_id: str, generation_id: str) -> None:
        return None
