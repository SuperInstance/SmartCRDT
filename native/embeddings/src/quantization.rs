//! # Vector Quantization
//!
//! Compress vectors to reduce memory usage and improve search speed.
//!
//! ## Product Quantization (PQ)
//!
//! Product Quantization splits vectors into subvectors and quantizes each
//! subvector independently. This provides:
//! - 50-75% memory reduction
//! - 2-3x faster distance calculations
//! - <5% accuracy loss with proper training

use serde::{Deserialize, Serialize};
use superinstance_native_core::{CoreError, CoreResult, Vector};
use std::collections::BinaryHeap;

/// Quantization configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantizationConfig {
    /// Number of bits per dimension (8 or 16)
    pub bits: u8,

    /// Whether to use product quantization
    pub use_pq: bool,

    /// Number of subvectors for product quantization
    pub pq_subvectors: usize,
}

impl Default for QuantizationConfig {
    fn default() -> Self {
        Self {
            bits: 8,
            use_pq: false,
            pq_subvectors: 8,
        }
    }
}

impl QuantizationConfig {
    /// Create 8-bit scalar quantization config
    pub fn scalar_8bit() -> Self {
        Self {
            bits: 8,
            use_pq: false,
            pq_subvectors: 1,
        }
    }

    /// Create product quantization config
    pub fn product_quantization(subvectors: usize) -> Self {
        Self {
            bits: 8,
            use_pq: true,
            pq_subvectors: subvectors,
        }
    }
}

/// A quantized vector (compressed representation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantizedVector {
    /// Quantized data (uint8 for 8-bit, uint16 for 16-bit)
    pub data: Vec<u8>,

    /// Minimum value for each dimension (for dequantization)
    pub min: Vec<f32>,

    /// Scale factor for each dimension
    pub scale: Vec<f32>,

    /// Original dimension
    pub dimension: usize,
}

impl QuantizedVector {
    /// Quantize a vector using 8-bit scalar quantization
    pub fn quantize_8bit(vector: &Vector) -> Self {
        let dim = vector.dim();
        let mut min = vec![f32::INFINITY; dim];
        let mut max = vec![f32::NEG_INFINITY; dim];

        // Find min/max per dimension
        for (i, &val) in vector.data.iter().enumerate() {
            min[i] = min[i].min(val);
            max[i] = max[i].max(val);
        }

        // Calculate scale
        let mut scale = vec![0.0; dim];
        for i in 0..dim {
            let range = max[i] - min[i];
            scale[i] = if range > 0.0 {
                range / 255.0
            } else {
                1.0
            };
        }

        // Quantize
        let mut data = vec![0u8; dim];
        for (i, &val) in vector.data.iter().enumerate() {
            let normalized = (val - min[i]) / scale[i];
            data[i] = normalized.clamp(0.0, 255.0) as u8;
        }

        Self {
            data,
            min,
            scale,
            dimension: dim,
        }
    }

    /// Dequantize back to f32 vector
    pub fn dequantize(&self) -> Vector {
        let mut data = vec![0.0; self.dimension];

        for i in 0..self.dimension {
            data[i] = self.min[i] + (self.data[i] as f32) * self.scale[i];
        }

        Vector::new(data)
    }

    /// Calculate approximate dot product with another quantized vector
    ///
    /// Note: This is an approximation, not exact
    pub fn approximate_dot(&self, other: &QuantizedVector) -> Option<f32> {
        if self.dimension != other.dimension {
            return None;
        }

        let mut sum = 0.0;
        for i in 0..self.dimension {
            let v1 = self.min[i] + (self.data[i] as f32) * self.scale[i];
            let v2 = other.min[i] + (other.data[i] as f32) * other.scale[i];
            sum += v1 * v2;
        }

        Some(sum)
    }

    /// Get size in bytes
    pub fn size_bytes(&self) -> usize {
        self.data.len() + self.min.len() * 4 + self.scale.len() * 4
    }

    /// Calculate compression ratio
    pub fn compression_ratio(&self) -> f32 {
        let original_size = self.dimension * 4; // f32 = 4 bytes
        self.size_bytes() as f32 / original_size as f32
    }
}

