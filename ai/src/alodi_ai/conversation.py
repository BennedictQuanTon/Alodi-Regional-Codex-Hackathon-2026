import re

_ENGLISH_CONFIRMATION = (
    r"(?:yes(?:\s*[,.;]\s*|\s+)(?:(?:that|it)(?:\s+is|['’]s)\s+)?(?:correct|right)"
    r"|(?:that|it)(?:\s+is|['’]s)\s+(?:correct|right)|yes|confirm|correct)"
)
_VIETNAMESE_CONFIRMATION = (
    r"(?:đúng(?:\s+rồi)?|đồng\s+ý|vâng(?:\s+đúng(?:\s+rồi)?)?|dạ\s+đúng(?:\s+rồi)?|ừ)"
)


def is_confirmation(text: str) -> bool:
    """Accept only a complete affirmative, never an affirmative plus a correction."""
    return bool(
        re.fullmatch(
            rf"\s*(?:{_ENGLISH_CONFIRMATION}|{_VIETNAMESE_CONFIRMATION})(?:\s+ạ)?\s*[.!?]?\s*",
            text,
            re.IGNORECASE,
        )
    )
