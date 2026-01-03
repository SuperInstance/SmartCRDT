//! Simple CRDT benchmark runner
use std::time::Instant;
use superinstance_native_crdt::{GCounter, PNCounter, LWWRegister, ORSet};
use serde_json;

fn main() {
    println!("CRDT Performance Benchmarks");
    println!("===========================\n");

    bench_gcounter();
    bench_pncounter();
    bench_lww_register();
    bench_orset();
    bench_serialization_comparison();
}

fn bench_gcounter() {
    println!("G-Counter Operations:");
    println!("---------------------");

    let start = Instant::now();
    let mut counter = GCounter::new();
    for i in 0..1000 {
        counter.increment(&format!("node{}", i), i);
    }
    let elapsed = start.elapsed();
    println!("  Increment 1000 nodes: {:?}", elapsed);

    let mut counter2 = GCounter::new();
    for i in 0..500 {
        counter2.increment(&format!("node{}", i), i);
    }

    let start = Instant::now();
    counter.merge(&counter2);
    let elapsed = start.elapsed();
    println!("  Merge 500 nodes: {:?}", elapsed);

    let start = Instant::now();
    let value = counter.value();
    let elapsed = start.elapsed();
    println!("  Get value: {:?} (value: {})", elapsed, value);

    println!();
}

fn bench_pncounter() {
    println!("PN-Counter Operations:");
    println!("----------------------");

    let start = Instant::now();
    let mut counter = PNCounter::new();
    for i in 0..1000 {
        counter.increment(&format!("node{}", i), i);
        counter.decrement(&format!("node{}", i), i / 2);
    }
    let elapsed = start.elapsed();
    println!("  Inc/Dec 1000 nodes: {:?}", elapsed);

    println!();
}

fn bench_lww_register() {
    println!("LWW Register Operations:");
    println!("------------------------");

    let start = Instant::now();
    let mut reg = LWWRegister::new("initial".to_string());
    for i in 0..1000 {
        reg.set(format!("value{}", i));
    }
    let elapsed = start.elapsed();
    println!("  Set 1000 values: {:?}", elapsed);

    println!();
}

fn bench_orset() {
    println!("OR-Set Operations:");
    println!("------------------");

    let start = Instant::now();
    let mut set = ORSet::new();
    for i in 0..1000 {
        set.add(format!("item{}", i), "node1");
    }
    let elapsed = start.elapsed();
    println!("  Add 1000 elements: {:?}", elapsed);

    let start = Instant::now();
    for i in 0..500 {
        set.remove(&format!("item{}", i));
    }
    let elapsed = start.elapsed();
    println!("  Remove 500 elements: {:?}", elapsed);

    println!();
}

fn bench_serialization_comparison() {
    println!("Serialization Comparison (Binary vs JSON):");
    println!("===========================================\n");

    // G-Counter
    let mut counter = GCounter::new();
    for i in 0..100 {
        counter.increment(&format!("node{}", i), i);
    }

    let start = Instant::now();
    let binary_bytes = counter.to_bytes().unwrap();
    let binary_time = start.elapsed();
    let binary_size = binary_bytes.len();

    let start = Instant::now();
    counter.from_bytes(&binary_bytes).unwrap();
    let binary_decode_time = start.elapsed();

    let start = Instant::now();
    let json_bytes = serde_json::to_vec(&counter).unwrap();
    let json_time = start.elapsed();
    let json_size = json_bytes.len();

    let start = Instant::now();
    serde_json::from_slice::<GCounter>(&json_bytes).unwrap();
    let json_decode_time = start.elapsed();

    println!("G-Counter (100 nodes):");
    println!("  Binary:");
    println!("    Encode: {:?}", binary_time);
    println!("    Decode: {:?}", binary_decode_time);
    println!("    Size: {} bytes", binary_size);
    println!("  JSON:");
    println!("    Encode: {:?}", json_time);
    println!("    Decode: {:?}", json_decode_time);
    println!("    Size: {} bytes", json_size);
    println!("  Speedup:");
    println!("    Encode: {:.2}x faster", json_time.as_nanos() as f64 / binary_time.as_nanos() as f64);
    println!("    Decode: {:.2}x faster", json_decode_time.as_nanos() as f64 / binary_decode_time.as_nanos() as f64);
    println!("  Size reduction: {:.2}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);

    println!();

    // OR-Set
    let mut set = ORSet::new();
    for i in 0..100 {
        set.add(format!("item{}", i), "node1");
    }

    let start = Instant::now();
    let binary_bytes = set.to_bytes().unwrap();
    let binary_time = start.elapsed();
    let binary_size = binary_bytes.len();

    let start = Instant::now();
    ORSet::<String>::from_bytes(&binary_bytes).unwrap();
    let binary_decode_time = start.elapsed();

    let start = Instant::now();
    let json_bytes = serde_json::to_vec(&set).unwrap();
    let json_time = start.elapsed();
    let json_size = json_bytes.len();

    let start = Instant::now();
    serde_json::from_slice::<ORSet<String>>(&json_bytes).unwrap();
    let json_decode_time = start.elapsed();

    println!("OR-Set (100 elements):");
    println!("  Binary:");
    println!("    Encode: {:?}", binary_time);
    println!("    Decode: {:?}", binary_decode_time);
    println!("    Size: {} bytes", binary_size);
    println!("  JSON:");
    println!("    Encode: {:?}", json_time);
    println!("    Decode: {:?}", json_decode_time);
    println!("    Size: {} bytes", json_size);
    println!("  Speedup:");
    println!("    Encode: {:.2}x faster", json_time.as_nanos() as f64 / binary_time.as_nanos() as f64);
    println!("    Decode: {:.2}x faster", json_decode_time.as_nanos() as f64 / binary_decode_time.as_nanos() as f64);
    println!("  Size reduction: {:.2}%", ((json_size - binary_size) as f64 / json_size as f64) * 100.0);

    println!();
}