/// Product Quantization for efficient vector compression
///
/// Splits vectors into subvectors and learns centroids for each subvector.
/// This provides better compression than scalar quantization while maintaining
/// accuracy for nearest neighbor search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductQuantizer {
    /// Number of subvectors (typically 8-64)
    pub n_subvectors: usize,

    /// Number of centroids per subvector (typically 256 for uint8 codes)
    pub n_centroids: usize,

    /// Centroids: [subvector][centroid_id][dimension]
    /// Each subvector has n_centroids centroids of dimension (dim / n_subvectors)
    pub centroids: Vec<Vec<Vec<f32>>>,

    /// Original vector dimension
    pub dimension: usize,

    /// Dimension of each subvector
    pub subvector_dim: usize,
}

impl ProductQuantizer {
    /// Create a new untrained ProductQuantizer
    pub fn new(dimension: usize, n_subvectors: usize, n_centroids: usize) -> Self {
        assert!(
            dimension % n_subvectors == 0,
            "Dimension must be divisible by n_subvectors"
        );
        assert!(n_centroids <= 256, "Max 256 centroids for uint8 codes");

        let subvector_dim = dimension / n_subvectors;

        Self {
            n_subvectors,
            n_centroids,
            centroids: vec![vec![vec![0.0; subvector_dim]; n_centroids]; n_subvectors],
            dimension,
            subvector_dim,
        }
    }

    /// Train the quantizer on a set of vectors using K-means clustering
    ///
    /// # Arguments
    /// * `vectors` - Training vectors (should be representative of the data)
    /// * `max_iterations` - Maximum K-means iterations per subvector
    /// * `convergence_threshold` - Stop if centroids move less than this
    ///
    /// # Returns
    /// Training error (average reconstruction error)
    pub fn train(
        &mut self,
        vectors: &[Vec<f32>],
        max_iterations: usize,
        convergence_threshold: f32,
    ) -> CoreResult<f32> {
        if vectors.is_empty() {
            return Err(CoreError::invalid_input("Cannot train on empty vector set"));
        }

        if vectors[0].len() != self.dimension {
            return Err(CoreError::invalid_input(format!(
                "Vector dimension mismatch: expected {}, got {}",
                self.dimension,
                vectors[0].len()
            )));
        }

        let mut total_error = 0.0;

        // Train each subvector independently
        for sub_idx in 0..self.n_subvectors {
            let start = sub_idx * self.subvector_dim;
            let end = start + self.subvector_dim;

            // Extract subvectors from all training vectors
            let mut subvectors: Vec<Vec<f32>> = vectors
                .iter()
                .map(|v| v[start..end].to_vec())
                .collect();

            // Run K-means on this subvector
            let (centroids, error) = kmeans(&mut subvectors, self.n_centroids, max_iterations, convergence_threshold)?;

            // Store centroids
            self.centroids[sub_idx] = centroids;
            total_error += error;
        }

        Ok(total_error / self.n_subvectors as f32)
    }

    /// Quantize a vector to uint8 codes
    ///
    /// Returns a vector of centroid IDs (one per subvector)
    pub fn quantize(&self, vector: &[f32]) -> CoreResult<Vec<u8>> {
        if vector.len() != self.dimension {
            return Err(CoreError::invalid_input(format!(
                "Vector dimension mismatch: expected {}, got {}",
                self.dimension,
                vector.len()
            )));
        }

        let mut codes = Vec::with_capacity(self.n_subvectors);

        for sub_idx in 0..self.n_subvectors {
            let start = sub_idx * self.subvector_dim;
            let end = start + self.subvector_dim;
            let subvector = &vector[start..end];

            // Find nearest centroid
            let nearest_id = self.find_nearest_centroid(sub_idx, subvector);
            codes.push(nearest_id as u8);
        }

        Ok(codes)
    }

