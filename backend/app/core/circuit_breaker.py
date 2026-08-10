import threading
import time
from typing import Callable, TypeVar

T = TypeVar("T")


class CircuitOpenError(Exception):
    """Raised instead of calling through, while the circuit is open."""


class CircuitBreaker:
    """A minimal per-process circuit breaker (closed -> open -> half-open -> closed).

    After `failure_threshold` consecutive failures, the circuit opens and every call fast-fails
    with CircuitOpenError for `recovery_timeout_seconds`, instead of blocking a request thread on
    a dependency that's already timing out. After the cooldown, the next call is let through as a
    trial ("half-open"): success closes the circuit, failure re-opens it for another cooldown.
    """

    def __init__(self, failure_threshold: int = 5, recovery_timeout_seconds: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self._failure_count = 0
        self._opened_at: float | None = None
        self._lock = threading.Lock()

    def _state(self) -> str:
        if self._opened_at is None:
            return "closed"
        if time.monotonic() - self._opened_at >= self.recovery_timeout_seconds:
            return "half_open"
        return "open"

    def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        with self._lock:
            if self._state() == "open":
                raise CircuitOpenError("Circuit is open — this dependency recently failed or timed out.")

        try:
            result = func(*args, **kwargs)
        except Exception:
            with self._lock:
                self._failure_count += 1
                if self._failure_count >= self.failure_threshold:
                    self._opened_at = time.monotonic()
            raise
        else:
            with self._lock:
                self._failure_count = 0
                self._opened_at = None
            return result
