//! # SuperInstance Native CRDT
//!
//! Conflict-free Replicated Data Types for distributed knowledge storage.
//!
//! ## Features
//!
//! - **G-Counter**: Grow-only counter for increments
//! - **PN-Counter**: Counter supporting both increments and decrements
//! - **LWW-Register**: Last-write-wins register
//! - **OR-Set**: Observed-remove set
//! - **Merge**: Automatic conflict resolution

pub mod gcounter;
pub mod pncounter;
pub mod register;
pub mod orset;
pub mod merge;

pub use gcounter::GCounter;
pub use pncounter::PNCounter;
pub use register::{LWWRegister, Register};
pub use orset::ORSet;
pub use merge::Merge;

use superinstance_native_core::CoreResult;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json;

    #[test]
    fn test_gcounter() {
        let mut counter1 = GCounter::new();
        let mut counter2 = GCounter::new();

        counter1.increment("node1", 5);
        counter2.increment("node2", 3);

        counter1.merge(&counter2);

        assert_eq!(counter1.value(), 8);
    }

    #[test]
    fn test_pncounter() {
        let mut counter = PNCounter::new();
        counter.increment("node1", 10);
        counter.decrement("node1", 3);
        assert_eq!(counter.value(), 7);
    }

    #[test]
    fn test_lww_register() {
        let mut reg1 = LWWRegister::new("initial".to_string());
        let mut reg2 = LWWRegister::new("updated".to_string());

        // Simulate concurrent updates
        std::thread::sleep(std::time::Duration::from_millis(10));
        reg2.set("conflict".to_string());

        reg1.merge(&reg2);

        // Last write wins
        assert_eq!(reg1.get(), "conflict");
    }

    #[test]
    fn test_orset() {
        let mut set1 = ORSet::new();
        let mut set2 = ORSet::new();

        set1.add("item1".to_string(), "node1");
        set2.add("item2".to_string(), "node2");

        set1.merge(&set2);

        assert!(set1.contains(&"item1".to_string()));
        assert!(set1.contains(&"item2".to_string()));
        assert_eq!(set1.len(), 2);
    }

    #[test]
    fn bench_serialization_gcounter() {
        let mut counter = GCounter::new();
        for i in 0..100 {
            counter.increment(&format!("node{}", i), i);
        }

        // Binary serialization
        let start = std::time::Instant::now();
        let binary_bytes = counter.to_bytes().unwrap();
        let binary_encode_time = start.elapsed();
        let binary_size = binary_bytes.len();

        let start = std::time::Instant::now();
        let _decoded = GCounter::from_bytes(&binary_bytes).unwrap();
        let binary_decode_time = start.elapsed();

        // JSON serialization
        let start = std::time::Instant::now();
        let json_bytes = serde_json::to_vec(&counter).unwrap();
        let json_encode_time = start.elapsed();
        let json_size = json_bytes.len();

        let start = std::time::Instant::now();
        let _: GCounter = serde_json::from_slice(&json_bytes).unwrap();
        let json_decode_time = start.elapsed();

        println!("\n=== G-Counter Serialization Benchmark (100 nodes) ===");
        println!("Binary:");
        println!("  Encode: {:?}", binary_encode_time);
        println!("  Decode: {:?}", binary_decode_time);
        println!("  Size: {} bytes", binary_size);
        println!("JSON:");
        println!("  Encode: {:?}", json_encode_time);
        println!("  Decode: {:?}", json_decode_time);
        println!("  Size: {} bytes", json_size);
        println!("Speedup:");
        println!("  Encode: {:.2}x faster", json_encode_time.as_nanos() as f64 / binary_encode_time.as_nanos() as f64);
        println!("  Decode: {:.2}x faster", json_decode_time.as_nanos() as f64 / binary_decode_time.as_nanos() as f64);
        if json_size > binary_size {
            println!("Size reduction: {:.1}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);
        } else {
            println!("Size increase: {:.1}% (binary is larger due to overhead)", ((binary_size - json_size) as f64 / json_size as f64) * 100.0);
        }
    }

    #[test]
    fn bench_serialization_orset() {
        let mut set = ORSet::new();
        for i in 0..100 {
            set.add(format!("item{}", i), "node1");
        }

        // Binary serialization
        let start = std::time::Instant::now();
        let binary_bytes = set.to_bytes().unwrap();
        let binary_encode_time = start.elapsed();
        let binary_size = binary_bytes.len();

        let start = std::time::Instant::now();
        let _decoded = ORSet::<String>::from_bytes(&binary_bytes).unwrap();
        let binary_decode_time = start.elapsed();

        // JSON serialization
        let start = std::time::Instant::now();
        let json_bytes = serde_json::to_vec(&set).unwrap();
        let json_encode_time = start.elapsed();
        let json_size = json_bytes.len();

        let start = std::time::Instant::now();
        let _: ORSet<String> = serde_json::from_slice(&json_bytes).unwrap();
        let json_decode_time = start.elapsed();

        println!("\n=== OR-Set Serialization Benchmark (100 elements) ===");
        println!("Binary:");
        println!("  Encode: {:?}", binary_encode_time);
        println!("  Decode: {:?}", binary_decode_time);
        println!("  Size: {} bytes", binary_size);
        println!("JSON:");
        println!("  Encode: {:?}", json_encode_time);
        println!("  Decode: {:?}", json_decode_time);
        println!("  Size: {} bytes", json_size);
        println!("Speedup:");
        println!("  Encode: {:.2}x faster", json_encode_time.as_nanos() as f64 / binary_encode_time.as_nanos() as f64);
        println!("  Decode: {:.2}x faster", json_decode_time.as_nanos() as f64 / binary_decode_time.as_nanos() as f64);
        if json_size > binary_size {
            println!("Size reduction: {:.1}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);
        } else {
            println!("Size increase: {:.1}% (binary is larger due to overhead)", ((binary_size - json_size) as f64 / json_size as f64) * 100.0);
        }
    }
}
