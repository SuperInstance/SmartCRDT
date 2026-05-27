"""LWW-Register — Last-Writer-Wins Register CRDT."""

from __future__ import annotations

import copy
import time
from dataclasses import dataclass
from typing import Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class LWWRegister(Generic[T]):
    """Last-Writer-Wins Register CRDT.

    Stores a single value tagged with a timestamp. On merge, the value with
    the higher timestamp wins. Ties are broken by a configurable node id to
    ensure deterministic convergence.

    Example:
        >>> r1 = LWWRegister("a", node="n1")
        >>> r2 = LWWRegister("b", node="n2")
        >>> r2.set("updated")
        >>> r1.merge(r2)
        >>> r1.value
        'updated'
    """

    _value: Optional[T] = None
    _timestamp: float = 0.0
    _node: str = ""

    def __init__(self, initial: Optional[T] = None, node: str = "") -> None:
        self._value = initial
        self._timestamp = time.time() if initial is not None else 0.0
        self._node = node

    # -- mutators ----------------------------------------------------------

    def set(self, value: T, timestamp: Optional[float] = None, node: Optional[str] = None) -> None:
        """Set a new value with the given (or current) timestamp."""
        self._value = value
        self._timestamp = timestamp if timestamp is not None else time.time()
        if node is not None:
            self._node = node

    # -- queries -----------------------------------------------------------

    @property
    def value(self) -> Optional[T]:
        return self._value

    @property
    def timestamp(self) -> float:
        return self._timestamp

    @property
    def node(self) -> str:
        return self._node

    # -- CRDT merge --------------------------------------------------------

    def merge(self, other: LWWRegister[T]) -> None:
        """Merge *other* into self (highest timestamp wins)."""
        if other._timestamp > self._timestamp:
            self._value = other._value
            self._timestamp = other._timestamp
            self._node = other._node
        elif other._timestamp == self._timestamp and other._node > self._node:
            # Tie-break by node id (deterministic)
            self._value = other._value
            self._timestamp = other._timestamp
            self._node = other._node

    def merged(self, other: LWWRegister[T]) -> LWWRegister[T]:
        result = copy.deepcopy(self)
        result.merge(other)
        return result

    # -- serialization -----------------------------------------------------

    def to_dict(self) -> dict:
        return {"value": self._value, "timestamp": self._timestamp, "node": self._node}

    @classmethod
    def from_dict(cls, data: dict) -> LWWRegister:
        reg = cls()
        reg._value = data["value"]
        reg._timestamp = data["timestamp"]
        reg._node = data.get("node", "")
        return reg

    # -- dunder ------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, LWWRegister):
            return NotImplemented
        return self._value == other._value and self._timestamp == other._timestamp

    def __repr__(self) -> str:
        return f"LWWRegister(value={self._value!r}, ts={self._timestamp}, node={self._node!r})"
