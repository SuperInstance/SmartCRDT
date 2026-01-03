"""
Tests for CRDT functionality.
"""

import pytest
import sys
sys.path.insert(0, '../')

from superinstance import GCounter, PNCounter, LWWRegister, ORSet


class TestGCounter:
    """Test G-Counter functionality."""

    def test_create(self):
        """Test creating a counter."""
        counter = GCounter()
        assert counter.value() == 0

    def test_increment(self):
        """Test incrementing."""
        counter = GCounter()
        counter.increment("node1", 5)
        assert counter.value() == 5

    def test_increment_default(self):
        """Test increment with default amount."""
        counter = GCounter()
        counter.increment("node1")
        assert counter.value() == 1

    def test_multiple_increments(self):
        """Test multiple increments."""
        counter = GCounter()
        counter.increment("node1", 5)
        counter.increment("node1", 3)
        assert counter.value() == 8

    def test_multiple_nodes(self):
        """Test increments from multiple nodes."""
        counter = GCounter()
        counter.increment("node1", 5)
        counter.increment("node2", 3)
        counter.increment("node3", 7)
        assert counter.value() == 15

    def test_get_node_count(self):
        """Test getting count for specific node."""
        counter = GCounter()
        counter.increment("node1", 5)
        counter.increment("node2", 3)

        assert counter.get("node1") == 5
        assert counter.get("node2") == 3
        assert counter.get("node3") == 0

    def test_merge(self):
        """Test merging counters."""
        counter1 = GCounter()
        counter2 = GCounter()

        counter1.increment("node1", 5)
        counter2.increment("node2", 3)

        counter1.merge(counter2)

        assert counter1.value() == 8
        assert counter1.get("node1") == 5
        assert counter1.get("node2") == 3

    def test_merge_takes_max(self):
        """Test that merge takes maximum values."""
        counter1 = GCounter()
        counter2 = GCounter()

        counter1.increment("node1", 5)
        counter2.increment("node1", 10)

        counter1.merge(counter2)

        # Should take max
        assert counter1.get("node1") == 10

    def test_counts(self):
        """Test getting all counts."""
        counter = GCounter()
        counter.increment("node1", 5)
        counter.increment("node2", 3)

        counts = counter.counts()

        assert counts["node1"] == 5
        assert counts["node2"] == 3

    def test_reset(self):
        """Test resetting counter."""
        counter = GCounter()
        counter.increment("node1", 5)
        assert counter.value() == 5

        counter.reset()
        assert counter.value() == 0

    def test_serialization(self):
        """Test serialization to bytes."""
        counter = GCounter()
        counter.increment("node1", 5)
        counter.increment("node2", 10)

        data = counter.to_bytes()
        assert len(data) > 0

        counter2 = GCounter.from_bytes(data)
        assert counter2.value() == counter.value()
        assert counter2.get("node1") == 5
        assert counter2.get("node2") == 10

    def test_equality(self):
        """Test counter equality."""
        counter1 = GCounter()
        counter2 = GCounter()

        counter1.increment("node1", 5)
        counter2.increment("node1", 5)

        assert counter1 == counter2


class TestPNCounter:
    """Test PN-Counter functionality."""

    def test_create(self):
        """Test creating a counter."""
        counter = PNCounter()
        assert counter.value() == 0

    def test_increment(self):
        """Test incrementing."""
        counter = PNCounter()
        counter.increment("node1", 10)
        assert counter.value() == 10

    def test_decrement(self):
        """Test decrementing."""
        counter = PNCounter()
        counter.increment("node1", 10)
        counter.decrement("node1", 3)
        assert counter.value() == 7

    def test_negative_value(self):
        """Test counter going negative."""
        counter = PNCounter()
        counter.decrement("node1", 5)
        assert counter.value() == -5

    def test_merge(self):
        """Test merging PN-counters."""
        counter1 = PNCounter()
        counter2 = PNCounter()

        counter1.increment("node1", 10)
        counter1.decrement("node1", 3)

        counter2.increment("node1", 5)
        counter2.decrement("node1", 1)

        counter1.merge(counter2)

        # Net: (10-3) vs (5-1) -> should converge
        assert counter1.value() >= 0