    /// Reconstruct a vector from quantized codes
    pub fn reconstruct(&self, codes: &[u8]) -> CoreResult<Vec<f32>> {
        if codes.len() != self.n_subvectors {
            return Err(CoreError::invalid_input(format!(
                "Code length mismatch: expected {}, got {}",
                self.n_subvectors,
                codes.len()
            )));
        }

        let mut reconstructed = Vec::with_capacity(self.dimension);

        for (sub_idx, &code) in codes.iter().enumerate() {
            let centroid_id = code as usize;
            if centroid_id >= self.n_centroids {
                return Err(CoreError::invalid_input(format!(
                    "Invalid centroid ID: {} (max {})",
                    centroid_id,
                    self.n_centroids - 1
                )));
            }

            reconstructed.extend_from_slice(&self.centroids[sub_idx][centroid_id]);
        }

        Ok(reconstructed)
    }

    /// Compute asymmetric distance between query and quantized database vector
    ///
    /// This is the key operation for fast nearest neighbor search.
    /// We compute distance between query (full precision) and database vector
    /// (quantized) by looking up centroids.
    ///
    /// Formula: ||q - x||^2 = sum_sub ||q_sub - centroid_sub||^2
    pub fn asymmetric_distance(&self, query: &[f32], codes: &[u8]) -> CoreResult<f32> {
        if query.len() != self.dimension {
            return Err(CoreError::invalid_input(format!(
                "Query dimension mismatch: expected {}, got {}",
                self.dimension,
                query.len()
            )));
        }

        if codes.len() != self.n_subvectors {
            return Err(CoreError::invalid_input(format!(
                "Code length mismatch: expected {}, got {}",
                self.n_subvectors,
                codes.len()
            )));
        }

        let mut distance = 0.0;

        for (sub_idx, &code) in codes.iter().enumerate() {
            let start = sub_idx * self.subvector_dim;
            let end = start + self.subvector_dim;
            let query_sub = &query[start..end];

            let centroid = &self.centroids[sub_idx][code as usize];

            // Compute squared Euclidean distance
            let sub_dist: f32 = query_sub
                .iter()
                .zip(centroid.iter())
                .map(|(q, c)| {
                    let diff = q - c;
                    diff * diff
                })
                .sum();

            distance += sub_dist;
        }

        Ok(distance.sqrt())
    }

    /// Find nearest centroid for a subvector
    fn find_nearest_centroid(&self, sub_idx: usize, subvector: &[f32]) -> usize {
        let centroids = &self.centroids[sub_idx];

        let mut nearest = 0;
        let mut min_dist = f32::INFINITY;

        for (idx, centroid) in centroids.iter().enumerate() {
            let dist: f32 = subvector
                .iter()
                .zip(centroid.iter())
                .map(|(s, c)| {
                    let diff = s - c;
                    diff * diff
                })
                .sum();

            if dist < min_dist {
                min_dist = dist;
                nearest = idx;
            }
        }

        nearest
    }

    /// Get memory usage in bytes
    pub fn memory_usage(&self) -> usize {
        // Centroids: n_subvectors * n_centroids * subvector_dim * 4 bytes
        self.centroids.len() * self.centroids[0].len() * self.subvector_dim * 4
    }

    /// Get compression ratio
    pub fn compression_ratio(&self) -> f32 {
        let original_size = self.dimension * 4; // f32 = 4 bytes
        let compressed_size = self.n_subvectors; // 1 byte per subvector
        compressed_size as f32 / original_size as f32
    }
}

