//! Simple CRDT benchmark test
use superinstance_native_crdt::{GCounter, ORSet};
use serde_json;

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
    println!("Size reduction: {:.1}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);
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
    println!("Size reduction: {:.1}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);
}
