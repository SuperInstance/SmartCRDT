"""Vector clock for causal ordering in distributed systems."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class VectorClock:
    """A vector clock that tracks causal ordering across nodes.

    Each node maintains its own counter. The clock can be incremented,
    merged (element-wise max), and compared for causality.

    Example:
        >>> vc1 = VectorClock()
        >>> vc1.increment("A")
        >>> vc1.increment("A")
        >>> vc2 = VectorClock()
        >>> vc2.increment("B")
        >>> merged = vc1.merge(vc2)
        >>> merged.get("A")
        2
        >>> merged.get("B")
        1
    """

    _clocks: Dict[str, int] = field(default_factory=dict)

    def increment(self, node: str) -> int:
        """Increment the counter for *node* and return the new value."""
        self._clocks[node] = self._clocks.get(node, 0) + 1
        return self._clocks[node]

    def get(self, node: str) -> int:
        """Return the counter for *node* (0 if absent)."""
        return self._clocks.get(node, 0)

    def merge(self, other: VectorClock) -> VectorClock:
        """Return a new clock with element-wise max of both clocks."""
        result = VectorClock(_clocks=dict(self._clocks))
        for node, ts in other._clocks.items():
            result._clocks[node] = max(result._clocks.get(node, 0), ts)
        return result

    def happens_before(self, other: VectorClock) -> bool:
        """True if self < other (strict happened-before relation)."""
        all_leq = all(self.get(n) <= other.get(n) for n in self._clocks)
        any_lt = any(self.get(n) < other.get(n) for n in set(self._clocks) | set(other._clocks))
        return all_leq and any_lt

    def concurrent_with(self, other: VectorClock) -> bool:
        """True if neither clock happened before the other."""
        return not self.happens_before(other) and not other.happens_before(self)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, VectorClock):
            return NotImplemented
        return self._clocks == other._clocks

    def __repr__(self) -> str:
        return f"VectorClock({self._clocks})"

    def to_dict(self) -> Dict[str, int]:
        """Return a plain dict copy."""
        return dict(self._clocks)

    @classmethod
    def from_dict(cls, data: Dict[str, int]) -> VectorClock:
        """Construct from a plain dict."""
        return cls(_clocks=dict(data))
