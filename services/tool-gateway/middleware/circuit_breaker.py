import time
from collections import defaultdict


class CircuitBreaker:
    """Per-adapter circuit breaker: 5 failures -> open 60s -> half-open."""

    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failures: dict[str, int] = defaultdict(int)
        self.last_failure: dict[str, float] = {}
        self.state: dict[str, str] = defaultdict(lambda: "closed")

    def can_execute(self, adapter: str) -> bool:
        if self.state[adapter] == "closed":
            return True
        if self.state[adapter] == "open":
            if time.time() - self.last_failure.get(adapter, 0) > self.reset_timeout:
                self.state[adapter] = "half-open"
                return True
            return False
        return self.state[adapter] == "half-open"

    def record_success(self, adapter: str) -> None:
        self.failures[adapter] = 0
        self.state[adapter] = "closed"

    def record_failure(self, adapter: str) -> None:
        self.failures[adapter] += 1
        self.last_failure[adapter] = time.time()
        if self.failures[adapter] >= self.failure_threshold:
            self.state[adapter] = "open"

    def get_status(self) -> dict:
        return {
            adapter: {"state": state, "failures": self.failures[adapter]}
            for adapter, state in self.state.items()
        }


breaker = CircuitBreaker()
