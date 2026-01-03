//! # PN-Counter (Positive-Negative Counter)
//!
//! A counter that supports both increments and decrements.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use superinstance_native_core::{CoreError, CoreResult};

/// A positive-negative counter (PN-Counter)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PNCounter {
    /// Positive counts (increments)
    p: HashMap<String, u64>,

    /// Negative counts (decrements)
    n: HashMap<String, u64>,
}

impl PNCounter {
    /// Create a new PN-Counter
    pub fn new() -> Self {
        Self {
            p: HashMap::new(),
            n: HashMap::new(),
        }
    }

    /// Increment the counter
    pub fn increment(&mut self, node: &str, amount: u64) {
        let entry = self.p.entry(node.to_string()).or_insert(0);
        *entry = entry.saturating_add(amount);
    }

    /// Decrement the counter
    pub fn decrement(&mut self, node: &str, amount: u64) {
        let entry = self.n.entry(node.to_string()).or_insert(0);
        *entry = entry.saturating_add(amount);
    }

    /// Get the current value (sum of increments - sum of decrements)
    pub fn value(&self) -> i64 {
        let p_sum: u64 = self.p.values().sum();
        let n_sum: u64 = self.n.values().sum();
        p_sum as i64 - n_sum as i64
    }

    /// Get positive counts
    pub fn positive_counts(&self) -> &HashMap<String, u64> {
        &self.p
    }

    /// Get negative counts
    pub fn negative_counts(&self) -> &HashMap<String, u64> {
        &self.n
    }

    /// Merge with another PN-Counter
    pub fn merge(&mut self, other: &PNCounter) {
        // Merge positive counts
        for (node, count) in &other.p {
            let entry = self.p.entry(node.clone()).or_insert(0);
            *entry = (*entry).max(*count);
        }

        // Merge negative counts
        for (node, count) in &other.n {
            let entry = self.n.entry(node.clone()).or_insert(0);
            *entry = (*entry).max(*count);
        }
    }

    /// Reset the counter
    pub fn reset(&mut self) {
        self.p.clear();
        self.n.clear();
    }

    /// Serialize to binary format (much faster than JSON)
    pub fn to_bytes(&self) -> Result<Vec<u8>, Box<bincode::ErrorKind>> {
        bincode::serialize(self)
    }

    /// Deserialize from binary format
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Box<bincode::ErrorKind>> {
        bincode::deserialize(bytes)
    }

    /// Get serialized size estimate
    pub fn serialized_size(&self) -> usize {
        // Rough estimate: each entry ~ (node_id avg 10 bytes + 8 bytes count)
        (self.p.len() + self.n.len()) * 18 + 16
    }
}

impl Default for PNCounter {
    fn default() -> Self {
        Self::new()
    }
}

impl PartialEq for PNCounter {
    fn eq(&self, other: &Self) -> bool {
        self.p == other.p && self.n == other.n
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_increment_decrement() {
        let mut counter = PNCounter::new();
        counter.increment("node1", 10);
        counter.decrement("node1", 3);
        assert_eq!(counter.value(), 7);
    }

    #[test]
    fn test_negative_value() {
        let mut counter = PNCounter::new();
        counter.decrement("node1", 5);
        counter.increment("node1", 3);
        assert_eq!(counter.value(), -2);
    }

    #[test]
    fn test_merge() {
        let mut counter1 = PNCounter::new();
        let mut counter2 = PNCounter::new();

        counter1.increment("node1", 10);
        counter2.increment("node2", 5);

        counter1.decrement("node1", 3);
        counter2.decrement("node2", 2);

        counter1.merge(&counter2);

        // Total: 15 increments - 5 decrements = 10
        assert_eq!(counter1.value(), 10);
    }

    #[test]
    fn test_merge_max() {
        let mut counter1 = PNCounter::new();
        let mut counter2 = PNCounter::new();

        counter1.increment("node1", 5);
        counter2.increment("node1", 10);

        counter1.merge(&counter2);

        assert_eq!(counter1.positive_counts().get("node1"), Some(&10));
    }

    #[test]
    fn test_binary_serialization() {
        let mut counter = PNCounter::new();
        counter.increment("node1", 10);
        counter.decrement("node1", 3);
        counter.increment("node2", 5);

        // Serialize
        let bytes = counter.to_bytes().unwrap();
        assert!(!bytes.is_empty());

        // Deserialize
        let deserialized = PNCounter::from_bytes(&bytes).unwrap();
        assert_eq!(deserialized.value(), counter.value());
        assert_eq!(deserialized.positive_counts(), counter.positive_counts());
        assert_eq!(deserialized.negative_counts(), counter.negative_counts());
    }
}
