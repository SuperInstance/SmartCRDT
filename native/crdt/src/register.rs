//! # Registers
//!
//! Last-write-wins register implementation.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

use superinstance_native_core::{CoreError, CoreResult};

/// Last-write-wins register
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LWWRegister<T> {
    /// Current value
    value: T,

    /// Timestamp of last write
    timestamp: u64,

    /// Node ID that performed the write
    node: String,
}

impl<T> LWWRegister<T>
where
    T: Clone,
{
    /// Create a new register with initial value
    pub fn new(value: T) -> Self {
        Self {
            value,
            timestamp: 0,
            node: String::new(),
        }
    }

    /// Create a register with value, timestamp, and node
    pub fn with_metadata(value: T, timestamp: u64, node: String) -> Self {
        Self {
            value,
            timestamp,
            node,
        }
    }

    /// Get the current value
    pub fn get(&self) -> &T {
        &self.value
    }

    /// Set a new value (updates timestamp)
    pub fn set(&mut self, value: T) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.value = value;
        self.timestamp = now;
        self.node.clear();
    }

    /// Set with explicit timestamp and node
    pub fn set_with_metadata(&mut self, value: T, timestamp: u64, node: String) {
        self.value = value;
        self.timestamp = timestamp;
        self.node = node;
    }

    /// Get timestamp
    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }

    /// Get node ID
    pub fn node(&self) -> &str {
        &self.node
    }

    /// Merge with another register (last write wins)
    pub fn merge(&mut self, other: &LWWRegister<T>) {
        match self.timestamp.cmp(&other.timestamp) {
            Ordering::Less => {
                self.value = other.value.clone();
                self.timestamp = other.timestamp;
                self.node = other.node.clone();
            }
            Ordering::Greater => {
                // Keep current value
            }
            Ordering::Equal => {
                // Same timestamp, use node ID as tiebreaker
                if self.node < other.node {
                    self.value = other.value.clone();
                    self.node = other.node.clone();
                }
            }
        }
    }

    /// Serialize to binary format (much faster than JSON)
    pub fn to_bytes(&self) -> Result<Vec<u8>, Box<bincode::ErrorKind>>
    where
        T: Serialize,
    {
        bincode::serialize(self)
    }

    /// Deserialize from binary format
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Box<bincode::ErrorKind>>
    where
        T: for<'de> Deserialize<'de>,
    {
        bincode::deserialize(bytes)
    }

    /// Get serialized size estimate
    pub fn serialized_size(&self) -> usize {
        // Rough estimate: value size + timestamp (8) + node_id avg (10)
        std::mem::size_of_val(&self.value) + 18
    }
}

impl<T> Default for LWWRegister<T>
where
    T: Default + Clone,
{
    fn default() -> Self {
        Self::new(T::default())
    }
}

impl<T: Clone + PartialEq> PartialEq for LWWRegister<T> {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
            && self.timestamp == other.timestamp
            && self.node == other.node
    }
}

/// Generic register trait
pub trait Register<T> {
    /// Get the current value
    fn get(&self) -> &T;

    /// Set a new value
    fn set(&mut self, value: T);

    /// Merge with another register
    fn merge(&mut self, other: &Self);
}

impl<T: Clone> Register<T> for LWWRegister<T> {
    fn get(&self) -> &T {
        self.get()
    }

    fn set(&mut self, value: T) {
        self.set(value)
    }

    fn merge(&mut self, other: &Self) {
        self.merge(other)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_set() {
        let mut reg = LWWRegister::new(42);
        assert_eq!(*reg.get(), 42);

        reg.set(100);
        assert_eq!(*reg.get(), 100);
    }

    #[test]
    fn test_merge() {
        let mut reg1 = LWWRegister::with_metadata("value1".to_string(), 100, "node1".to_string());
        let reg2 = LWWRegister::with_metadata("value2".to_string(), 200, "node2".to_string());

        reg1.merge(&reg2);

        // reg2 has later timestamp
        assert_eq!(*reg1.get(), "value2");
        assert_eq!(reg1.timestamp(), 200);
    }

    #[test]
    fn test_merge_same_timestamp() {
        let mut reg1 = LWWRegister::with_metadata("value1".to_string(), 100, "node_a".to_string());
        let reg2 = LWWRegister::with_metadata("value2".to_string(), 100, "node_b".to_string());

        reg1.merge(&reg2);

        // node_b > node_a, so should take reg2's value
        assert_eq!(*reg1.get(), "value2");
    }

    #[test]
    fn test_binary_serialization() {
        let mut reg = LWWRegister::new("test_value".to_string());
        reg.set("updated_value".to_string());

        // Serialize
        let bytes = reg.to_bytes().unwrap();
        assert!(!bytes.is_empty());

        // Deserialize
        let deserialized = LWWRegister::<String>::from_bytes(&bytes).unwrap();
        assert_eq!(*deserialized.get(), *reg.get());
        assert_eq!(deserialized.timestamp(), reg.timestamp());
    }
}
