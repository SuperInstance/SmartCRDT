"""Comprehensive tests for SmartCRDT — covering merge, conflict resolution,
commutativity, associativity, and idempotency for all CRDT types."""

import copy
import time

import pytest

from smartcrdt import GCounter, GSet, LWWRegister, ORMap, PNCounter, VectorClock


# ─── VectorClock ─────────────────────────────────────────────────────────────

class TestVectorClock:
    def test_increment(self):
        vc = VectorClock()
        assert vc.increment("A") == 1
        assert vc.increment("A") == 2
        assert vc.get("B") == 0

    def test_merge(self):
        vc1 = VectorClock(_clocks={"A": 2, "B": 1})
        vc2 = VectorClock(_clocks={"A": 1, "C": 3})
        merged = vc1.merge(vc2)
        assert merged == VectorClock(_clocks={"A": 2, "B": 1, "C": 3})

    def test_merge_is_commutative(self):
        vc1 = VectorClock(_clocks={"A": 2})
        vc2 = VectorClock(_clocks={"B": 3})
        assert vc1.merge(vc2) == vc2.merge(vc1)

    def test_happens_before(self):
        vc1 = VectorClock(_clocks={"A": 1})
        vc2 = VectorClock(_clocks={"A": 2})
        assert vc1.happens_before(vc2)
        assert not vc2.happens_before(vc1)

    def test_concurrent(self):
        vc1 = VectorClock(_clocks={"A": 1})
        vc2 = VectorClock(_clocks={"B": 1})
        assert vc1.concurrent_with(vc2)

    def test_roundtrip_dict(self):
        vc = VectorClock(_clocks={"A": 2, "B": 3})
        assert VectorClock.from_dict(vc.to_dict()) == vc


# ─── GCounter ────────────────────────────────────────────────────────────────

class TestGCounter:
    def test_initial_value(self):
        assert GCounter().value == 0

    def test_increment(self):
        c = GCounter()
        c.increment("n1", 5)
        assert c.value == 5
        c.increment("n1", 3)
        assert c.value == 8

    def test_multiple_nodes(self):
        c = GCounter()
        c.increment("a", 2)
        c.increment("b", 3)
        c.increment("c", 5)
        assert c.value == 10

    def test_negative_amount_rejected(self):
        with pytest.raises(ValueError):
            GCounter().increment("x", -1)

    def test_merge_basic(self):
        c1, c2 = GCounter(), GCounter()
        c1.increment("a", 5)
        c2.increment("b", 3)
        c1.merge(c2)
        assert c1.value == 8

    def test_merge_takes_max(self):
        c1, c2 = GCounter(), GCounter()
        c1.increment("a", 5)
        c2.increment("a", 10)
        c1.merge(c2)
        assert c1.get("a") == 10
        assert c1.value == 10

    # ── CRDT properties ──

    def test_commutativity(self):
        a, b = GCounter(), GCounter()
        a.increment("x", 3)
        b.increment("y", 7)
        ab = copy.deepcopy(a); ab.merge(b)
        ba = copy.deepcopy(b); ba.merge(a)
        assert ab == ba

    def test_associativity(self):
        a, b, c = GCounter(), GCounter(), GCounter()
        a.increment("x", 1)
        b.increment("y", 2)
        c.increment("z", 3)
        left = copy.deepcopy(a); left.merge(b); left.merge(c)
        right = copy.deepcopy(a); right.merge(copy.deepcopy(b).merged(c))
        assert left == right

    def test_idempotency(self):
        a = GCounter()
        a.increment("x", 5)
        before = copy.deepcopy(a)
        a.merge(a)
        assert a == before

    def test_roundtrip_dict(self):
        c = GCounter()
        c.increment("a", 1)
        c.increment("b", 2)
        assert GCounter.from_dict(c.to_dict()) == c


# ─── PNCounter ───────────────────────────────────────────────────────────────

