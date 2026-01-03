//! # FFI Bindings for HNSW Distance Calculations
//!
//! TypeScript/Node.js bindings for SIMD-optimized distance metrics.
//!
//! ## Usage in TypeScript
//!
//! ```typescript
//! import * as native from 'superinstance-native-ffi';
//!
//! // Cosine similarity
//! const sim = native.cosineSimilaritySIMD(
//!   new Float32Array([1.0, 0.0]),
//!   new Float32Array([0.0, 1.0])
//! );
//!
//! // Euclidean distance
//! const dist = native.euclideanDistanceSIMD(
//!   new Float32Array([0.0, 0.0]),
//!   new Float32Array([3.0, 4.0])
//! );
//!
//! // Dot product
//! const dot = native.dotProductSIMD(
//!   new Float32Array([1.0, 2.0]),
//!   new Float32Array([3.0, 4.0])
//! );
//! ```

use napi_derive::napi;
use superinstance_native_embeddings::{
    cosine_similarity_simd,
    cosine_distance_simd,
    euclidean_distance_simd,
    dot_product_simd,
    batch_cosine_similarity,
    batch_euclidean_distance,
};

/// Calculate cosine similarity between two vectors using SIMD
///
/// Returns value in [-1, 1] where 1 means identical direction.
///
/// # Arguments
///
/// * `a` - First vector as Float32Array
/// * `b` - Second vector as Float32Array (must be same length as `a`)
///
/// # Performance
///
/// 3-5x faster than TypeScript implementation
#[napi]
pub fn cosine_similarity_simd(a: Vec<f32>, b: Vec<f32>) -> f32 {
    cosine_similarity_simd(&a, &b)
}

/// Calculate cosine distance (1 - similarity) using SIMD
///
/// Returns value in [0, 2] where 0 means identical.
///
/// # Arguments
///
/// * `a` - First vector as Float32Array
/// * `b` - Second vector as Float32Array
#[napi]
pub fn cosine_distance_simd_ffi(a: Vec<f32>, b: Vec<f32>) -> f32 {
    cosine_distance_simd(&a, &b)
}

/// Calculate Euclidean distance between two vectors using SIMD
///
/// Returns value in [0, inf) where 0 means identical.
///
/// # Arguments
///
/// * `a` - First vector as Float32Array
/// * `b` - Second vector as Float32Array
///
/// # Performance
///
/// 3-5x faster than TypeScript implementation
#[napi]
pub fn euclidean_distance_simd_ffi(a: Vec<f32>, b: Vec<f32>) -> f32 {
    euclidean_distance_simd(&a, &b)
}

/// Calculate dot product between two vectors using SIMD
///
/// Returns the dot product (scalar projection).
///
/// # Arguments
///
/// * `a` - First vector as Float32Array
/// * `b` - Second vector as Float32Array
///
/// # Performance
///
/// 3-5x faster than TypeScript implementation
#[napi]
pub fn dot_product_simd_ffi(a: Vec<f32>, b: Vec<f32>) -> f32 {
    dot_product_simd(&a, &b)
}

/// Batch calculate cosine similarities between query and candidates
///
/// # Arguments
///
/// * `query` - Query vector as Float32Array
/// * `candidates` - Array of candidate vectors as Float32Array
///
/// # Returns
///
/// Array of similarity scores (same length as candidates)
#[napi]
pub fn batch_cosine_similarity_ffi(
    query: Vec<f32>,
    candidates: Vec<Vec<f32>>,
) -> Vec<f32> {
    let candidate_refs: Vec<&[f32]> = candidates.iter().map(|v| v.as_slice()).collect();
    batch_cosine_similarity(&query, &candidate_refs)
}

/// Batch calculate Euclidean distances between query and candidates
///
/// # Arguments
///
/// * `query` - Query vector as Float32Array
/// * `candidates` - Array of candidate vectors as Float32Array
///
/// # Returns
///
/// Array of distances (same length as candidates)
#[napi]
pub fn batch_euclidean_distance_ffi(
    query: Vec<f32>,
    candidates: Vec<Vec<f32>>,
) -> Vec<f32> {
    let candidate_refs: Vec<&[f32]> = candidates.iter().map(|v| v.as_slice()).collect();
    batch_euclidean_distance(&query, &candidate_refs)
}

/// HNSW distance metrics
#[napi]
pub enum HNSWMetric {
    /// Cosine distance (1 - cosine similarity)
    Cosine,

    /// Euclidean distance (L2 norm)
    Euclidean,

    /// Dot product
    DotProduct,
}

/// Calculate distance between two vectors using specified metric
///
/// # Arguments
///
/// * `a` - First vector
/// * `b` - Second vector
/// * `metric` - Distance metric to use
///
/// # Returns
///
/// Distance value
#[napi]
pub fn calculate_distance(a: Vec<f32>, b: Vec<f32>, metric: HNSWMetric) -> f32 {
    match metric {
        HNSWMetric::Cosine => cosine_distance_simd(&a, &b),
        HNSWMetric::Euclidean => euclidean_distance_simd(&a, &b),
        HNSWMetric::DotProduct => dot_product_simd(&a, &b),
    }
}

