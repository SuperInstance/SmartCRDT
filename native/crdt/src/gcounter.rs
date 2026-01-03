//! # G-Counter (Grow-only Counter)
//!
//! A counter that can only increment. Supports distributed merging.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use superinstance_native_core::{CoreError, CoreResult};

/// A grow-only counter (G-Counter)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCounter {
    /// Per-node counts
    counts: HashMap<String, u64>,
}

impl GCounter {
    /// Create a new G-Counter
    pub fn new() -> Self {
        Self {
            counts: HashMap::new(),
        }
    }

    /// Increment the counter for a node
    pub fn increment(&mut self, node: &str, amount: u64) {
        let entry = self.counts.entry(node.to_string()).or_insert(0);
        *entry = entry.saturating_add(amount);
    }

    /// Get the current value
    pub fn value(&self) -> u64 {
        self.counts.values().sum()
    }

    /// Get the count for a specific node
    pub fn get(&self, node: &str) -> Option<u64> {
        self.counts.get(node).copied()
    }

    /// Merge with another G-Counter
    ///
    /// Takes the maximum value for each node.
    pub fn merge(&mut self, other: &GCounter) {
        for (node, count) in &other.counts {
            let entry = self.counts.entry(node.clone()).or_insert(0);
            *entry = (*entry).max(*count);
        }
    }

    /// Check if two G-Counters are equal (same value)
    pub fn eq_value(&self, other: &GCounter) -> bool {
        self.value() == other.value()
    }

    /// Get all node counts
    pub fn counts(&self) -> &HashMap<String, u64> {
        &self.counts
    }

    /// Reset all counts (use with caution)
    pub fn reset(&mut self) {
        self.counts.clear();
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
        self.counts.len() * 18 + 8
    }
}

impl Default for GCounter {
    fn default() -> Self {
        Self::new()
    }
}

impl PartialEq for GCounter {
    fn eq(&self, other: &Self) -> bool {
        self.counts == other.counts
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_increment() {
        let mut counter = GCounter::new();
        counter.increment("node1", 5);
        counter.increment("node1", 3);
        assert_eq!(counter.value(), 8);
        assert_eq!(counter.get("node1"), Some(8));
    }

    #[test]
    fn test_merge() {
        let mut counter1 = GCounter::new();
        let mut counter2 = GCounter::new();

        counter1.increment("node1", 5);
        counter2.increment("node2", 3);

        counter1.merge(&counter2);

        assert_eq!(counter1.value(), 8);
        assert_eq!(counter1.get("node1"), Some(5));
        assert_eq!(counter1.get("node2"), Some(3));
    }

    #[test]
    fn test_merge_max() {
        let mut counter1 = GCounter::new();
        let mut counter2 = GCounter::new();

        counter1.increment("node1", 5);
        counter2.increment("node1", 10);

        counter1.merge(&counter2);

        // Should take max
        assert_eq!(counter1.get("node1"), Some(10));
    }

    #[test]
    fn test_multiple_nodes() {
        let mut counter = GCounter::new();
        counter.increment("node1", 5);
        counter.increment("node2", 3);
        counter.increment("node3", 7);

        assert_eq!(counter.value(), 15);
    }

    #[test]
    fn test_saturating_add() {
        let mut counter = GCounter::new();
        counter.increment("node1", u64::MAX - 10);
        counter.increment("node1", 20);

        // Should saturate at u64::MAX
        assert_eq!(counter.get("node1"), Some(u64::MAX));
    }

    #[test]
    fn test_binary_serialization() {
        let mut counter = GCounter::new();
        counter.increment("node1", 5);
        counter.increment("node2", 10);
        counter.increment("node3", 15);

        // Serialize
        let bytes = counter.to_bytes().unwrap();
        assert!(!bytes.is_empty());
        assert!(bytes.len() < 100); // Should be compact

        // Deserialize
        let deserialized = GCounter::from_bytes(&bytes).unwrap();
        assert_eq!(deserialized.value(), counter.value());
        assert_eq!(deserialized.get("node1"), counter.get("node1"));
        assert_eq!(deserialized.get("node2"), counter.get("node2"));
        assert_eq!(deserialized.get("node3"), counter.get("node3"));
    }

    #[test]
    fn test_serialized_size_estimate() {
        let mut counter = GCounter::new();
        counter.increment("node1", 5);
        counter.increment("node2", 10);

        let estimate = counter.serialized_size();
        let actual = counter.to_bytes().unwrap().len();

        // Estimate should be within 50% of actual
        assert!(estimate >= actual / 2);
        assert!(estimate <= actual * 2);
    }
}