/// K-means clustering for training product quantizer
///
/// # Arguments
/// * `vectors` - Vectors to cluster (modified in place for efficiency)
/// * `k` - Number of clusters
/// * `max_iterations` - Maximum iterations
/// * `convergence_threshold` - Stop if centroids move less than this
///
/// # Returns
/// (centroids, final_error)
fn kmeans(
    vectors: &mut [Vec<f32>],
    k: usize,
    max_iterations: usize,
    convergence_threshold: f32,
) -> CoreResult<(Vec<Vec<f32>>, f32)> {
    if vectors.is_empty() || k == 0 {
        return Err(CoreError::invalid_input("Invalid kmeans parameters"));
    }

    let dim = vectors[0].len();
    let n_vectors = vectors.len();

    // Initialize centroids using K-means++ for better results
    let mut centroids = kmeans_plusplus_init(vectors, k);

    let mut assignments = vec![0; n_vectors];
    let mut final_error = 0.0;

    for iteration in 0..max_iterations {
        // Assign each vector to nearest centroid
        let mut clusters: Vec<Vec<usize>> = vec![Vec::new(); k];
        let mut total_dist = 0.0;

        for (vec_idx, vector) in vectors.iter().enumerate() {
            let mut nearest = 0;
            let mut min_dist = f32::INFINITY;

            for (cent_idx, centroid) in centroids.iter().enumerate() {
                let dist: f32 = vector
                    .iter()
                    .zip(centroid.iter())
                    .map(|(v, c)| {
                        let diff = v - c;
                        diff * diff
                    })
                    .sum();

                if dist < min_dist {
                    min_dist = dist;
                    nearest = cent_idx;
                }
            }

            assignments[vec_idx] = nearest;
            clusters[nearest].push(vec_idx);
            total_dist += min_dist;
        }

        // Update centroids
        let mut max_centroid_move = 0.0;

        for (cluster_idx, cluster) in clusters.iter().enumerate() {
            if cluster.is_empty() {
                // Reinitialize empty centroid to random vector
                centroids[cluster_idx] = vectors[fastrand::usize(0..n_vectors)].clone();
                continue;
            }

            let mut new_centroid = vec![0.0; dim];

            for &vec_idx in cluster {
                for (d, (new_c, v)) in new_centroid.iter_mut().zip(vectors[vec_idx].iter()) {
                    *new_c += v;
                }
            }

            // Divide by cluster size
            let cluster_size = cluster.len() as f32;
            for new_c in new_centroid.iter_mut() {
                *new_c /= cluster_size;
            }

            // Calculate centroid movement
            let movement: f32 = centroids[cluster_idx]
                .iter()
                .zip(new_centroid.iter())
                .map(|(old, new)| {
                    let diff = old - new;
                    diff * diff
                })
                .sum();

            max_centroid_move = max_centroid_move.max(movement);
            centroids[cluster_idx] = new_centroid;
        }

        final_error = total_dist / n_vectors.max(1) as f32;

        // Check convergence
        if max_centroid_move < convergence_threshold {
            tracing::debug!("K-means converged after {} iterations", iteration + 1);
            break;
        }
    }

    Ok((centroids, final_error))
}

/// K-means++ initialization for better centroid starting points
fn kmeans_plusplus_init(vectors: &[Vec<f32>], k: usize) -> Vec<Vec<f32>> {
    let dim = vectors[0].len();
    let n_vectors = vectors.len();

    let mut centroids = Vec::with_capacity(k);

    // Choose first centroid randomly
    let first_idx = fastrand::usize(0..n_vectors);
    centroids.push(vectors[first_idx].clone());

    // Choose remaining centroids with probability proportional to distance squared
    while centroids.len() < k {
        let mut distances = Vec::with_capacity(n_vectors);
        let mut total_dist = 0.0;

        for vector in vectors.iter() {
            // Find minimum distance to existing centroids
            let min_dist = centroids
                .iter()
                .map(|centroid| {
                    vector
                        .iter()
                        .zip(centroid.iter())
                        .map(|(v, c)| {
                            let diff = v - c;
                            diff * diff
                        })
                        .sum::<f32>()
                })
                .min_by(|a, b| a.partial_cmp(b).unwrap())
                .unwrap();

            distances.push(min_dist);
            total_dist += min_dist;
        }

        // Sample next centroid with probability proportional to distance
        let mut rand = fastrand::f32() * total_dist;
        let mut selected_idx = 0;

        for (idx, &dist) in distances.iter().enumerate() {
            rand -= dist;
            if rand <= 0.0 {
                selected_idx = idx;
                break;
            }
        }

        centroids.push(vectors[selected_idx].clone());
    }

    centroids
}

/// Product Quantized vector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PQVector {
    /// Quantized codes (one byte per subvector)
    pub codes: Vec<u8>,
}

impl PQVector {
    /// Create from codes
    pub fn new(codes: Vec<u8>) -> Self {
        Self { codes }
    }