class TestLWWRegister:
    """Test LWW Register functionality."""

    def test_create(self):
        """Test creating a register."""
        reg = LWWRegister("initial")
        assert reg.get() == "initial"

    def test_set(self):
        """Test setting value."""
        reg = LWWRegister("initial")
        reg.set("updated")
        assert reg.get() == "updated"

    def test_merge(self):
        """Test merging registers."""
        reg1 = LWWRegister("value1")
        reg2 = LWWRegister("value2")

        reg1.merge(reg2)

        # Later timestamp wins
        # (In this simple test, we can't control timestamps)
        assert reg1.get() in ["value1", "value2"]


class TestORSet:
    """Test OR-Set functionality."""

    def test_create(self):
        """Test creating a set."""
        set1 = ORSet()
        assert len(set1) == 0
        assert set1.is_empty()

    def test_add(self):
        """Test adding elements."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item2", "node1")

        assert len(set1) == 2
        assert "item1" in set1
        assert "item2" in set1

    def test_remove(self):
        """Test removing elements."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item2", "node1")

        assert set1.contains("item1")

        set1.remove("item1")
        assert not set1.contains("item1")
        assert set1.contains("item2")

    def test_elements(self):
        """Test getting all elements."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item2", "node2")
        set1.add("item3", "node1")

        elements = set1.elements()

        assert len(elements) == 3
        assert "item1" in elements
        assert "item2" in elements
        assert "item3" in elements

    def test_merge(self):
        """Test merging sets."""
        set1 = ORSet()
        set2 = ORSet()

        set1.add("item1", "node1")
        set2.add("item2", "node2")

        set1.merge(set2)

        assert len(set1) == 2
        assert "item1" in set1
        assert "item2" in set1

    def test_to_set(self):
        """Test converting to Python set."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item2", "node2")

        py_set = set1.to_set()

        assert isinstance(py_set, set)
        assert "item1" in py_set
        assert "item2" in py_set

    def test_iteration(self):
        """Test iterating over set."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item2", "node2")

        elements = list(set1)

        assert len(elements) == 2
        assert "item1" in elements
        assert "item2" in elements

    def test_add_duplicate(self):
        """Test adding duplicate element."""
        set1 = ORSet()
        set1.add("item1", "node1")
        set1.add("item1", "node1")

        # Should not duplicate
        assert len(set1) == 1

    def test_remove_nonexistent(self):
        """Test removing non-existent element."""
        set1 = ORSet()

        # Should not raise error
        set1.remove("nonexistent")
        assert len(set1) == 0


class TestCRDTIntegration:
    """Test CRDT integration scenarios."""

    def test_distributed_counter(self):
        """Test distributed counter scenario."""
        # Three nodes
        node_a = GCounter()
        node_b = GCounter()
        node_c = GCounter()

        # Each node increments
        node_a.increment("A", 10)
        node_b.increment("B", 15)
        node_c.increment("C", 20)

        # Merge: A gets all updates
        node_a.merge(node_b)
        node_a.merge(node_c)

        assert node_a.value() == 45

        # Verify convergence
        node_b.merge(node_a)
        assert node_a.value() == node_b.value()

    def test_collaborative_set(self):
        """Test collaborative set scenario."""
        # Two users editing a document
        user_a = ORSet()
        user_b = ORSet()

        # Both add paragraphs
        user_a.add("para1", "user_a")
        user_a.add("para2", "user_a")

        user_b.add("para3", "user_b")
        user_b.add("para4", "user_b")

        # Sync
        user_a.merge(user_b)

        assert len(user_a) == 4

        # User A removes para2
        user_a.remove("para2")

        # User B adds para5
        user_b.add("para5", "user_b")

        # Sync again
        user_a.merge(user_b)
        user_b.merge(user_a)

        # Should converge
        assert user_a.elements() == user_b.elements()
        assert len(user_a) == 4  # para1, para3, para4, para5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
