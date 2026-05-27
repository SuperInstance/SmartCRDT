"""PN-Counter — Positive-Negative counter CRDT."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict, Tuple

from .gcounter import GCounter


@dataclass
class PNCounter:
    """PN-Counter (increment / decrement) CRDT.

    Implemented as a pair of G-Counters: one for increments (P) and one
    for decrements (N). The value is P.value - N.value.

    Example:
        >>> c = PNCounter()
        >>> c.increment("node1", 10)
        >>> c.decrement("node1", 3)
        >>> c.value
        7
    """

    _p: GCounter = field(default_factory=GCounter)
    _n: GCounter = field(default_factory=GCounter)

    # -- mutators ----------------------------------------------------------

    def increment(self, node: str, amount: int = 1) -> None:
        """Increment the counter for *node*."""
        self._p.increment(node, amount)

    def decrement(self, node: str, amount: int = 1) -> None:
        """Decrement the counter for *node*."""
        self._n.increment(node, amount)

    # -- queries -----------------------------------------------------------

    @property
    def value(self) -> int:
        """Current value (increments minus decrements)."""
        return self._p.value - self._n.value

    def positive_counts(self) -> Dict[str, int]:
        return self._p.counts()

    def negative_counts(self) -> Dict[str, int]:
        return self._n.counts()

    # -- CRDT merge --------------------------------------------------------

    def merge(self, other: PNCounter) -> None:
        """Merge *other* into self."""
        self._p.merge(other._p)
        self._n.merge(other._n)

    def merged(self, other: PNCounter) -> PNCounter:
        """Return a new PNCounter that is the merge of self and other."""
        result = copy.deepcopy(self)
        result.merge(other)
        return result

    # -- serialization -----------------------------------------------------

    def to_dict(self) -> Dict[str, Dict[str, int]]:
        return {"p": self._p.to_dict(), "n": self._n.to_dict()}

    @classmethod
    def from_dict(cls, data: Dict[str, Dict[str, int]]) -> PNCounter:
        return cls(
            _p=GCounter.from_dict(data.get("p", {})),
            _n=GCounter.from_dict(data.get("n", {})),
        )

    # -- dunder ------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, PNCounter):
            return NotImplemented
        return self._p == other._p and self._n == other._n

    def __repr__(self) -> str:
        return f"PNCounter(value={self.value})"
