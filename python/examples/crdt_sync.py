#!/usr/bin/env python3
"""
CRDT Synchronization Example using SuperInstance.

Demonstrates conflict-free replicated data types for distributed systems.
"""

import sys
sys.path.insert(0, '../')

from superinstance import GCounter, PNCounter, LWWRegister, ORSet


def print_section(title: str):
    """Print a section header."""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def demo_gcounter():
    """Demonstrate G-Counter (Grow-only Counter)."""
    print_section("G-Counter (Grow-only Counter)")

    # Create two counters representing different nodes
    print("\n1. Creating two counters (node1, node2)...")
    counter1 = GCounter()
    counter2 = GCounter()

    # Increment counters
    print("\n2. Incrementing counters...")
    counter1.increment("node1", 5)
    print(f"   node1 counter: {counter1.value()}")

    counter2.increment("node2", 3)
    print(f"   node2 counter: {counter2.value()}")

    counter1.increment("node1", 2)
    print(f"   node1 counter (after +2): {counter1.value()}")

    # Merge counters
    print("\n3. Merging counters...")
    counter1.merge(counter2)
    print(f"   node1 counter after merge: {counter1.value()}")
    print(f"   Breakdown: {counter1.counts()}")

    # Demonstrate convergent merge
    print("\n4. Demonstrating convergent merge...")
    counter_a = GCounter()
    counter_b = GCounter()

    counter_a.increment("node_a", 10)
    counter_b.increment("node_b", 15)

    counter_a.merge(counter_b)
    counter_b.merge(counter_a)  # Merge both ways

    print(f"   Counter A: {counter_a.value()}")
    print(f"   Counter B: {counter_b.value()}")
    print(f"   Converged: {counter_a.value() == counter_b.value()}")

    # Demonstrate serialization
    print("\n5. Serialization...")
    data = counter1.to_bytes()
    print(f"   Serialized size: {len(data)} bytes")

    counter3 = GCounter.from_bytes(data)
    print(f"   Deserialized value: {counter3.value()}")
    print(f"   Values match: {counter3.value() == counter1.value()}")


def demo_pncounter():
    """Demonstrate PN-Counter (Increment/Decrement)."""
    print_section("PN-Counter (Increment/Decrement)")

    counter = PNCounter()

    print("\n1. Incrementing...")
    counter.increment("node1", 10)
    print(f"   Value: {counter.value()}")

    print("\n2. Decrementing...")
    counter.decrement("node1", 3)
    print(f"   Value: {counter.value()}")

    print("\n3. Multiple operations...")
    counter.increment("node1", 5)
    counter.increment("node2", 8)
    counter.decrement("node2", 2)
    print(f"   Value: {counter.value()}")

    # Distributed example
    print("\n4. Distributed sync...")
    counter_a = PNCounter()
    counter_b = PNCounter()

    counter_a.increment("node_a", 20)
    counter_a.decrement("node_a", 5)

    counter_b.increment("node_b", 10)
    counter_b.decrement("node_b", 3)

    print(f"   Counter A: {counter_a.value()}")
    print(f"   Counter B: {counter_b.value()}")

    counter_a.merge(counter_b)
    print(f"   After merge: {counter_a.value()}")


def demo_lww_register():
    """Demonstrate LWW Register (Last-Write-Wins)."""
    print_section("LWW Register (Last-Write-Wins)")

    print("\n1. Creating registers...")
    reg1 = LWWRegister("initial_value")
    reg2 = LWWRegister("initial_value")

    print(f"   reg1: {reg1.get()}")
    print(f"   reg2: {reg2.get()}")

    print("\n2. Concurrent updates...")
    reg1.set("update_from_node1")
    reg2.set("update_from_node2")

    print(f"   reg1: {reg1.get()}")
    print(f"   reg2: {reg2.get()}")

    print("\n3. Merging (last write wins)...")
    reg1.merge(reg2)
    print(f"   After merge: {reg1.get()}")
    print(f"   Note: Later timestamp wins")


