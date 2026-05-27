"""G-Counter — Grow-only counter CRDT."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict, Iterator


@dataclass
class GCounter:
    """Grow-only counter (G-Counter) CRDT.

    Each node maintains its own monotonic counter. The global value is the
    sum of all per-node counters. Merge takes the element-wise maximum.

    Properties:
        - Commutative: merge(A, B) == merge(B, A)
        - Associative: merge(merge(A, B), C) == merge(A, merge(B, C))
        - Idempotent: merge(A, A) == A

    Example:
        >>> c1 = GCounter()
        >>> c2 = GCounter()
        >>> c1.increment("node1", 5)
        >>> c2.increment("node2", 3)
        >>> c1.merge(c2)
        >>> c1.value
        8
    """

    _counts: Dict[str, int] = field(default_factory=dict)

    # -- mutators ----------------------------------------------------------

    def increment(self, node: str, amount: int = 1) -> None:
        """Increment the counter for *node* by *amount* (must be >= 0)."""
        if amount < 0:
            raise ValueError("GCounter can only grow; amount must be >= 0")
        self._counts[node] = self._counts.get(node, 0) + amount

    def reset(self, node: str) -> None:
        """Reset a single node's counter (only safe if node is the sole writer)."""
        self._counts[node] = 0

    # -- queries -----------------------------------------------------------

    @property
    def value(self) -> int:
        """Global counter value (sum of all per-node counters)."""
        return sum(self._counts.values())

    def get(self, node: str) -> int:
        """Per-node counter value."""
        return self._counts.get(node, 0)

    def counts(self) -> Dict[str, int]:
        """Return a copy of the internal counter map."""
        return dict(self._counts)

    # -- CRDT merge --------------------------------------------------------

    def merge(self, other: GCounter) -> None:
        """Merge *other* into self (element-wise max)."""
        for node, count in other._counts.items():
            self._counts[node] = max(self._counts.get(node, 0), count)

    def merged(self, other: GCounter) -> GCounter:
        """Return a new GCounter that is the merge of self and other."""
        result = copy.deepcopy(self)
        result.merge(other)
        return result

    # -- serialization -----------------------------------------------------

    def to_dict(self) -> Dict[str, int]:
        return dict(self._counts)

    @classmethod
    def from_dict(cls, data: Dict[str, int]) -> GCounter:
        return cls(_counts=dict(data))

    # -- dunder ------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, GCounter):
            return NotImplemented
        return self._counts == other._counts

    def __repr__(self) -> str:
        return f"GCounter(value={self.value}, counts={self._counts})"

    def __hash__(self) -> int:
        return hash(tuple(sorted(self._counts.items())))
