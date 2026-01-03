//! # FFI Bindings for CRDT

use napi_derive::napi;
use superinstance_native_crdt::{GCounter, PNCounter, LWWRegister, ORSet, Merge};

/// Grow-only counter
#[napi]
pub struct GrowOnlyCounter {
    inner: GCounter,
}

#[napi]
impl GrowOnlyCounter {
    /// Create a new G-Counter
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: GCounter::new(),
        }
    }

    /// Increment the counter
    #[napi]
    pub fn increment(&mut self, node: String, amount: u64) {
        self.inner.increment(&node, amount);
    }

    /// Get the current value
    #[napi]
    pub fn value(&self) -> u64 {
        self.inner.value()
    }

    /// Merge with another counter
    #[napi]
    pub fn merge(&mut self, other: &GrowOnlyCounter) {
        self.inner.merge(&other.inner);
    }

    /// Serialize to binary format (Buffer in Node.js)
    #[napi]
    pub fn toBytes(&self) -> Vec<u8> {
        self.inner.to_bytes().unwrap_or_default()
    }

    /// Deserialize from binary format
    #[napi]
    pub fn fromBytes(bytes: &[u8]) -> GrowOnlyCounter {
        GrowOnlyCounter {
            inner: GCounter::from_bytes(bytes).unwrap_or_default(),
        }
    }

    /// Get serialized size estimate
    #[napi]
    pub fn serializedSize(&self) -> usize {
        self.inner.serialized_size()
    }
}

/// Positive-negative counter
#[napi]
pub struct PositiveNegativeCounter {
    inner: PNCounter,
}

#[napi]
impl PositiveNegativeCounter {
    /// Create a new PN-Counter
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: PNCounter::new(),
        }
    }

    /// Increment the counter
    #[napi]
    pub fn increment(&mut self, node: String, amount: u64) {
        self.inner.increment(&node, amount);
    }

    /// Decrement the counter
    #[napi]
    pub fn decrement(&mut self, node: String, amount: u64) {
        self.inner.decrement(&node, amount);
    }

    /// Get the current value
    #[napi]
    pub fn value(&self) -> i64 {
        self.inner.value()
    }

    /// Merge with another counter
    #[napi]
    pub fn merge(&mut self, other: &PositiveNegativeCounter) {
        self.inner.merge(&other.inner);
    }

    /// Serialize to binary format (Buffer in Node.js)
    #[napi]
    pub fn toBytes(&self) -> Vec<u8> {
        self.inner.to_bytes().unwrap_or_default()
    }

    /// Deserialize from binary format
    #[napi]
    pub fn fromBytes(bytes: &[u8]) -> PositiveNegativeCounter {
        PositiveNegativeCounter {
            inner: PNCounter::from_bytes(bytes).unwrap_or_default(),
        }
    }

    /// Get serialized size estimate
    #[napi]
    pub fn serializedSize(&self) -> usize {
        self.inner.serialized_size()
    }
}

/// Last-write-wins register
#[napi]
pub struct LastWriteWinsRegister {
    inner: LWWRegister<String>,
}

#[napi]
impl LastWriteWinsRegister {
    /// Create a new register with initial value
    #[napi(constructor)]
    pub fn new(initial_value: String) -> Self {
        Self {
            inner: LWWRegister::new(initial_value),
        }
    }

    /// Get the current value
    #[napi]
    pub fn get(&self) -> String {
        self.inner.get().clone()
    }

    /// Set a new value
    #[napi]
    pub fn set(&mut self, value: String) {
        self.inner.set(value);
    }

    /// Merge with another register
    #[napi]
    pub fn merge(&mut self, other: &LastWriteWinsRegister) {
        self.inner.merge(&other.inner);
    }

    /// Serialize to binary format (Buffer in Node.js)
    #[napi]
    pub fn toBytes(&self) -> Vec<u8> {
        self.inner.to_bytes().unwrap_or_default()
    }

    /// Deserialize from binary format
    #[napi]
    pub fn fromBytes(bytes: &[u8]) -> LastWriteWinsRegister {
        LastWriteWinsRegister {
            inner: LWWRegister::<String>::from_bytes(bytes).unwrap_or_default(),
        }
    }

    /// Get serialized size estimate
    #[napi]
    pub fn serializedSize(&self) -> usize {
        self.inner.serialized_size()
    }
}

/// Observed-remove set
#[napi]
pub struct ObservedRemoveSet {
    inner: ORSet<String>,
}

#[napi]
impl ObservedRemoveSet {
    /// Create a new OR-Set
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: ORSet::new(),
        }
    }

    /// Add an element
    #[napi]
    pub fn add(&mut self, element: String, node: String) {
        self.inner.add(element, &node);
    }

    /// Remove an element
    #[napi]
    pub fn remove(&mut self, element: String) {
        self.inner.remove(&element);
    }

    /// Check if an element exists
    #[napi]
    pub fn contains(&self, element: String) -> bool {
        self.inner.contains(&element)
    }

    /// Get all elements
    #[napi]
    pub fn elements(&self) -> Vec<String> {
        self.inner.elements()
    }

    /// Get the size
    #[napi]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if empty
    #[napi]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Merge with another set
    #[napi]
    pub fn merge(&mut self, other: &ObservedRemoveSet) {
        self.inner.merge(&other.inner);
    }

    /// Serialize to binary format (Buffer in Node.js)
    #[napi]
    pub fn toBytes(&self) -> Vec<u8> {
        self.inner.to_bytes().unwrap_or_default()
    }

    /// Deserialize from binary format
    #[napi]
    pub fn fromBytes(bytes: &[u8]) -> ObservedRemoveSet {
        ObservedRemoveSet {
            inner: ORSet::<String>::from_bytes(bytes).unwrap_or_default(),
        }
    }

    /// Get serialized size estimate
    #[napi]
    pub fn serializedSize(&self) -> usize {
        self.inner.serialized_size()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gcounter() {
        let mut counter = GrowOnlyCounter::new();
        counter.increment("node1".to_string(), 5);
        assert_eq!(counter.value(), 5);
    }

    #[test]
    fn test_pncounter() {
        let mut counter = PositiveNegativeCounter::new();
        counter.increment("node1".to_string(), 10);
        counter.decrement("node1".to_string(), 3);
        assert_eq!(counter.value(), 7);
    }

    #[test]
    fn test_lww_register() {
        let mut reg = LastWriteWinsRegister::new("initial".to_string());
        assert_eq!(reg.get(), "initial");

        reg.set("updated".to_string());
        assert_eq!(reg.get(), "updated");
    }

    #[test]
    fn test_orset() {
        let mut set = ObservedRemoveSet::new();
        set.add("item1".to_string(), "node1".to_string());
        assert!(set.contains("item1".to_string()));
        assert_eq!(set.len(), 1);

        set.remove("item1".to_string());
        assert!(!set.contains("item1".to_string()));
        assert!(set.is_empty());
    }
}
