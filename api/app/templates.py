"""English demo messages; no provider calls or inferred buyer preferences."""

import json
from pathlib import Path
from string import Formatter

from app.settings import ConfigurationError

WINDOW_QUESTION = (
    "Hi {first_name}, your {item} arrives today. Pick at least two windows that work, "
    "or tell us you can't receive today."
)


def load_window_template(pack_dir: Path) -> str:
    path = pack_dir / "utterances.json"
    if not path.exists():
        return WINDOW_QUESTION
    try:
        template = json.loads(path.read_text(encoding="utf-8"))["agent_lines"]["window_question"]
        fields = {name for _, name, _, _ in Formatter().parse(template) if name}
        if fields != {"first_name", "item"}:
            raise ValueError
        template.format(first_name="Buyer", item="parcel")
        return template
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        raise ConfigurationError("Invalid mock template: agent_lines.window_question") from None
