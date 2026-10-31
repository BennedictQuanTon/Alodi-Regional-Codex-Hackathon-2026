import re


def is_confirmation(text: str) -> bool:
    """Accept only a complete affirmative, never an affirmative plus a correction."""
    return bool(
        re.fullmatch(
            r"\s*(?:yes|confirm|correct|đúng(?:\s+rồi)?|đồng\s+ý|vâng(?:\s+đúng(?:\s+rồi)?)?|dạ\s+đúng(?:\s+rồi)?|ừ)(?:\s+ạ)?\s*[.!?]?\s*",
            text,
            re.IGNORECASE,
        )
    )
