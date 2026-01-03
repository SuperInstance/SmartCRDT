//! # CRDT Performance Benchmarks
//!
//! Compares binary serialization (bincode) vs JSON serialization.
//! Expected speedup: 5-10x for serialization/deserialization.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use superinstance_native_crdt::{GCounter, PNCounter, LWWRegister, ORSet};
use serde_json;

fn bench_gcounter_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("gcounter");

    // Benchmark increment operations
    group.bench_function("increment_100_nodes", |b| {
        b.iter(|| {
            let mut counter = GCounter::new();
            for i in 0..100 {
                counter.increment(&format!("node{}", i), 1);
            }
            black_box(counter)
        })
    });

    // Benchmark merge operations
    group.bench_function("merge_100_nodes", |b| {
        b.iter(|| {
            let mut counter1 = GCounter::new();
            let mut counter2 = GCounter::new();

            for i in 0..50 {
                counter1.increment(&format!("node{}", i), i);
                counter2.increment(&format!("node{}", i + 50), i + 50);
            }

            counter1.merge(&counter2);
            black_box(counter1)
        })
    });

    // Benchmark binary serialization
    let mut counter = GCounter::new();
    for i in 0..100 {
        counter.increment(&format!("node{}", i), i);
    }

    group.bench_function("serialize_binary_100_nodes", |b| {
        b.iter(|| {
            black_box(counter.to_bytes().unwrap())
        })
    });

    group.bench_function("deserialize_binary_100_nodes", |b| {
        let bytes = counter.to_bytes().unwrap();
        b.iter(|| {
            black_box(GCounter::from_bytes(&bytes).unwrap())
        })
    });

    // Benchmark JSON serialization for comparison
    group.bench_function("serialize_json_100_nodes", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&counter).unwrap())
        })
    });

    group.bench_function("deserialize_json_100_nodes", |b| {
        let json = serde_json::to_string(&counter).unwrap();
        b.iter(|| {
            black_box(serde_json::from_str::<GCounter>(&json).unwrap())
        })
    });

    // Compare serialization sizes
    let binary_size = counter.to_bytes().unwrap().len();
    let json_size = serde_json::to_string(&counter).unwrap().len();
    println!("\nG-Counter Serialization Size (100 nodes):");
    println!("  Binary: {} bytes", binary_size);
    println!("  JSON:   {} bytes", json_size);
    println!("  Ratio: {:.2}x smaller", json_size as f64 / binary_size as f64);

    group.finish();
}

fn bench_pncounter_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("pncounter");

    // Benchmark increment/decrement operations
    group.bench_function("increment_decrement_100_nodes", |b| {
        b.iter(|| {
            let mut counter = PNCounter::new();
            for i in 0..100 {
                counter.increment(&format!("node{}", i), i);
                counter.decrement(&format!("node{}", i), i / 2);
            }
            black_box(counter)
        })
    });

    // Benchmark merge operations
    group.bench_function("merge_100_nodes", |b| {
        b.iter(|| {
            let mut counter1 = PNCounter::new();
            let mut counter2 = PNCounter::new();

            for i in 0..50 {
                counter1.increment(&format!("node{}", i), i);
                counter2.increment(&format!("node{}", i + 50), i + 50);
            }

            counter1.merge(&counter2);
            black_box(counter1)
        })
    });

    // Benchmark binary vs JSON serialization
    let mut counter = PNCounter::new();
    for i in 0..100 {
        counter.increment(&format!("node{}", i), i);
        counter.decrement(&format!("node{}", i), i / 2);
    }

    group.bench_function("serialize_binary_100_nodes", |b| {
        b.iter(|| {
            black_box(counter.to_bytes().unwrap())
        })
    });

    group.bench_function("serialize_json_100_nodes", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&counter).unwrap())
        })
    });

    let binary_size = counter.to_bytes().unwrap().len();
    let json_size = serde_json::to_string(&counter).unwrap().len();
    println!("\nPN-Counter Serialization Size (100 nodes):");
    println!("  Binary: {} bytes", binary_size);
    println!("  JSON:   {} bytes", json_size);
    println!("  Ratio: {:.2}x smaller", json_size as f64 / binary_size as f64);

    group.finish();
}