/// Batch calculate distances between query and candidates
///
/// # Arguments
///
/// * `query` - Query vector
/// * `candidates` - Array of candidate vectors
/// * `metric` - Distance metric to use
///
/// # Returns
///
/// Array of distances
#[napi]
pub fn batch_calculate_distance(
    query: Vec<f32>,
    candidates: Vec<Vec<f32>>,
    metric: HNSWMetric,
) -> Vec<f32> {
    match metric {
        HNSWMetric::Cosine => {
            let candidate_refs: Vec<&[f32]> = candidates.iter().map(|v| v.as_slice()).collect();
            batch_cosine_similarity(&query, &candidate_refs)
                .into_iter()
                .map(|s| 1.0 - s)
                .collect()
        }
        HNSWMetric::Euclidean => {
            let candidate_refs: Vec<&[f32]> = candidates.iter().map(|v| v.as_slice()).collect();
            batch_euclidean_distance(&query, &candidate_refs)
        }
        HNSWMetric::DotProduct => {
            let candidate_refs: Vec<&[f32]> = candidates.iter().map(|v| v.as_slice()).collect();
            candidate_refs
                .iter()
                .map(|c| dot_product_simd(&query, c))
                .collect()
        }
    }
}

/// Benchmark results for distance calculations
#[napi(object)]
pub struct BenchmarkResult {
    /// Function name
    pub function: String,

    /// Number of iterations
    pub iterations: u64,

    /// Total time in milliseconds
    pub total_time_ms: f64,

    /// Average time per operation in microseconds
    pub avg_time_us: f64,

    /// Operations per second
    pub ops_per_second: f64,
}

/// Benchmark distance calculation performance
///
/// # Arguments
///
/// * `dimension` - Vector dimension (e.g., 768 for embeddings)
/// * `iterations` - Number of iterations
/// * `metric` - Distance metric to benchmark
///
/// # Returns
///
/// Benchmark results
#[napi]
pub fn benchmark_distance(
    dimension: usize,
    iterations: u64,
    metric: HNSWMetric,
) -> BenchmarkResult {
    use std::time::Instant;

    // Generate random vectors
    let a: Vec<f32> = (0..dimension).map(|i| i as f32).collect();
    let b: Vec<f32> = (0..dimension).map(|i| (i * 2) as f32).collect();

    // Warm-up
    match metric {
        HNSWMetric::Cosine => {
            let _ = cosine_distance_simd(&a, &b);
        }
        HNSWMetric::Euclidean => {
            let _ = euclidean_distance_simd(&a, &b);
        }
        HNSWMetric::DotProduct => {
            let _ = dot_product_simd(&a, &b);
        }
    }

    // Benchmark
    let start = Instant::now();
    for _ in 0..iterations {
        match metric {
            HNSWMetric::Cosine => {
                let _ = cosine_distance_simd(&a, &b);
            }
            HNSWMetric::Euclidean => {
                let _ = euclidean_distance_simd(&a, &b);
            }
            HNSWMetric::DotProduct => {
                let _ = dot_product_simd(&a, &b);
            }
        }
    }
    let duration = start.elapsed();

    let total_time_ms = duration.as_secs_f64() * 1000.0;
    let avg_time_us = (total_time_ms / iterations as f64) * 1000.0;
    let ops_per_second = iterations as f64 / duration.as_secs_f64();

    BenchmarkResult {
        function: format!("{:?}", metric),
        iterations,
        total_time_ms,
        avg_time_us,
        ops_per_second,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_simd() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let sim = cosine_similarity_simd(a, b);
        assert!((sim - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_distance_simd() {
        let a = vec![1.0, 0.0];
        let b = vec![1.0, 0.0];
        let dist = cosine_distance_simd_ffi(a, b);
        assert!(dist.abs() < 1e-6);
    }

    #[test]
    fn test_euclidean_distance_simd() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];
        let dist = euclidean_distance_simd_ffi(a, b);
        assert!((dist - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_dot_product_simd() {
        let a = vec![1.0, 2.0];
        let b = vec![3.0, 4.0];
        let dot = dot_product_simd_ffi(a, b);
        assert!((dot - 11.0).abs() < 1e-6);
    }

    #[test]
    fn test_batch_cosine_similarity() {
        let query = vec![1.0, 0.0];
        let candidates = vec![
            vec![1.0, 0.0],
            vec![0.0, 1.0],
        ];
        let results = batch_cosine_similarity_ffi(query, candidates);
        assert_eq!(results.len(), 2);
        assert!((results[0] - 1.0).abs() < 1e-6);
        assert!((results[1] - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_distance() {
        let a = vec![1.0, 0.0];
        let b = vec![1.0, 0.0];

        let cos_dist = calculate_distance(a.clone(), b.clone(), HNSWMetric::Cosine);
        assert!(cos_dist.abs() < 1e-6);

        let euc_dist = calculate_distance(a.clone(), b.clone(), HNSWMetric::Euclidean);
        assert!(euc_dist.abs() < 1e-6);
    }

    #[test]
    fn test_benchmark_distance() {
        let result = benchmark_distance(768, 1000, HNSWMetric::Cosine);
        assert_eq!(result.iterations, 1000);
        assert!(result.total_time_ms > 0.0);
        assert!(result.ops_per_second > 0.0);
    }
}
