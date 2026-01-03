//! # FFI Bindings for Embeddings

use napi_derive::napi;
use superinstance_native_core::{Vector, SimilarityMetric};
use superinstance_native_embeddings::{
    cosine, euclidean, dot_product, VectorSearch, SearchResult as CoreSearchResult,
    ProductQuantizer, QuantizationConfig,
};

/// A vector for embeddings
#[napi(object)]
pub struct Float32Array {
    pub data: Vec<f32>,
    pub dimension: usize,
}

impl From<Vector> for Float32Array {
    fn from(vec: Vector) -> Self {
        Self {
            data: vec.data.clone(),
            dimension: vec.dim(),
        }
    }
}

impl From<Float32Array> for Vector {
    fn from(arr: Float32Array) -> Self {
        Vector::new(arr.data)
    }
}

/// Calculate cosine similarity between two vectors
#[napi]
pub fn cosine_similarity(a: Float32Array, b: Float32Array) -> f32 {
    let vec_a: Vector = a.into();
    let vec_b: Vector = b.into();
    cosine(&vec_a, &vec_b)
}

/// Calculate Euclidean distance between two vectors
#[napi]
pub fn euclidean_distance(a: Float32Array, b: Float32Array) -> f32 {
    let vec_a: Vector = a.into();
    let vec_b: Vector = b.into();
    euclidean(&vec_a, &vec_b)
}

/// Calculate dot product between two vectors
#[napi]
pub fn dot(a: Float32Array, b: Float32Array) -> f32 {
    let vec_a: Vector = a.into();
    let vec_b: Vector = b.into();
    dot_product(&vec_a, &vec_b)
}

/// Similarity metric type
#[napi]
pub enum Metric {
    Cosine,
    Euclidean,
    DotProduct,
}

impl From<Metric> for SimilarityMetric {
    fn from(metric: Metric) -> Self {
        match metric {
            Metric::Cosine => SimilarityMetric::Cosine,
            Metric::Euclidean => SimilarityMetric::Euclidean,
            Metric::DotProduct => SimilarityMetric::DotProduct,
        }
    }
}

/// A search result
#[napi(object)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub index: usize,
}

impl From<CoreSearchResult> for SearchResult {
    fn from(result: CoreSearchResult) -> Self {
        Self {
            id: result.id,
            score: result.score,
            index: result.index,
        }
    }
}

/// Vector search engine
#[napi]
pub struct VectorSearchEngine {
    inner: VectorSearch,
}

#[napi]
impl VectorSearchEngine {
    /// Create a new search engine
    #[napi(constructor)]
    pub fn new(metric: Metric) -> Self {
        Self {
            inner: VectorSearch::new(metric.into()),
        }
    }

    /// Find top-k similar vectors
    #[napi]
    pub fn find_top_k(
        &self,
        query: Float32Array,
        vectors: Vec<Float32Array>,
        ids: Vec<String>,
        top_k: usize,
    ) -> napi::Result<Vec<SearchResult>> {
        let query_vec: Vector = query.into();
        let vecs: Vec<Vector> = vectors.into_iter().map(|v| v.into()).collect();

        let results = self
            .inner
            .find_top_k(&query_vec, &vecs, &ids, top_k)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        Ok(results.into_iter().map(|r| r.into()).collect())
    }

    /// Find vectors within threshold
    #[napi]
    pub fn find_within_threshold(
        &self,
        query: Float32Array,
        vectors: Vec<Float32Array>,
        ids: Vec<String>,
        threshold: f32,
    ) -> napi::Result<Vec<SearchResult>> {
        let query_vec: Vector = query.into();
        let vecs: Vec<Vector> = vectors.into_iter().map(|v| v.into()).collect();

        let results = self
            .inner
            .find_within_threshold(&query_vec, &vecs, &ids, threshold)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        Ok(results.into_iter().map(|r| r.into()).collect())
    }
}