def demo_orset():
    """Demonstrate OR-Set (Observed-Remove Set)."""
    print_section("OR-Set (Observed-Remove Set)")

    print("\n1. Creating sets...")
    set1 = ORSet()
    set2 = ORSet()

    print("\n2. Adding elements...")
    set1.add("item1", "node1")
    set1.add("item2", "node1")
    set2.add("item3", "node2")

    print(f"   set1: {set1.elements()}")
    print(f"   set2: {set2.elements()}")

    print("\n3. Merging sets...")
    set1.merge(set2)
    print(f"   Merged: {set1.elements()}")
    print(f"   Size: {len(set1)}")

    print("\n4. Removing elements...")
    set1.remove("item2")
    print(f"   After removing 'item2': {set1.elements()}")

    print("\n5. Checking membership...")
    print(f"   Contains 'item1': {set1.contains('item1')}")
    print(f"   Contains 'item2': {set1.contains('item2')}")

    # Demonstrate add-remove-add
    print("\n6. Add-Remove-Add pattern...")
    set_a = ORSet()
    set_b = ORSet()

    set_a.add("document.txt", "node_a")
    print(f"   set_a added 'document.txt': {set_a.elements()}")

    set_a.remove("document.txt")
    print(f"   set_a removed 'document.txt': {set_a.elements()}")

    # Before set_a sees the remove, set_b adds it again
    set_b.add("document.txt", "node_b")
    print(f"   set_b added 'document.txt': {set_b.elements()}")

    # When merged, both adds and removes are preserved
    set_a.merge(set_b)
    print(f"   After merge: {set_a.elements()}")
    print(f"   Note: OR-Set correctly handles this")


def demo_real_world_scenario():
    """Demonstrate a real-world collaborative scenario."""
    print_section("Real-World Scenario: Collaborative Document Editor")

    # Simulate a collaborative document editor
    print("\nScenario: Three users editing a document")
    print("-" * 60)

    # Track edits with G-Counter
    print("\n1. Tracking total edits with G-Counter...")
    user_edits = GCounter()

    user_edits.increment("alice", 15)
    user_edits.increment("bob", 23)
    user_edits.increment("charlie", 8)

    print(f"   Alice's edits: {user_edits.get('alice')}")
    print(f"   Bob's edits: {user_edits.get('bob')}")
    print(f"   Charlie's edits: {user_edits.get('charlie')}")
    print(f"   Total edits: {user_edits.value()}")

    # Track document version with PN-Counter
    print("\n2. Tracking document version with PN-Counter...")
    version = PNCounter()

    version.increment("additions", 50)
    version.decrement("deletions", 12)
    print(f"   Net additions: {version.value()}")

    # Track active users with OR-Set
    print("\n3. Tracking active users with OR-Set...")
    active_users = ORSet()

    active_users.add("alice", "server1")
    active_users.add("bob", "server2")
    active_users.add("charlie", "server1")

    print(f"   Active users: {active_users.elements()}")
    print(f"   Total: {len(active_users)}")

    # User leaves
    active_users.remove("bob")
    print(f"   After Bob leaves: {active_users.elements()}")

    # Track current document content with LWW Register
    print("\n4. Tracking document content with LWW Register...")
    content = LWWRegister("Initial content")

    content.set("Updated by Alice")
    print(f"   Content: {content.get()}")

    content.set("Updated by Bob (later timestamp)")
    print(f"   Content: {content.get()}")


def main():
    """Run all demonstrations."""
    print("\n" + "=" * 60)
    print("CRDT Synchronization Examples")
    print("=" * 60)

    demo_gcounter()
    demo_pncounter()
    demo_lww_register()
    demo_orset()
    demo_real_world_scenario()

    print("\n" + "=" * 60)
    print("All examples complete!")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