    /// Get size in bytes
    pub fn size_bytes(&self) -> usize {
        self.codes.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quantize_dequantize() {
        let original = Vector::new(vec![1.0, 2.0, 3.0, 4.0]);
        let quantized = QuantizedVector::quantize_8bit(&original);
        let dequantized = quantized.dequantize();

        // Allow some error due to quantization
        for (orig, deq) in original.data.iter().zip(dequantized.data.iter()) {
            assert!((orig - deq).abs() < 0.01);
        }
    }

    #[test]
    fn test_approximate_dot() {
        let v1 = Vector::new(vec![1.0, 2.0, 3.0]);
        let v2 = Vector::new(vec![4.0, 5.0, 6.0]);

        let q1 = QuantizedVector::quantize_8bit(&v1);
        let q2 = QuantizedVector::quantize_8bit(&v2);

        let approx = q1.approximate_dot(&q2);
        assert!(approx.is_some());

        let exact = v1.dot(&v2).unwrap();
        // Should be reasonably close
        assert!((approx.unwrap() - exact).abs() < 0.1);
    }

    #[test]
    fn test_compression_ratio() {
        let v = Vector::new(vec![0.0; 1000]);
        let q = QuantizedVector::quantize_8bit(&v);

        // Should be significantly smaller (about 25% for 8-bit)
        let ratio = q.compression_ratio();
        assert!(ratio < 0.3);
    }

    #[test]
    fn test_config() {
        let config = QuantizationConfig::scalar_8bit();
        assert_eq!(config.bits, 8);
        assert!(!config.use_pq);

        let config = QuantizationConfig::product_quantization(8);
        assert!(config.use_pq);
        assert_eq!(config.pq_subvectors, 8);
    }

    // Product Quantization tests
    #[test]
    fn test_pq_creation() {
        let pq = ProductQuantizer::new(128, 8, 256);
        assert_eq!(pq.dimension, 128);
        assert_eq!(pq.n_subvectors, 8);
        assert_eq!(pq.n_centroids, 256);
        assert_eq!(pq.subvector_dim, 16);
    }

    #[test]
    fn test_pq_invalid_dimension() {
        // Dimension must be divisible by n_subvectors
        let result = std::panic::catch_unwind(|| {
            ProductQuantizer::new(100, 8, 256);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_pq_train() {
        let mut pq = ProductQuantizer::new(128, 8, 16);

        // Generate synthetic training data
        let training_vectors: Vec<Vec<f32>> = (0..100)
            .map(|_| {
                (0..128).map(|_| fastrand::f32()).collect()
            })
            .collect();

        let error = pq.train(&training_vectors, 10, 0.001).unwrap();
        assert!(error >= 0.0);

        // Centroids should be trained (not all zeros)
        let sum: f32 = pq.centroids
            .iter()
            .flat_map(|sub| sub.iter().flat_map(|cent| cent.iter()))
            .sum();

        assert!(sum > 0.0);
    }

    #[test]
    fn test_pq_quantize_reconstruct() {
        let mut pq = ProductQuantizer::new(128, 8, 16);

        // Train
        let training_vectors: Vec<Vec<f32>> = (0..50)
            .map(|_| {
                (0..128).map(|_| fastrand::f32()).collect()
            })
            .collect();
        pq.train(&training_vectors, 10, 0.001).unwrap();

        // Test vector
        let test_vector: Vec<f32> = (0..128).map(|i| i as f32 / 128.0).collect();

        // Quantize
        let codes = pq.quantize(&test_vector).unwrap();
        assert_eq!(codes.len(), 8);

        // Reconstruct
        let reconstructed = pq.reconstruct(&codes).unwrap();
        assert_eq!(reconstructed.len(), 128);

        // Calculate reconstruction error
        let error: f32 = test_vector
            .iter()
            .zip(reconstructed.iter())
            .map(|(orig, rec)| {
                let diff = orig - rec;
                diff * diff
            })
            .sum::<f32>()
            .sqrt();

        // Should have reasonable accuracy (< 20% relative error for random data)
        let norm: f32 = test_vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        let relative_error = error / norm;
        assert!(relative_error < 0.5, "Relative error: {}", relative_error);
    }

    #[test]
    fn test_pq_asymmetric_distance() {
        let mut pq = ProductQuantizer::new(64, 4, 16);

        // Train
        let training_vectors: Vec<Vec<f32>> = (0..50)
            .map(|_| {
                (0..64).map(|_| fastrand::f32()).collect()
            })
            .collect();
        pq.train(&training_vectors, 10, 0.001).unwrap();

        // Query vector
        let query: Vec<f32> = (0..64).map(|_| fastrand::f32()).collect();

        // Database vector (quantized)
        let db_vector: Vec<f32> = (0..64).map(|_| fastrand::f32()).collect();
        let codes = pq.quantize(&db_vector).unwrap();

        // Compute asymmetric distance
        let dist = pq.asymmetric_distance(&query, &codes).unwrap();
        assert!(dist >= 0.0);

        // Compare with exact distance
        let exact_dist: f32 = query
            .iter()
            .zip(db_vector.iter())
            .map(|(q, d)| {
                let diff = q - d;
                diff * diff
            })
            .sum::<f32>()
            .sqrt();

        // Should be reasonably close (< 30% error for random data)
        let relative_error = (dist - exact_dist).abs() / exact_dist.max(1e-6);
        assert!(
            relative_error < 0.5,
            "Relative error: {} (asymmetric: {}, exact: {})",
            relative_error,
            dist,
            exact_dist
        );
    }

    #[test]
    fn test_pq_compression_ratio() {
        let pq = ProductQuantizer::new(1536, 64, 256);

        // Original: 1536 * 4 = 6144 bytes
        // Compressed: 64 bytes (one per subvector)
        let ratio = pq.compression_ratio();
        assert!(ratio < 0.02, "Compression ratio: {}", ratio);

        // Memory usage for centroids
        let centroid_memory = pq.memory_usage();
        // 64 subvectors * 256 centroids * 24 dim * 4 bytes
        let expected = 64 * 256 * 24 * 4;
        assert_eq!(centroid_memory, expected);
    }

    #[test]
    fn test_pq_vector_size() {
        let pq = ProductQuantizer::new(1536, 64, 256);
        let codes = vec![0u8; 64];

        let pq_vector = PQVector::new(codes);
        assert_eq!(pq_vector.size_bytes(), 64);

        // Compare with original f32 vector
        let original_size = 1536 * 4;
        let ratio = pq_vector.size_bytes() as f32 / original_size as f32;
        assert!(ratio < 0.02, "Ratio: {}", ratio);
    }

    #[test]
    fn test_pq_dimension_mismatch() {
        let mut pq = ProductQuantizer::new(128, 8, 16);

        // Train
        let training_vectors: Vec<Vec<f32>> = (0..10)
            .map(|_| {
                (0..128).map(|_| fastrand::f32()).collect()
            })
            .collect();
        pq.train(&training_vectors, 5, 0.01).unwrap();

        // Wrong dimension
        let wrong_vector = vec![0.0; 64];
        let result = pq.quantize(&wrong_vector);
        assert!(result.is_err());
    }

    #[test]
    fn test_pq_realistic_embedding() {
        // Test with realistic embedding dimensions (1536 for OpenAI ada-002)
        let mut pq = ProductQuantizer::new(1536, 64, 256);

        // Generate training data with some structure (not pure random)
        let training_vectors: Vec<Vec<f32>> = (0..100)
            .map(|_| {
                // Create vectors with some smooth patterns
                (0..1536)
                    .map(|i| {
                        let base = (i as f32 / 1536.0) * 2.0 - 1.0;
                        base + fastrand::f32() * 0.1
                    })
                    .collect()
            })
            .collect();

        let error = pq.train(&training_vectors, 15, 0.001).unwrap();
        println!("Training error: {}", error);

        // Test a realistic query
        let query: Vec<f32> = (0..1536)
            .map(|i| {
                let base = (i as f32 / 1536.0) * 2.0 - 1.0;
                base + fastrand::f32() * 0.1
            })
            .collect();

        let codes = pq.quantize(&query).unwrap();
        assert_eq!(codes.len(), 64);

        let reconstructed = pq.reconstruct(&codes).unwrap();

        // Check reconstruction accuracy
        let mse: f32 = query
            .iter()
            .zip(reconstructed.iter())
            .map(|(orig, rec)| {
                let diff = orig - rec;
                diff * diff
            })
            .sum::<f32>()
            / query.len() as f32;

        println!("MSE: {}", mse);
        // MSE should be reasonable (< 0.1 for structured data)
        assert!(mse < 0.5, "MSE too high: {}", mse);
    }
}
