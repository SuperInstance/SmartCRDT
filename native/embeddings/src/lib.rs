//! # SuperInstance Native Embeddings
//!
//! High-performance vector operations and similarity search for embeddings.
//!
//! ## Features
//!
//! - **Zero-copy operations**: Work directly on slices when possible
//! - **SIMD-optimized**: Leverage CPU vector instructions
//! - **Multiple metrics**: Cosine similarity, Euclidean distance, dot product
//! - **Batch operations**: Process multiple vectors efficiently
//! - **Optional FAISS**: Approximate nearest neighbor for large datasets

pub mod similarity;
// pub mod search;  // Temporarily disabled due to compilation errors
// pub mod ops;  // Temporarily disabled
// pub mod quantization;  // Temporarily disabled
// pub mod hnsw;  // Temporarily disabled due to SIMD compilation issues
pub mod cache;

pub use similarity::{SimilarityMetric, cosine, euclidean, dot_product};
// pub use search::{VectorSearch, SearchResult};
// pub use ops::{batch_normalize, batch_distance, matmul};
// pub use quantization::{QuantizedVector, QuantizationConfig, ProductQuantizer, PQVector};
// pub use hnsw::{
//     cosine_similarity_simd,
//     cosine_distance_simd,
//     euclidean_distance_simd,
//     dot_product_simd,
//     batch_cosine_similarity,
//     batch_euclidean_distance,
// };
pub use cache::{SemanticCache, CacheEntry, CacheHit, CacheConfig, SimilarityResult};

use superinstance_native_core::{CoreError, CoreResult, Vector, Embedding, Similarity};

/// Calculate similarity between two vectors using the specified metric
pub fn vector_similarity(a: &Vector, b: &Vector, metric: SimilarityMetric) -> CoreResult<f32> {
    if a.dim() != b.dim() {
        return Err(CoreError::vector(format!(
            "Dimension mismatch: {} vs {}",
            a.dim(),
            b.dim()
        )));
    }

    match metric {
        SimilarityMetric::Cosine => a
            .cosine_similarity(b)
            .ok_or_else(|| CoreError::vector("Cosine similarity calculation failed")),
        SimilarityMetric::Euclidean => Ok(euclidean(a, b)),
        SimilarityMetric::DotProduct => a.dot(b).ok_or_else(|| CoreError::vector("Dot product failed")),
    }
}

/// Find the most similar vectors to a query
pub fn find_similar(
    query: &Vector,
    candidates: &[Vector],
    metric: SimilarityMetric,
    top_k: usize,
) -> CoreResult<Vec<Similarity>> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let k = top_k.min(candidates.len());
    let mut results: Vec<Similarity> = candidates
        .iter()
        .enumerate()
        .filter_map(|(idx, candidate)| {
            vector_similarity(query, candidate, metric)
                .ok()
                .map(|score| Similarity::new(score, Some(idx.to_string())))
        })
        .collect();

    // Sort by score (descending)
    results.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

    // Keep top-k
    results.truncate(k);
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_similarity() {
        let a = Vector::new(vec![1.0, 0.0]);
        let b = Vector::new(vec![0.0, 1.0]);

        let cos = vector_similarity(&a, &b, SimilarityMetric::Cosine).unwrap();
        assert!((cos - 0.0).abs() < 1e-6);

        let eucl = vector_similarity(&a, &b, SimilarityMetric::Euclidean).unwrap();
        assert!((eucl - 1.414).abs() < 0.01);
    }

    #[test]
    fn test_dimension_mismatch() {
        let a = Vector::new(vec![1.0, 2.0]);
        let b = Vector::new(vec![1.0, 2.0, 3.0]);

        let result = vector_similarity(&a, &b, SimilarityMetric::Cosine);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_similar() {
        let query = Vector::new(vec![1.0, 0.0]);
        let candidates = vec![
            Vector::new(vec![1.0, 0.0]),
            Vector::new(vec![0.0, 1.0]),
            Vector::new(vec![0.707, 0.707]),
        ];

        let results = find_similar(&query, &candidates, SimilarityMetric::Cosine, 2).unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].score, 1.0); // Exact match
    }
}
