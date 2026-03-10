# In-memory cooldown fallback — used when PostgreSQL is unavailable.
# For persistent cooldowns, see adapters/state.py (PostgreSQL-backed).
# The control plane should prefer the /state/cooldowns/check endpoint.

import time
from collections import defaultdict


class CooldownRegistry:
    """Track execution times per action+target to enforce cooldowns."""

    def __init__(self):
        self._history: dict[str, list[float]] = defaultdict(list)

    def can_execute(
        self,
        action_id: str,
        target_id: str,
        min_interval_s: int,
        max_per_hour: int,
    ) -> tuple[bool, str]:
        key = f"{action_id}:{target_id}"
        now = time.time()
        history = self._history[key]

        if history:
            elapsed = now - history[-1]
            if elapsed < min_interval_s:
                return False, f"Cooldown: wait {int(min_interval_s - elapsed)}s"

        recent = [t for t in history if (now - t) < 3600]
        if len(recent) >= max_per_hour:
            return False, f"Rate limit: max {max_per_hour}/hour"

        return True, ""

    def record(self, action_id: str, target_id: str) -> None:
        key = f"{action_id}:{target_id}"
        self._history[key].append(time.time())
        self._history[key] = self._history[key][-100:]


cooldown_registry = CooldownRegistry()