class TestPNCounter:
    def test_initial_value(self):
        assert PNCounter().value == 0

    def test_increment_decrement(self):
        c = PNCounter()
        c.increment("n1", 10)
        c.decrement("n1", 3)
        assert c.value == 7

    def test_negative(self):
        c = PNCounter()
        c.decrement("n1", 5)
        assert c.value == -5

    def test_merge(self):
        c1, c2 = PNCounter(), PNCounter()
        c1.increment("a", 10)
        c1.decrement("a", 3)
        c2.increment("b", 5)
        c2.decrement("b", 1)
        c1.merge(c2)
        assert c1.value == 11  # (10-3) + (5-1)

    def test_commutativity(self):
        a, b = PNCounter(), PNCounter()
        a.increment("x", 3); a.decrement("x", 1)
        b.increment("y", 7); b.decrement("y", 2)
        ab = copy.deepcopy(a); ab.merge(b)
        ba = copy.deepcopy(b); ba.merge(a)
        assert ab == ba

    def test_associativity(self):
        a, b, c = PNCounter(), PNCounter(), PNCounter()
        a.increment("x", 1); b.increment("y", 2); c.increment("z", 3)
        left = copy.deepcopy(a); left.merge(b); left.merge(c)
        right = copy.deepcopy(a); right.merge(copy.deepcopy(b).merged(c))
        assert left == right

    def test_idempotency(self):
        a = PNCounter()
        a.increment("x", 5); a.decrement("x", 2)
        before = copy.deepcopy(a)
        a.merge(a)
        assert a == before

    def test_roundtrip_dict(self):
        c = PNCounter()
        c.increment("a", 5); c.decrement("b", 2)
        assert PNCounter.from_dict(c.to_dict()) == c


# ─── GSet ────────────────────────────────────────────────────────────────────

class TestGSet:
    def test_empty(self):
        s = GSet()
        assert len(s) == 0

    def test_add_contains(self):
        s = GSet()
        s.add("x")
        assert "x" in s
        assert s.size == 1

    def test_add_duplicate_idempotent(self):
        s = GSet()
        s.add("x")
        s.add("x")
        assert len(s) == 1

    def test_merge_union(self):
        s1, s2 = GSet(), GSet()
        s1.add("a"); s1.add("b")
        s2.add("b"); s2.add("c")
        s1.merge(s2)
        assert s1.elements() == {"a", "b", "c"}

    def test_commutativity(self):
        a, b = GSet(), GSet()
        a.add("x"); b.add("y")
        ab = copy.deepcopy(a); ab.merge(b)
        ba = copy.deepcopy(b); ba.merge(a)
        assert ab == ba

    def test_associativity(self):
        a, b, c = GSet(), GSet(), GSet()
        a.add("1"); b.add("2"); c.add("3")
        left = copy.deepcopy(a); left.merge(b); left.merge(c)
        right = copy.deepcopy(a); right.merge(copy.deepcopy(b).merged(c))
        assert left == right

    def test_idempotency(self):
        a = GSet()
        a.add("x")
        before = copy.deepcopy(a)
        a.merge(a)
        assert a == before

    def test_iteration(self):
        s = GSet()
        s.add("a"); s.add("b")
        assert set(s) == {"a", "b"}


# ─── LWWRegister ─────────────────────────────────────────────────────────────

class TestLWWRegister:
    def test_initial(self):
        r = LWWRegister("hello", node="n1")
        assert r.value == "hello"

    def test_set(self):
        r = LWWRegister("a", node="n1")
        r.set("b")
        assert r.value == "b"

    def test_merge_higher_ts_wins(self):
        r1 = LWWRegister("old", node="n1")
        r2 = LWWRegister("new", node="n2")
        r1._timestamp = 100.0
        r2._timestamp = 200.0
        r1.merge(r2)
        assert r1.value == "new"

    def test_merge_lower_ts_loses(self):
        r1 = LWWRegister("old", node="n1")
        r2 = LWWRegister("new", node="n2")
        r1._timestamp = 200.0
        r2._timestamp = 100.0
        r1.merge(r2)
        assert r1.value == "old"

    def test_merge_tie_break_by_node(self):
        r1 = LWWRegister("a", node="n1")
        r2 = LWWRegister("b", node="n2")
        r1._timestamp = 100.0
        r2._timestamp = 100.0
        r1.merge(r2)
        # n2 > n1 alphabetically, so b wins
        assert r1.value == "b"

    def test_commutativity(self):
        r1 = LWWRegister("a", node="n1")
        r2 = LWWRegister("b", node="n2")
        r1._timestamp = 100.0
        r2._timestamp = 200.0
        ab = copy.deepcopy(r1); ab.merge(r2)
        ba = copy.deepcopy(r2); ba.merge(r1)
        assert ab.value == ba.value == "b"

    def test_idempotency(self):
        r = LWWRegister("x", node="n1")
        r._timestamp = 100.0
        before = copy.deepcopy(r)
        r.merge(r)
        assert r == before

    def test_roundtrip_dict(self):
        r = LWWRegister("hello", node="n1")
        r._timestamp = 42.0
        restored = LWWRegister.from_dict(r.to_dict())
        assert restored.value == "hello"
        assert restored.timestamp == 42.0


