import re


def mask(text: str, known_pii: list[str] = ()) -> str:
    for value in sorted((v for v in known_pii if v), key=len, reverse=True):
        text = re.sub(re.escape(value), "[redacted]", text, flags=re.IGNORECASE)
    text = re.sub(r"(?<!\w)(?:\+?84|0)(?:[\s.-]*\d){8,10}(?!\w)", "[phone]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email]", text)
    return text
