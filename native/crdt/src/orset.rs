//! # Observed-Remove Set (OR-Set)
//!
//! A set that supports add and remove operations with proper conflict resolution.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::hash::Hash;

use superinstance_native_core::{CoreError, CoreResult};

/// An observed-remove set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ORSet<T>
where
    T: Clone + Eq + Hash + Serialize,
{
    /// Elements and their unique tags
    elements: HashMap<T, HashSet<String>>,

    /// Tombstones (removed elements)
    tombstones: HashSet<String>,
}

impl<T> ORSet<T>
where
    T: Clone + Eq + Hash + Serialize,
{
    /// Create a new OR-Set
    pub fn new() -> Self {
        Self {
            elements: HashMap::new(),
            tombstones: HashSet::new(),
        }
    }

    /// Add an element with a unique tag
    pub fn add(&mut self, element: T, node: &str) {
        // Generate unique tag
        let tag = format!("{}:{}", node, uuid::Uuid::new_v4());

        self.elements
            .entry(element)
            .or_insert_with(HashSet::new)
            .insert(tag);
    }

    /// Remove an element
    pub fn remove(&mut self, element: &T) {
        if let Some(tags) = self.elements.get(element) {
            // Mark all tags as tombstones
            for tag in tags {
                self.tombstones.insert(tag.clone());
            }

            // Remove from elements
            self.elements.remove(element);
        }
    }

    /// Check if an element is in the set
    pub fn contains(&self, element: &T) -> bool {
        self.elements.contains_key(element)
    }

    /// Get all elements
    pub fn elements(&self) -> Vec<T> {
        self.elements.keys().cloned().collect()
    }

    /// Get the number of elements
    pub fn len(&self) -> usize {
        self.elements.len()
    }

    /// Check if the set is empty
    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }

    /// Merge with another OR-Set
    pub fn merge(&mut self, other: &ORSet<T>) {
        // Merge elements (union of tags)
        for (element, tags) in &other.elements {
            let entry = self.elements.entry(element.clone()).or_insert_with(HashSet::new);
            entry.extend(tags.iter().cloned());
        }

        // Merge tombstones
        self.tombstones.extend(other.tombstones.iter().cloned());

        // Remove elements with only tombstone tags
        self.elements.retain(|_, tags| {
            tags.iter().any(|tag| !self.tombstones.contains(tag))
        });
    }

    /// Clear all elements
    pub fn clear(&mut self) {
        self.elements.clear();
        self.tombstones.clear();
    }

    /// Serialize to binary format (much faster than JSON)
    pub fn to_bytes(&self) -> Result<Vec<u8>, Box<bincode::ErrorKind>> {
        bincode::serialize(self)
    }

    /// Deserialize from binary format
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Box<bincode::ErrorKind>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        bincode::deserialize(bytes)
    }

    /// Get serialized size estimate
    pub fn serialized_size(&self) -> usize {
        // Rough estimate: each element with tags
        let elements_size: usize = self.elements.iter()
            .map(|(elem, tags)| {
                std::mem::size_of_val(elem) + tags.len() * 50 // rough tag size
            })
            .sum();
        elements_size + self.tombstones.len() * 50
    }
}

impl<T> Default for ORSet<T>
where
    T: Clone + Eq + Hash + Serialize,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Clone + Eq + Hash + Serialize> PartialEq for ORSet<T> {
    fn eq(&self, other: &Self) -> bool {
        // Compare by elements, not implementation details
        let self_elements: HashSet<_> = self.elements.keys().collect();
        let other_elements: HashSet<_> = other.elements.keys().collect();
        self_elements == other_elements
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_remove() {
        let mut set = ORSet::new();
        set.add("item1", "node1");
        set.add("item2", "node1");

        assert!(set.contains(&"item1"));
        assert!(set.contains(&"item2"));
        assert_eq!(set.len(), 2);

        set.remove(&"item1");
        assert!(!set.contains(&"item1"));
        assert!(set.contains(&"item2"));
        assert_eq!(set.len(), 1);
    }

    #[test]
    fn test_merge() {
        let mut set1 = ORSet::new();
        let mut set2 = ORSet::new();

        set1.add("item1", "node1");
        set2.add("item2", "node2");

        set1.merge(&set2);

        assert!(set1.contains(&"item1"));
        assert!(set1.contains(&"item2"));
        assert_eq!(set1.len(), 2);
    }

    #[test]
    fn test_merge_with_removal() {
        let mut set1 = ORSet::new();
        let mut set2 = ORSet::new();

        set1.add("item1", "node1");
        set1.remove(&"item1");

        set2.add("item1", "node2");

        set1.merge(&set2);

        // item1 should still be present (added by node2 after removal)
        assert!(set1.contains(&"item1"));
    }

    #[test]
    fn test_elements() {
        let mut set = ORSet::new();
        set.add(1, "node1");
        set.add(2, "node1");
        set.add(3, "node1");

        let mut elements = set.elements();
        elements.sort();

        assert_eq!(elements, vec![1, 2, 3]);
    }

    #[test]
    fn test_is_empty() {
        let mut set = ORSet::new();
        assert!(set.is_empty());

        set.add("item", "node1");
        assert!(!set.is_empty());

        set.remove(&"item");
        assert!(set.is_empty());
    }

    #[test]
    fn test_binary_serialization() {
        let mut set = ORSet::new();
        set.add("item1", "node1");
        set.add("item2", "node2");
        set.add("item3", "node1");

        // Serialize
        let bytes = set.to_bytes().unwrap();
        assert!(!bytes.is_empty());

        // Deserialize
        let deserialized = ORSet::<String>::from_bytes(&bytes).unwrap();
        assert_eq!(deserialized.len(), set.len());
        assert!(deserialized.contains(&"item1".to_string()));
        assert!(deserialized.contains(&"item2".to_string()));
        assert!(deserialized.contains(&"item3".to_string()));
    }

    #[test]
    fn test_serialization_with_tombstones() {
        let mut set = ORSet::new();
        set.add("item1", "node1");
        set.remove(&"item1");
        set.add("item2", "node2");

        // Serialize
        let bytes = set.to_bytes().unwrap();

        // Deserialize
        let deserialized = ORSet::<String>::from_bytes(&bytes).unwrap();
        assert!(!deserialized.contains(&"item1".to_string()));
        assert!(deserialized.contains(&"item2".to_string()));
    }
}