# ─── ORMap ────────────────────────────────────────────────────────────────────

class TestORMap:
    def test_put_get(self):
        m = ORMap()
        m.put("k", "v", "n1")
        assert m.get("k") == "v"

    def test_remove(self):
        m = ORMap()
        m.put("k", "v", "n1")
        m.remove("k")
        assert m.get("k") is None

    def test_merge_add_wins(self):
        m1, m2 = ORMap(), ORMap()
        m1.put("k", "v1", "n1")
        # m2 hasn't seen the add, but also doesn't have a remove
        # m2 adds a different value
        m2.put("k", "v2", "n2")
        m1.merge(m2)
        # After merge both entries exist; latest wins
        assert m1.get("k") is not None

    def test_merge_converges(self):
        m1, m2 = ORMap(), ORMap()
        m1.put("a", 1, "n1")
        m2.put("b", 2, "n2")
        m1.merge(m2)
        assert m1.get("a") == 1
        assert m1.get("b") == 2

    def test_remove_observed_only(self):
        m1, m2 = ORMap(), ORMap()
        m1.put("k", "v1", "n1")
        m1.remove("k")  # tombstones the dot
        # m2 concurrently adds
        m2.put("k", "v2", "n2")
        m1.merge(m2)
        # v2's dot isn't tombstoned, so add wins
        assert m1.get("k") == "v2"

    def test_commutativity(self):
        m1, m2 = ORMap(), ORMap()
        m1.put("a", 1, "n1")
        m2.put("b", 2, "n2")
        ab = copy.deepcopy(m1); ab.merge(m2)
        ba = copy.deepcopy(m2); ba.merge(m1)
        assert ab == ba

    def test_idempotency(self):
        m = ORMap()
        m.put("k", "v", "n1")
        before = copy.deepcopy(m)
        m.merge(m)
        assert m == before

    def test_keys_items_size(self):
        m = ORMap()
        m.put("a", 1, "n1")
        m.put("b", 2, "n1")
        assert m.size == 2
        assert m.keys() == {"a", "b"}
        assert set(m.items()) == {("a", 1), ("b", 2)}


# ─── Integration / distributed simulation ────────────────────────────────────

class TestDistributedSimulation:
    """Simulate a 3-node cluster syncing CRDTs."""

    def test_gcounter_convergence(self):
        nodes = [GCounter() for _ in range(3)]
        for i, n in enumerate(nodes):
            n.increment(f"N{i}", (i + 1) * 10)  # 10, 20, 30

        # Star topology: all merge into node 0
        for n in nodes[1:]:
            nodes[0].merge(n)

        total = nodes[0].value
        # Now propagate back
        for n in nodes[1:]:
            n.merge(nodes[0])
            assert n.value == total
        assert total == 60

    def test_pncounter_convergence(self):
        nodes = [PNCounter() for _ in range(3)]
        nodes[0].increment("N0", 100)
        nodes[0].decrement("N0", 30)
        nodes[1].increment("N1", 50)
        nodes[2].decrement("N2", 10)

        for n in nodes[1:]:
            nodes[0].merge(n)
        for n in nodes[1:]:
            n.merge(nodes[0])
        # All converge to the same value
        assert nodes[0].value == nodes[1].value == nodes[2].value

    def test_gset_convergence(self):
        nodes = [GSet() for _ in range(3)]
        nodes[0].add("a"); nodes[0].add("b")
        nodes[1].add("b"); nodes[1].add("c")
        nodes[2].add("d")

        for n in nodes[1:]:
            nodes[0].merge(n)
        for n in nodes[1:]:
            n.merge(nodes[0])
        expected = {"a", "b", "c", "d"}
        for n in nodes:
            assert n.elements() == expected

    def test_ormap_convergence(self):
        nodes = [ORMap() for _ in range(3)]
        nodes[0].put("k1", "v1", "N0")
        nodes[1].put("k2", "v2", "N1")
        nodes[2].put("k3", "v3", "N2")

        for n in nodes[1:]:
            nodes[0].merge(n)
        for n in nodes[1:]:
            n.merge(nodes[0])
        for n in nodes:
            assert n.keys() == {"k1", "k2", "k3"}
