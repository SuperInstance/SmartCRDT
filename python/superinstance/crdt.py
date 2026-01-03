"""
High-level CRDT (Conflict-free Replicated Data Types) API for Python.

Provides distributed data structures that can be merged without conflicts.
"""

from typing import Dict, List, Any
import json

try:
    from .superinstance import (
        PyGCounter,
        PyPNCounter,
        PyLWWRegister,
        PyORSet,
    )
except ImportError:
    raise ImportError(
        "Native module not found. Please build the Rust extension first."
    )


class GCounter:
    """
    Grow-only counter (G-Counter).

    A counter that can only increment. Supports distributed merging by taking
    the maximum value for each node.

    Example:
        >>> counter1 = GCounter()
        >>> counter2 = GCounter()
        >>> counter1.increment("node1", 5)
        >>> counter2.increment("node2", 3)
        >>> counter1.merge(counter2)
        >>> print(counter1.value())  # 8
    """

    def __init__(self):
        self._inner = PyGCounter()

    def increment(self, node: str, amount: int = 1) -> None:
        """
        Increment the counter for a node.

        Args:
            node: Node identifier
            amount: Amount to increment (default: 1)
        """
        self._inner.increment(node, amount)

    def value(self) -> int:
        """Get the current value."""
        return self._inner.value()

    def get(self, node: str) -> int:
        """Get the count for a specific node."""
        result = self._inner.get(node)
        return result if result is not None else 0

    def merge(self, other: "GCounter") -> None:
        """
        Merge with another G-Counter.

        Args:
            other: Another G-Counter to merge with
        """
        self._inner.merge(other._inner)

    def counts(self) -> Dict[str, int]:
        """Get all node counts."""
        return self._inner.counts()

    def reset(self) -> None:
        """Reset all counts (use with caution)."""
        self._inner.reset()

    def to_bytes(self) -> bytes:
        """Serialize to binary format."""
        return self._inner.to_bytes()

    @staticmethod
    def from_bytes(data: bytes) -> "GCounter":
        """Deserialize from binary format."""
        counter = GCounter()
        counter._inner = PyGCounter.from_bytes(data)
        return counter

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.counts())

    @staticmethod
    def from_json(data: str) -> "GCounter":
        """Deserialize from JSON string."""
        counts = json.loads(data)
        counter = GCounter()
        for node, value in counts.items():
            counter._inner.increment(node, value)
        return counter

    def __repr__(self) -> str:
        return f"GCounter(value={self.value()})"

    def __eq__(self, other) -> bool:
        if not isinstance(other, GCounter):
            return False
        return self.value() == other.value()


class PNCounter:
    """
    PN-Counter (supports increments and decrements).

    A counter that can be incremented and decremented. Maintains separate
    G-Counters for increments and decrements.

    Example:
        >>> counter = PNCounter()
        >>> counter.increment("node1", 10)
        >>> counter.decrement("node1", 3)
        >>> print(counter.value())  # 7
    """

    def __init__(self):
        self._inner = PyPNCounter()

    def increment(self, node: str, amount: int = 1) -> None:
        """Increment the counter for a node."""
        self._inner.increment(node, amount)

    def decrement(self, node: str, amount: int = 1) -> None:
        """Decrement the counter for a node."""
        self._inner.decrement(node, amount)

    def value(self) -> int:
        """Get the current value."""
        return self._inner.value()

    def merge(self, other: "PNCounter") -> None:
        """Merge with another PN-Counter."""
        self._inner.merge(other._inner)

    def __repr__(self) -> str:
        return f"PNCounter(value={self.value()})"


class LWWRegister:
    """
    Last-write-wins register.

    A register that stores a single value and uses timestamps to resolve
    conflicts (the most recent write wins).

    Example:
        >>> reg1 = LWWRegister("initial")
        >>> reg2 = LWWRegister("updated")
        >>> reg2.set("conflict")
        >>> reg1.merge(reg2)
        >>> print(reg1.get())  # "conflict"
    """

    def __init__(self, initial_value: str = ""):
        self._inner = PyLWWRegister(initial_value)

    def set(self, value: str) -> None:
        """Set the value."""
        self._inner.set(value)

    def get(self) -> str:
        """Get the current value."""
        return self._inner.get()

    def merge(self, other: "LWWRegister") -> None:
        """Merge with another register."""
        self._inner.merge(other._inner)

    def __repr__(self) -> str:
        return f"LWWRegister(value='{self.get()}')"


class ORSet:
    """
    Observed-remove set (OR-Set).

    A set data structure that supports add and remove operations with
    conflict-free merging.

    Example:
        >>> set1 = ORSet()
        >>> set2 = ORSet()
        >>> set1.add("item1", "node1")
        >>> set2.add("item2", "node2")
        >>> set1.merge(set2)
        >>> print(set1.elements())  # ["item1", "item2"]
    """

    def __init__(self):
        self._inner = PyORSet()

    def add(self, element: str, node: str) -> None:
        """
        Add an element to the set.

        Args:
            element: Element to add
            node: Node identifier
        """
        self._inner.add(element, node)

    def remove(self, element: str) -> None:
        """Remove an element from the set."""
        self._inner.remove(element)

    def contains(self, element: str) -> bool:
        """Check if element is in the set."""
        return self._inner.contains(element)

    def elements(self) -> List[str]:
        """Get all elements."""
        return self._inner.elements()

    def __len__(self) -> int:
        """Get the size of the set."""
        return self._inner.len()

    def is_empty(self) -> bool:
        """Check if set is empty."""
        return self._inner.is_empty()

    def merge(self, other: "ORSet") -> None:
        """Merge with another set."""
        self._inner.merge(other._inner)

    def to_set(self) -> set:
        """Convert to Python set."""
        return set(self.elements())

    def __contains__(self, element: str) -> bool:
        return self.contains(element)

    def __iter__(self):
        return iter(self.elements())

    def __repr__(self) -> str:
        return f"ORSet({self.elements()})"


def demo_crdt_sync():
    """Demonstrate CRDT synchronization between nodes."""
    print("=== CRDT Synchronization Demo ===\n")

    # G-Counter demo
    print("1. G-Counter (Grow-only Counter)")
    counter1 = GCounter()
    counter2 = GCounter()

    counter1.increment("node1", 5)
    counter2.increment("node2", 3)

    print(f"   Node1 count: {counter1.value()}")
    print(f"   Node2 count: {counter2.value()}")

    counter1.merge(counter2)
    print(f"   After merge: {counter1.value()}")
    print()

    # PN-Counter demo
    print("2. PN-Counter (Increment/Decrement)")
    counter = PNCounter()
    counter.increment("node1", 10)
    counter.decrement("node1", 3)
    print(f"   Value: {counter.value()}")
    print()

    # OR-Set demo
    print("3. OR-Set (Observed-Remove Set)")
    set1 = ORSet()
    set2 = ORSet()

    set1.add("item1", "node1")
    set1.add("item2", "node1")
    set2.add("item3", "node2")

    print(f"   Set1: {set1.elements()}")
    print(f"   Set2: {set2.elements()}")

    set1.merge(set2)
    print(f"   After merge: {set1.elements()}")
    print()


if __name__ == "__main__":
    demo_crdt_sync()