/// Normalize a vector to unit length
#[napi]
pub fn normalize(mut vec: Float32Array) -> Float32Array {
    let mut v: Vector = vec.into();
    v.normalize();
    v.into()
}

/// Batch normalize vectors
#[napi]
pub fn batch_normalize(vectors: Vec<Float32Array>) -> Vec<Float32Array> {
    let mut vecs: Vec<Vector> = vectors.into_iter().map(|v| v.into()).collect();
    superinstance_native_embeddings::batch_normalize(&mut vecs);
    vecs.into_iter().map(|v| v.into()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = Float32Array {
            data: vec![1.0, 0.0],
            dimension: 2,
        };
        let b = Float32Array {
            data: vec![0.0, 1.0],
            dimension: 2,
        };

        let sim = cosine_similarity(a, b);
        assert!((sim - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = Float32Array {
            data: vec![0.0, 0.0],
            dimension: 2,
        };
        let b = Float32Array {
            data: vec![3.0, 4.0],
            dimension: 2,
        };

        let dist = euclidean_distance(a, b);
        assert!((dist - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_dot() {
        let a = Float32Array {
            data: vec![1.0, 2.0],
            dimension: 2,
        };
        let b = Float32Array {
            data: vec![3.0, 4.0],
            dimension: 2,
        };

        let d = dot(a, b);
        assert!((d - 11.0).abs() < 1e-6);
    }
}

// ============================================================================
// Product Quantization FFI Bindings
// ============================================================================

/// Product Quantizer for efficient vector compression
///
/// Provides 50-75% memory reduction with minimal accuracy loss.
/// Uses K-means++ clustering to learn optimal centroids.
#[napi]
pub struct PQProductQuantizer {
    inner: ProductQuantizer,
}

impl From<ProductQuantizer> for PQProductQuantizer {
    fn from(inner: ProductQuantizer) -> Self {
        Self { inner }
    }
}

#[napi]
impl PQProductQuantizer {
    /// Create a new untrained Product Quantizer
    ///
    /// # Arguments
    /// * `dimension` - Vector dimension (must be divisible by n_subvectors)
    /// * `n_subvectors` - Number of subvectors (typically 8-64)
    /// * `n_centroids` - Number of centroids per subvector (max 256 for uint8)
    #[napi(constructor)]
    pub fn new(dimension: usize, n_subvectors: usize, n_centroids: usize) -> napi::Result<Self> {
        if dimension % n_subvectors != 0 {
            return Err(napi::Error::from_reason(format!(
                "Dimension {} must be divisible by n_subvectors {}",
                dimension, n_subvectors
            )));
        }

        if n_centroids > 256 {
            return Err(napi::Error::from_reason(
                "n_centroids cannot exceed 256 for uint8 codes",
            ));
        }

        Ok(Self {
            inner: ProductQuantizer::new(dimension, n_subvectors, n_centroids),
        })
    }

    /// Train the quantizer on a set of vectors
    ///
    /// # Arguments
    /// * `training_vectors` - Training vectors (should be representative of data)
    /// * `max_iterations` - Maximum K-means iterations (default: 20)
    /// * `convergence_threshold` - Stop if centroids move less than this (default: 0.001)
    ///
    /// # Returns
    /// Training error (average reconstruction error)
    #[napi]
    pub fn train(
        &mut self,
        training_vectors: Vec<Float32Array>,
        max_iterations: usize,
        convergence_threshold: f32,
    ) -> napi::Result<f32> {
        let vectors: Vec<Vec<f32>> = training_vectors
            .into_iter()
            .map(|arr| arr.data)
            .collect();

        self.inner
            .train(&vectors, max_iterations, convergence_threshold)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Quantize a vector to uint8 codes
    ///
    /// # Arguments
    /// * `vector` - Vector to quantize
    ///
    /// # Returns
    /// Quantized codes (one byte per subvector)
    #[napi]
    pub fn quantize(&self, vector: Float32Array) -> napi::Result<Vec<u8>> {
        self.inner
            .quantize(&vector.data)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Reconstruct a vector from quantized codes
    ///
    /// # Arguments
    /// * `codes` - Quantized codes
    ///
    /// # Returns
    /// Reconstructed vector
    #[napi]
    pub fn reconstruct(&self, codes: Vec<u8>) -> napi::Result<Float32Array> {
        let reconstructed = self
            .inner
            .reconstruct(&codes)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        Ok(Float32Array {
            data: reconstructed,
            dimension: self.inner.dimension,
        })
    }

    /// Compute asymmetric distance between query and quantized database vector
    ///
    /// This is the key operation for fast nearest neighbor search.
    ///
    /// # Arguments
    /// * `query` - Query vector (full precision)
    /// * `codes` - Quantized database vector
    ///
    /// # Returns
    /// Euclidean distance
    #[napi]
    pub fn asymmetric_distance(&self, query: Float32Array, codes: Vec<u8>) -> napi::Result<f32> {
        self.inner
            .asymmetric_distance(&query.data, &codes)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Get compression ratio
    ///
    /// Returns ratio of compressed size to original size
    #[napi]
    pub fn compression_ratio(&self) -> f32 {
        self.inner.compression_ratio()
    }

    /// Get memory usage in bytes (for centroids)
    #[napi]
    pub fn memory_usage(&self) -> usize {
        self.inner.memory_usage()
    }

    /// Get dimension
    #[napi]
    pub fn get_dimension(&self) -> usize {
        self.inner.dimension
    }

    /// Get number of subvectors
    #[napi]
    pub fn get_n_subvectors(&self) -> usize {
        self.inner.n_subvectors
    }

    /// Get number of centroids
    #[napi]
    pub fn get_n_centroids(&self) -> usize {
        self.inner.n_centroids
    }
}

/// Quantization configuration
#[napi(object)]
pub struct PQQuantizationConfig {
    /// Number of bits per dimension (8 or 16)
    pub bits: u8,

    /// Whether to use product quantization
    pub use_pq: bool,

    /// Number of subvectors for product quantization
    pub pq_subvectors: usize,
}

impl From<QuantizationConfig> for PQQuantizationConfig {
    fn from(config: QuantizationConfig) -> Self {
        Self {
            bits: config.bits,
            use_pq: config.use_pq,
            pq_subvectors: config.pq_subvectors,
        }
    }
}

impl From<PQQuantizationConfig> for QuantizationConfig {
    fn from(config: PQQuantizationConfig) -> Self {
        Self {
            bits: config.bits,
            use_pq: config.use_pq,
            pq_subvectors: config.pq_subvectors,
        }
    }
}

/// Create scalar 8-bit quantization config
#[napi]
pub fn pq_scalar_8bit() -> PQQuantizationConfig {
    QuantizationConfig::scalar_8bit().into()
}

/// Create product quantization config
#[napi]
pub fn pq_product_quantization(subvectors: usize) -> PQQuantizationConfig {
    QuantizationConfig::product_quantization(subvectors).into()
}

/// Batch quantize vectors
#[napi]
pub fn pq_batch_quantize(
    quantizer: &PQProductQuantizer,
    vectors: Vec<Float32Array>,
) -> napi::Result<Vec<Vec<u8>>> {
    let mut results = Vec::with_capacity(vectors.len());

    for vector in vectors {
        let codes = quantizer
            .inner
            .quantize(&vector.data)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        results.push(codes);
    }

    Ok(results)
}

/// Batch compute asymmetric distances
///
/// Compute distances between one query and multiple quantized vectors
#[napi]
pub fn pq_batch_asymmetric_distance(
    quantizer: &PQProductQuantizer,
    query: Float32Array,
    codes_list: Vec<Vec<u8>>,
) -> napi::Result<Vec<f32>> {
    let mut results = Vec::with_capacity(codes_list.len());

    for codes in codes_list {
        let dist = quantizer
            .inner
            .asymmetric_distance(&query.data, &codes)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        results.push(dist);
    }

    Ok(results)
}
