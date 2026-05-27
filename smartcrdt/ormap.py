"""OR-Map — Observed-Remove Map CRDT."""

from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List, Optional, Set, Tuple, TypeVar

K = TypeVar("K")
V = TypeVar("V")

# Each add is tagged with a unique dot (uuid).
# Removes record which dots they observed (tombstone).


@dataclass
class ORMap(Generic[K, V]):
    """Observed-Remove Map CRDT.

    Supports add / remove / update of key-value pairs. Removes only affect
    values that have been observed, so concurrent add-remove pairs resolve
    in favor of the add (add-wins semantics).

    Example:
        >>> m1 = ORMap()
        >>> m2 = ORMap()
        >>> m1.put("k", "v1", "node1")
        >>> m2.put("k", "v2", "node2")
        >>> m1.merge(m2)
        >>> m1.get("k") is not None
        True
    """

    # key -> list of (dot, value) entries (active additions)
    _entries: Dict[K, List[Tuple[str, V]]] = field(default_factory=dict)
    # key -> set of dots that have been removed (tombstones)
    _tombstones: Dict[K, Set[str]] = field(default_factory=dict)

    # -- mutators ----------------------------------------------------------

    def put(self, key: K, value: V, node: str) -> None:
        """Insert or update *key* with *value* on behalf of *node*."""
        dot = f"{node}:{uuid.uuid4()}"
        # Remove existing visible entries (record them as tombstoned)
        if key in self._entries:
            for existing_dot, _ in self._entries[key]:
                self._tombstones.setdefault(key, set()).add(existing_dot)
        self._entries.setdefault(key, []).append((dot, value))

    def remove(self, key: K) -> None:
        """Remove *key* by tombstoning all observed dots for it."""
        if key in self._entries:
            for dot, _ in self._entries[key]:
                self._tombstones.setdefault(key, set()).add(dot)
            del self._entries[key]

    # -- queries -----------------------------------------------------------

    def get(self, key: K) -> Optional[V]:
        """Get the value for *key*, or None if absent / removed."""
        if key not in self._entries or not self._entries[key]:
            return None
        # Return the value of the latest visible entry
        return self._entries[key][-1][1]

    def keys(self) -> Set[K]:
        """Active keys."""
        return {k for k, v in self._entries.items() if v}

    def items(self) -> List[Tuple[K, V]]:
        """Active key-value pairs."""
        result: List[Tuple[K, V]] = []
        for key, entries in self._entries.items():
            if entries:
                result.append((key, entries[-1][1]))
        return result

    @property
    def size(self) -> int:
        return len(self.keys())

    def contains(self, key: K) -> bool:
        return key in self.keys()

    # -- CRDT merge --------------------------------------------------------

    def merge(self, other: ORMap[K, V]) -> None:
        """Merge *other* into self (observed-remove semantics)."""
        # Merge tombstones (union)
        for key, dots in other._tombstones.items():
            self._tombstones.setdefault(key, set()).update(dots)

        # Merge entries: add entries from other, dropping tombstoned ones
        for key, entries in other._entries.items():
            for dot, value in entries:
                if dot not in self._tombstones.get(key, set()):
                    # Check if we already have this dot
                    existing_dots = {d for d, _ in self._entries.get(key, [])}
                    if dot not in existing_dots:
                        self._entries.setdefault(key, []).append((dot, value))

        # Purge tombstoned entries from self
        for key in list(self._entries.keys()):
            self._entries[key] = [
                (d, v) for d, v in self._entries[key]
                if d not in self._tombstones.get(key, set())
            ]
            if not self._entries[key]:
                del self._entries[key]

    def merged(self, other: ORMap[K, V]) -> ORMap[K, V]:
        result = copy.deepcopy(self)
        result.merge(other)
        return result

    # -- dunder ------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ORMap):
            return NotImplemented
        return self.keys() == other.keys() and all(
            self.get(k) == other.get(k) for k in self.keys() | other.keys()
        )

    def __repr__(self) -> str:
        items = ", ".join(f"{k!r}: {v!r}" for k, v in self.items())
        return f"ORMap({{{items}}})"
