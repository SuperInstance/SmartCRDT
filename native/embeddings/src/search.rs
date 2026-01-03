//! # Vector Search
//!
//! Efficient similarity search for finding nearest neighbors.

use superinstance_native_core::{CoreError, CoreResult, Vector};
use super::similarity::SimilarityMetric;

/// A search result with ID and score
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// ID of the matching item
    pub id: String,

    /// Similarity/distance score
    pub score: f32,

    /// Index in the original collection
    pub index: usize,
}

impl PartialOrd for SearchResult {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        // Higher scores are better
        other.score.partial_cmp(&self.score)
    }
}

/// Vector search engine with configurable metric
#[derive(Debug, Clone)]
pub struct VectorSearch {
    metric: SimilarityMetric,
}

impl VectorSearch {
    /// Create a new vector search
    pub fn new(metric: SimilarityMetric) -> Self {
        Self { metric }
    }

    /// Find top-k most similar vectors
    ///
    /// # Arguments
    ///
    /// * `query` - Query vector
    /// * `vectors` - Collection of vectors to search
    /// * `ids` - IDs for each vector (must match vectors length)
    /// * `top_k` - Number of results to return
    pub fn find_top_k(
        &self,
        query: &Vector,
        vectors: &[Vector],
        ids: &[String],
        top_k: usize,
    ) -> CoreResult<Vec<SearchResult>> {
        if vectors.len() != ids.len() {
            return Err(CoreError::invalid_input(format!(
                "Vectors and IDs length mismatch: {} vs {}",
                vectors.len(),
                ids.len()
            )));
        }

        if vectors.is_empty() {
            return Ok(Vec::new());
        }

        let k = top_k.min(vectors.len());

        // Calculate scores for all vectors
        let mut results: Vec<SearchResult> = vectors
            .iter()
            .enumerate()
            .map(|(idx, vec)| {
                let score = match self.metric {
                    SimilarityMetric::Cosine => super::super::cosine(query, vec),
                    SimilarityMetric::Euclidean => super::super::euclidean(query, vec),
                    SimilarityMetric::DotProduct => super::super::dot_product(query, vec),
                };

                SearchResult {
                    id: ids[idx].clone(),
                    score,
                    index: idx,
                }
            })
            .collect();

        // Sort by score (descending for similarity, ascending for distance)
        if matches!(self.metric, SimilarityMetric::Euclidean) {
            results.sort_by(|a, b| a.score.partial_cmp(&b.score).unwrap());
        } else {
            results.sort_by(|a, b| b.partial_cmp(a).unwrap());
        }

        // Keep top-k
        results.truncate(k);
        Ok(results)
    }

    /// Find all vectors within a threshold
    ///
    /// # Arguments
    ///
    /// * `query` - Query vector
    /// * `vectors` - Collection of vectors to search
    /// * `ids` - IDs for each vector
    /// * `threshold` - Maximum distance (for Euclidean) or minimum similarity
    pub fn find_within_threshold(
        &self,
        query: &Vector,
        vectors: &[Vector],
        ids: &[String],
        threshold: f32,
    ) -> CoreResult<Vec<SearchResult>> {
        if vectors.len() != ids.len() {
            return Err(CoreError::invalid_input(format!(
                "Vectors and IDs length mismatch: {} vs {}",
                vectors.len(),
                ids.len()
            )));
        }

        let results: Vec<SearchResult> = vectors
            .iter()
            .enumerate()
            .filter_map(|(idx, vec)| {
                let score = match self.metric {
                    SimilarityMetric::Cosine => super::super::cosine(query, vec),
                    SimilarityMetric::Euclidean => super::super::euclidean(query, vec),
                    SimilarityMetric::DotProduct => super::super::dot_product(query, vec),
                };

                let passes_threshold = match self.metric {
                    SimilarityMetric::Cosine => score >= threshold,
                    SimilarityMetric::Euclidean => score <= threshold,
                    SimilarityMetric::DotProduct => score >= threshold,
                };

                if passes_threshold {
                    Some(SearchResult {
                        id: ids[idx].clone(),
                        score,
                        index: idx,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(results)
    }

    /// Batch search for multiple queries
    pub fn batch_find_top_k(
        &self,
        queries: &[Vector],
        vectors: &[Vector],
        ids: &[String],
        top_k: usize,
    ) -> CoreResult<Vec<Vec<SearchResult>>> {
        queries
            .iter()
            .map(|query| self.find_top_k(query, vectors, ids, top_k))
            .collect()
    }
}

impl Default for VectorSearch {
    fn default() -> Self {
        Self::new(SimilarityMetric::Cosine)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use superinstance_native_core::Vector;

    #[test]
    fn test_find_top_k() {
        let search = VectorSearch::new(SimilarityMetric::Cosine);
        let query = Vector::new(vec![1.0, 0.0]);

        let vectors = vec![
            Vector::new(vec![1.0, 0.0]),
            Vector::new(vec![0.0, 1.0]),
            Vector::new(vec![0.707, 0.707]),
        ];

        let ids = vec!["a".to_string(), "b".to_string(), "c".to_string()];

        let results = search.find_top_k(&query, &vectors, &ids, 2).unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, "a");
        assert!((results[0].score - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_find_within_threshold() {
        let search = VectorSearch::new(SimilarityMetric::Cosine);
        let query = Vector::new(vec![1.0, 0.0]);

        let vectors = vec![
            Vector::new(vec![1.0, 0.0]),
            Vector::new(vec![0.0, 1.0]),
            Vector::new(vec![0.707, 0.707]),
        ];

        let ids = vec!["a".to_string(), "b".to_string(), "c".to_string()];

        let results = search
            .find_within_threshold(&query, &vectors, &ids, 0.5)
            .unwrap();

        // Should include 'a' (1.0) and 'c' (~0.707), but not 'b' (0.0)
        assert!(results.len() >= 1);
        assert!(results.iter().any(|r| r.id == "a"));
    }

    #[test]
    fn test_euclidean_search() {
        let search = VectorSearch::new(SimilarityMetric::Euclidean);
        let query = Vector::new(vec![0.0, 0.0]);

        let vectors = vec![
            Vector::new(vec![0.0, 0.0]),
            Vector::new(vec![3.0, 4.0]),
            Vector::new(vec![1.0, 1.0]),
        ];

        let ids = vec!["a".to_string(), "b".to_string(), "c".to_string()];

        let results = search.find_top_k(&query, &vectors, &ids, 2).unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, "a");
        assert!((results[0].score - 0.0).abs() < 1e-6);
    }
}