fn bench_lww_register_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("lww_register");

    // Benchmark set operations
    group.bench_function("set_100_values", |b| {
        b.iter(|| {
            let mut reg = LWWRegister::new("initial".to_string());
            for i in 0..100 {
                reg.set(format!("value{}", i));
            }
            black_box(reg)
        })
    });

    // Benchmark merge operations
    group.bench_function("merge_100_updates", |b| {
        b.iter(|| {
            let mut reg1 = LWWRegister::new("value1".to_string());
            let reg2 = LWWRegister::new("value2".to_string());

            for i in 0..100 {
                reg1.set(format!("value{}", i));
            }

            reg1.merge(&reg2);
            black_box(reg1)
        })
    });

    // Benchmark binary vs JSON serialization
    let mut reg = LWWRegister::new("test".to_string());
    for i in 0..100 {
        reg.set(format!("value_with_some_longer_content_{}", i));
    }

    group.bench_function("serialize_binary", |b| {
        b.iter(|| {
            black_box(reg.to_bytes().unwrap())
        })
    });

    group.bench_function("serialize_json", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&reg).unwrap())
        })
    });

    let binary_size = reg.to_bytes().unwrap().len();
    let json_size = serde_json::to_string(&reg).unwrap().len();
    println!("\nLWW Register Serialization Size:");
    println!("  Binary: {} bytes", binary_size);
    println!("  JSON:   {} bytes", json_size);
    println!("  Ratio: {:.2}x smaller", json_size as f64 / binary_size as f64);

    group.finish();
}

fn bench_orset_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("orset");

    // Benchmark add operations
    group.bench_function("add_100_elements", |b| {
        b.iter(|| {
            let mut set = ORSet::new();
            for i in 0..100 {
                set.add(format!("item{}", i), "node1");
            }
            black_box(set)
        })
    });

    // Benchmark remove operations
    group.bench_function("add_remove_100_elements", |b| {
        b.iter(|| {
            let mut set = ORSet::new();
            for i in 0..100 {
                set.add(format!("item{}", i), "node1");
            }
            for i in 0..50 {
                set.remove(&format!("item{}", i));
            }
            black_box(set)
        })
    });

    // Benchmark merge operations
    group.bench_function("merge_100_elements", |b| {
        b.iter(|| {
            let mut set1 = ORSet::new();
            let mut set2 = ORSet::new();

            for i in 0..50 {
                set1.add(format!("item{}", i), "node1");
                set2.add(format!("item{}", i + 50), "node2");
            }

            set1.merge(&set2);
            black_box(set1)
        })
    });

    // Benchmark binary vs JSON serialization
    let mut set = ORSet::new();
    for i in 0..100 {
        set.add(format!("item_with_longer_name_{}", i), "node1");
    }

    group.bench_function("serialize_binary_100_elements", |b| {
        b.iter(|| {
            black_box(set.to_bytes().unwrap())
        })
    });

    group.bench_function("serialize_json_100_elements", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&set).unwrap())
        })
    });

    let binary_size = set.to_bytes().unwrap().len();
    let json_size = serde_json::to_string(&set).unwrap().len();
    println!("\nOR-Set Serialization Size (100 elements):");
    println!("  Binary: {} bytes", binary_size);
    println!("  JSON:   {} bytes", json_size);
    println!("  Ratio: {:.2}x smaller", json_size as f64 / binary_size as f64);

    group.finish();
}

fn bench_serialization_scalability(c: &mut Criterion) {
    let mut group = c.benchmark_group("scalability");

    for size in [10, 50, 100, 500, 1000].iter() {
        let mut counter = GCounter::new();
        for i in 0..*size {
            counter.increment(&format!("node{}", i), i);
        }

        group.bench_with_input(BenchmarkId::new("binary", size), size, |b, _| {
            b.iter(|| {
                black_box(counter.to_bytes().unwrap())
            })
        });

        group.bench_with_input(BenchmarkId::new("json", size), size, |b, _| {
            b.iter(|| {
                black_box(serde_json::to_string(&counter).unwrap())
            })
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_gcounter_operations,
    bench_pncounter_operations,
    bench_lww_register_operations,
    bench_orset_operations,
    bench_serialization_scalability
);
criterion_main!(benches);
