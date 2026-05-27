"""G-Set — Grow-only set CRDT."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Generic, Iterator, Set, TypeVar

T = TypeVar("T")


@dataclass
class GSet(Generic[T]):
    """Grow-only set (G-Set) CRDT.

    Elements can only be added, never removed. Merge is set union.

    Example:
        >>> s1 = GSet()
        >>> s2 = GSet()
        >>> s1.add("a")
        >>> s2.add("b")
        >>> s1.merge(s2)
        >>> "a" in s1 and "b" in s1
        True
    """

    _elements: Set[T] = field(default_factory=set)

    # -- mutators ----------------------------------------------------------

    def add(self, element: T) -> None:
        """Add an element to the set."""
        self._elements.add(element)

    # -- queries -----------------------------------------------------------

    def contains(self, element: T) -> bool:
        return element in self._elements

    def elements(self) -> Set[T]:
        """Return a copy of the internal set."""
        return set(self._elements)

    @property
    def size(self) -> int:
        return len(self._elements)

    # -- CRDT merge --------------------------------------------------------

    def merge(self, other: GSet[T]) -> None:
        """Merge *other* into self (set union)."""
        self._elements |= other._elements

    def merged(self, other: GSet[T]) -> GSet[T]:
        result = copy.deepcopy(self)
        result.merge(other)
        return result

    # -- dunder ------------------------------------------------------------

    def __contains__(self, element: T) -> bool:
        return self.contains(element)

    def __len__(self) -> int:
        return self.size

    def __iter__(self) -> Iterator[T]:
        return iter(self._elements)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, GSet):
            return NotImplemented
        return self._elements == other._elements

    def __repr__(self) -> str:
        return f"GSet({self._elements!r})"
