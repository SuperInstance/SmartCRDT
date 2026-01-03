// Benchmark for Product Quantization
//
// Measures:
// - Memory usage (compression ratio)
// - Training time
// - Quantization speed
// - Asymmetric distance calculation speed
// - Accuracy (reconstruction error, distance error)

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use superinstance_native_embeddings::ProductQuantizer;
use std::time::Duration;

fn generate_training_vectors(n: usize, dim: usize) -> Vec<Vec<f32>> {
    (0..n)
        .map(|_| {
            (0..dim)
                .map(|i| {
                    let base = (i as f32 / dim as f32) * 2.0 - 1.0;
                    base + fastrand::f32() * 0.1
                })
                .collect()
        })
        .collect()
}

fn benchmark_pq_training(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_training");

    for n_vectors in [100, 500, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::new("train", n_vectors),
            n_vectors,
            |b, &n| {
                let vectors = generate_training_vectors(n, 1536);
                b.iter(|| {
                    let mut pq = ProductQuantizer::new(1536, 64, 256);
                    black_box(pq.train(&vectors, 15, 0.001).unwrap())
                })
            },
        );
    }

    group.finish();
}

fn benchmark_pq_quantization(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_quantization");

    let vectors = generate_training_vectors(500, 1536);
    let mut pq = ProductQuantizer::new(1536, 64, 256);
    pq.train(&vectors, 15, 0.001).unwrap();

    group.bench_function("quantize_single", |b| {
        let test_vector = &vectors[0];
        b.iter(|| black_box(pq.quantize(test_vector).unwrap()))
    });

    group.bench_function("quantize_batch_100", |b| {
        let test_vectors = &vectors[..100];
        b.iter(|| {
            test_vectors
                .iter()
                .map(|v| black_box(pq.quantize(v).unwrap()))
                .collect::<Vec<_>>()
        })
    });

    group.finish();
}

fn benchmark_pq_reconstruction(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_reconstruction");

    let vectors = generate_training_vectors(500, 1536);
    let mut pq = ProductQuantizer::new(1536, 64, 256);
    pq.train(&vectors, 15, 0.001).unwrap();
    let codes = pq.quantize(&vectors[0]).unwrap();

    group.bench_function("reconstruct", |b| {
        b.iter(|| black_box(pq.reconstruct(&codes).unwrap()))
    });

    group.finish();
}

fn benchmark_pq_asymmetric_distance(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_asymmetric_distance");

    let vectors = generate_training_vectors(500, 1536);
    let mut pq = ProductQuantizer::new(1536, 64, 256);
    pq.train(&vectors, 15, 0.001).unwrap();
    let query = &vectors[0];
    let codes_list: Vec<Vec<u8>> = vectors[1..101]
        .iter()
        .map(|v| pq.quantize(v).unwrap())
        .collect();

    group.bench_function("single_distance", |b| {
        let codes = &codes_list[0];
        b.iter(|| black_box(pq.asymmetric_distance(query, codes).unwrap()))
    });

    group.bench_function("batch_distances_100", |b| {
        b.iter(|| {
            codes_list
                .iter()
                .map(|codes| black_box(pq.asymmetric_distance(query, codes).unwrap()))
                .collect::<Vec<_>>()
        })
    });

    group.finish();
}

fn benchmark_pq_accuracy(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_accuracy");

    let vectors = generate_training_vectors(500, 1536);
    let mut pq = ProductQuantizer::new(1536, 64, 256);
    let error = pq.train(&vectors, 15, 0.001).unwrap();

    group.bench_function("reconstruction_error", |b| {
        b.iter(|| {
            let mut total_mse = 0.0;
            for vector in &vectors[..100] {
                let codes = pq.quantize(vector).unwrap();
                let reconstructed = pq.reconstruct(&codes).unwrap();

                let mse: f32 = vector
                    .iter()
                    .zip(reconstructed.iter())
                    .map(|(orig, rec)| {
                        let diff = orig - rec;
                        diff * diff
                    })
                    .sum::<f32>() / vector.len() as f32;

                total_mse += mse;
            }
            black_box(total_mse / 100.0)
        })
    });

    group.bench_function("distance_error", |b| {
        b.iter(|| {
            let mut total_error = 0.0;
            for i in 0..100 {
                let query = &vectors[i];
                let db_vector = &vectors[i + 1];

                // Exact distance
                let exact_dist: f32 = query
                    .iter()
                    .zip(db_vector.iter())
                    .map(|(q, d)| {
                        let diff = q - d;
                        diff * diff
                    })
                    .sum::<f32>()
                    .sqrt();

                // Quantized distance
                let codes = pq.quantize(db_vector).unwrap();
                let quantized_dist = pq.asymmetric_distance(query, &codes).unwrap();

                let relative_error = (exact_dist - quantized_dist).abs() / exact_dist;
                total_error += relative_error;
            }
            black_box(total_error / 100.0)
        })
    });

    group.finish();
}

fn benchmark_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_memory");

    // Original size
    let original_size = 1536 * 4; // f32 = 4 bytes

    // PQ size
    let pq = ProductQuantizer::new(1536, 64, 256);
    let compressed_size = pq.compression_ratio() * original_size as f32;

    group.bench_function("memory_comparison", |b| {
        b.iter(|| {
            black_box(original_size);
            black_box(compressed_size);
        })
    });

    group.finish();
}

fn benchmark_comparison_with_baseline(c: &mut Criterion) {
    let mut group = c.benchmark_group("pq_vs_baseline");

    let vectors = generate_training_vectors(500, 1536);
    let mut pq = ProductQuantizer::new(1536, 64, 256);
    pq.train(&vectors, 15, 0.001).unwrap();

    // Baseline: f32 distance calculation
    group.bench_function("baseline_distance_f32", |b| {
        let query = &vectors[0];
        let db_vectors = &vectors[1..101];
        b.iter(|| {
            db_vectors
                .iter()
                .map(|db| {
                    let dist: f32 = query
                        .iter()
                        .zip(db.iter())
                        .map(|(q, d)| {
                            let diff = q - d;
                            diff * diff
                        })
                        .sum();
                    black_box(dist.sqrt())
                })
                .collect::<Vec<_>>()
        })
    });

    // PQ: asymmetric distance
    group.bench_function("pq_asymmetric_distance", |b| {
        let query = &vectors[0];
        let db_vectors = &vectors[1..101];
        let codes_list: Vec<Vec<u8>> = db_vectors
            .iter()
            .map(|v| pq.quantize(v).unwrap())
            .collect();

        b.iter(|| {
            codes_list
                .iter()
                .map(|codes| black_box(pq.asymmetric_distance(query, codes).unwrap()))
                .collect::<Vec<_>>()
        })
    });

    group.finish();
}

criterion_group!(
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .sample_size(100);
    targets =
        benchmark_pq_training,
        benchmark_pq_quantization,
        benchmark_pq_reconstruction,
        benchmark_pq_asymmetric_distance,
        benchmark_pq_accuracy,
        benchmark_memory_usage,
        benchmark_comparison_with_baseline
);

criterion_main!(benches);
