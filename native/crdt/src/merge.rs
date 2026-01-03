//! # CRDT Merge Trait
//!
//! Common merge trait for all CRDT types.

use std::fmt::Debug;

/// Trait for CRDT merge operations
pub trait Merge: Clone + Debug {
    /// Merge another CRDT into this one
    ///
    /// This operation should be:
    /// - Commutative: a.merge(b) == b.merge(a)
    /// - Associative: a.merge(b).merge(c) == a.merge(b.merge(c))
    /// - Idempotent: a.merge(a) == a
    fn merge(&mut self, other: &Self);

    /// Create a merged copy without modifying self
    fn merged(&self, other: &Self) -> Self
    where
        Self: Sized,
    {
        let mut copy = self.clone();
        copy.merge(other);
        copy
    }
}

impl Merge for super::GCounter {
    fn merge(&mut self, other: &Self) {
        self.merge(other);
    }
}

impl Merge for super::PNCounter {
    fn merge(&mut self, other: &Self) {
        self.merge(other);
    }
}

impl<T: Clone + std::fmt::Debug> Merge for super::LWWRegister<T> {
    fn merge(&mut self, other: &Self) {
        self.merge(other);
    }
}

impl<T: Clone + Eq + std::hash::Hash + serde::Serialize + std::fmt::Debug> Merge for super::ORSet<T> {
    fn merge(&mut self, other: &Self) {
        self.merge(other);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::{GCounter, PNCounter};

    #[test]
    fn test_merge_trait_commutative() {
        let mut a = GCounter::new();
        let mut b = GCounter::new();

        a.increment("node1", 5);
        b.increment("node2", 3);

        let mut a_clone = a.clone();
        let mut b_clone = b.clone();

        a_clone.merge(&b);
        b_clone.merge(&a);

        // Should be equal (commutative)
        assert_eq!(a_clone, b_clone);
    }

    #[test]
    fn test_merge_trait_associative() {
        let mut a = GCounter::new();
        let mut b = GCounter::new();
        let mut c = GCounter::new();

        a.increment("node1", 1);
        b.increment("node2", 2);
        c.increment("node3", 3);

        let mut a1 = a.clone();
        let b1 = b.clone();
        let c1 = c.clone();

        // (a merge b) merge c
        a1.merge(&b);
        a1.merge(&c);

        // a merge (b merge c)
        let mut b2 = b1;
        b2.merge(&c1);
        let mut a2 = a;
        a2.merge(&b2);

        // Should be equal (associative)
        assert_eq!(a1, a2);
    }

    #[test]
    fn test_merge_trait_idempotent() {
        let mut a = GCounter::new();
        a.increment("node1", 5);

        let a_clone = a.clone();
        a.merge(&a_clone);

        // Should be unchanged (idempotent)
        assert_eq!(a.value(), 5);
    }

    #[test]
    fn test_merged_method() {
        let mut a = GCounter::new();
        let mut b = GCounter::new();

        a.increment("node1", 5);
        b.increment("node2", 3);

        let merged = a.merged(&b);

        // Original should be unchanged
        assert_eq!(a.value(), 5);

        // Merged should have both
        assert_eq!(merged.value(), 8);
    }
}
