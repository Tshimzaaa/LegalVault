import html
import re

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
_NORMALIZE_RE = re.compile(r"[^a-z0-9]+")


def normalize_key(label: str) -> str:
    """Turns an intake field label ("Client Full Name") into the placeholder key a
    template body references ("client_full_name")."""
    return _NORMALIZE_RE.sub("_", label.strip().lower()).strip("_")


def render_body(body: str, values: dict[str, str]) -> str:
    """Substitutes {{key}} placeholders in a template body with values, HTML-escaping
    each substituted value. A key with no matching value renders as [[missing: key]]
    instead of silently blanking, so a missing answer is visible rather than lost."""

    def _substitute(match: re.Match) -> str:
        key = match.group(1)
        if key in values:
            return html.escape(values[key])
        return f"[[missing: {key}]]"

    return _PLACEHOLDER_RE.sub(_substitute, body)
