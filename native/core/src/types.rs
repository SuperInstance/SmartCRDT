//! # Core Types
//!
//! Common data types used across all native modules.

use serde::{Deserialize, Serialize};
use std::fmt;

/// A vector of floating-point values (for embeddings, features, etc.)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Vector {
    /// The underlying data
    pub data: Vec<f32>,

    /// Dimension of the vector
    #[serde(skip)]
    pub dimension: usize,
}

impl Vector {
    /// Create a new vector from data
    pub fn new(data: Vec<f32>) -> Self {
        let dimension = data.len();
        Self { data, dimension }
    }

    /// Create a zero vector of given dimension
    pub fn zeros(dimension: usize) -> Self {
        Self {
            data: vec![0.0; dimension],
            dimension,
        }
    }

    /// Get the dimension
    pub fn dim(&self) -> usize {
        self.dimension
    }

    /// Calculate L2 norm (Euclidean length)
    pub fn norm(&self) -> f32 {
        self.data.iter().map(|x| x * x).sum::<f32>().sqrt()
    }

    /// Normalize to unit length
    pub fn normalize(&mut self) {
        let norm = self.norm();
        if norm > 0.0 {
            for x in &mut self.data {
                *x /= norm;
            }
        }
    }

    /// Get a normalized copy
    pub fn normalized(&self) -> Self {
        let mut copy = self.clone();
        copy.normalize();
        copy
    }

    /// Dot product with another vector
    pub fn dot(&self, other: &Vector) -> Option<f32> {
        if self.dimension != other.dimension {
            return None;
        }
        Some(
            self.data
                .iter()
                .zip(other.data.iter())
                .map(|(a, b)| a * b)
                .sum(),
        )
    }

    /// Cosine similarity with another vector
    pub fn cosine_similarity(&self, other: &Vector) -> Option<f32> {
        if self.dimension != other.dimension {
            return None;
        }
        let dot = self.dot(other)?;
        let norm_product = self.norm() * other.norm();
        if norm_product == 0.0 {
            return Some(0.0);
        }
        Some(dot / norm_product)
    }
}

impl From<Vec<f32>> for Vector {
    fn from(data: Vec<f32>) -> Self {
        Self::new(data)
    }
}

impl AsRef<[f32]> for Vector {
    fn as_ref(&self) -> &[f32] {
        &self.data
    }
}

/// An embedding with associated metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Embedding {
    /// The embedding vector
    pub vector: Vector,

    /// Optional identifier
    pub id: Option<String>,

    /// Model used to generate the embedding
    pub model: Option<String>,

    /// Timestamp of creation
    pub created_at: u64,
}

impl Embedding {
    /// Create a new embedding
    pub fn new(vector: Vector) -> Self {
        Self {
            vector,
            id: None,
            model: None,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    /// Set the ID
    pub fn with_id(mut self, id: String) -> Self {
        self.id = Some(id);
        self
    }

    /// Set the model
    pub fn with_model(mut self, model: String) -> Self {
        self.model = Some(model);
        self
    }

    /// Calculate similarity with another embedding
    pub fn similarity(&self, other: &Embedding) -> Option<f32> {
        self.vector.cosine_similarity(&other.vector)
    }
}

/// Similarity score with metadata
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Similarity {
    /// Score (0-1 for cosine, 0-inf for L2)
    pub score: f32,

    /// ID of the matched item
    pub id: Option<String>,

    /// Any additional metadata
    pub metadata: Option<serde_json::Value>,
}

impl Similarity {
    /// Create a new similarity score
    pub fn new(score: f32, id: Option<String>) -> Self {
        Self {
            score,
            id,
            metadata: None,
        }
    }

    /// Add metadata
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }
}

impl PartialOrd for Similarity {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        // Higher scores are better, so reverse the comparison
        other.score.partial_cmp(&self.score)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_creation() {
        let v = Vector::new(vec![1.0, 2.0, 3.0]);
        assert_eq!(v.dim(), 3);
        assert_eq!(v.norm().sqrt(), (14.0_f32).sqrt()); // sqrt(1+4+9)
    }

    #[test]
    fn test_vector_normalization() {
        let mut v = Vector::new(vec![3.0, 4.0]);
        v.normalize();
        assert!((v.norm() - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_vector_dot_product() {
        let v1 = Vector::new(vec![1.0, 2.0, 3.0]);
        let v2 = Vector::new(vec![4.0, 5.0, 6.0]);
        assert_eq!(v1.dot(&v2), Some(32.0)); // 1*4 + 2*5 + 3*6
    }

    #[test]
    fn test_vector_cosine_similarity() {
        let v1 = Vector::new(vec![1.0, 0.0]);
        let v2 = Vector::new(vec![0.0, 1.0]);
        assert_eq!(v1.cosine_similarity(&v2), Some(0.0));

        let v3 = Vector::new(vec![1.0, 0.0]);
        let v4 = Vector::new(vec![1.0, 0.0]);
        assert_eq!(v3.cosine_similarity(&v4), Some(1.0));
    }

    #[test]
    fn test_embedding() {
        let v = Vector::new(vec![1.0, 2.0, 3.0]);
        let emb = Embedding::new(v).with_id("test".to_string());
        assert_eq!(emb.id, Some("test".to_string()));
    }
}
