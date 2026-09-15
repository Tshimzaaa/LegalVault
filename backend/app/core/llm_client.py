from openai import OpenAI

from app.core.config import settings
from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError
from app.exceptions.ai_assistant import AiAssistantUnavailable

# Mirrors the breaker used for Documenso (app/core/documenso_client.py) — fails fast
# on a real outage instead of hanging a chat request against a dependency that's
# already timing out.
_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout_seconds=30.0)

# GitHub Models: free-tier, OpenAI-compatible inference for models hosted by
# GitHub/Azure — https://docs.github.com/en/github-models.
_GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference"
_GITHUB_MODELS_MODEL = "openai/gpt-4o-mini"


def _build_client_and_model() -> tuple[OpenAI, str]:
    if settings.LLM_PROVIDER == "github_models":
        return OpenAI(base_url=_GITHUB_MODELS_ENDPOINT, api_key=settings.GITHUB_MODELS_TOKEN), _GITHUB_MODELS_MODEL

    # Ollama's OpenAI-compatible endpoint ignores the API key, but the SDK
    # requires a non-empty string.
    return OpenAI(base_url=settings.OLLAMA_BASE_URL, api_key="ollama"), settings.OLLAMA_MODEL


_client, _model = _build_client_and_model()


def _call_through_breaker(func):
    try:
        return _breaker.call(func)
    except CircuitOpenError as exc:
        raise AiAssistantUnavailable(
            "The assistant is temporarily unavailable, please try again shortly."
        ) from exc
    except AiAssistantUnavailable:
        raise
    except Exception as exc:
        raise AiAssistantUnavailable("The assistant request failed.") from exc


def send_message(system_prompt: str, history: list[dict]) -> str:
    """history: [{"role": "user"|"assistant", "content": str}, ...], oldest first.
    Returns the assistant's reply text."""

    def _do():
        response = _client.chat.completions.create(
            model=_model,
            messages=[{"role": "system", "content": system_prompt}, *history],
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""

    return _call_through_breaker(_do)
