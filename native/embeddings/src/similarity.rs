//! # Similarity Metrics
//!
//! Various distance and similarity metrics for vector comparison.

use superinstance_native_core::Vector;

/// Similarity metric type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimilarityMetric {
    /// Cosine similarity (-1 to 1, higher is better)
    Cosine,

    /// Euclidean distance (0 to inf, lower is better)
    Euclidean,

    /// Dot product (-inf to inf, higher is better)
    DotProduct,
}

/// Calculate cosine similarity between two vectors
///
/// Returns value in [-1, 1] where 1 means identical direction.
pub fn cosine(a: &Vector, b: &Vector) -> f32 {
    a.cosine_similarity(b)
        .unwrap_or_else(|| {
            // Fallback if dimensions don't match or other error
            let min_dim = a.dim().min(b.dim());
            let a_slice = &a.data[..min_dim];
            let b_slice = &b.data[..min_dim];

            let dot: f32 = a_slice.iter().zip(b_slice.iter()).map(|(x, y)| x * y).sum();
            let norm_a: f32 = a_slice.iter().map(|x| x * x).sum::<f32>().sqrt();
            let norm_b: f32 = b_slice.iter().map(|x| x * x).sum::<f32>().sqrt();

            if norm_a == 0.0 || norm_b == 0.0 {
                0.0
            } else {
                dot / (norm_a * norm_b)
            }
        })
}

/// Calculate Euclidean distance between two vectors
///
/// Returns value in [0, inf] where 0 means identical.
pub fn euclidean(a: &Vector, b: &Vector) -> f32 {
    let min_dim = a.dim().min(b.dim());
    let mut sum_sq = 0.0f32;

    for i in 0..min_dim {
        let diff = a.data[i] - b.data[i];
        sum_sq += diff * diff;
    }

    // Handle remaining dimensions if vectors have different lengths
    if a.dim() > b.dim() {
        for i in min_dim..a.dim() {
            sum_sq += a.data[i] * a.data[i];
        }
    } else if b.dim() > a.dim() {
        for i in min_dim..b.dim() {
            sum_sq += b.data[i] * b.data[i];
        }
    }

    sum_sq.sqrt()
}

/// Calculate dot product between two vectors
///
/// Returns value in [-inf, inf].
pub fn dot_product(a: &Vector, b: &Vector) -> f32 {
    a.dot(b).unwrap_or_else(|| {
        let min_dim = a.dim().min(b.dim());
        a.data[..min_dim]
            .iter()
            .zip(b.data[..min_dim].iter())
            .map(|(x, y)| x * y)
            .sum()
    })
}

/// Calculate Manhattan (L1) distance between two vectors
pub fn manhattan(a: &Vector, b: &Vector) -> f32 {
    let min_dim = a.dim().min(b.dim());
    let mut sum = 0.0f32;

    for i in 0..min_dim {
        sum += (a.data[i] - b.data[i]).abs();
    }

    // Handle remaining dimensions
    if a.dim() > b.dim() {
        for i in min_dim..a.dim() {
            sum += a.data[i].abs();
        }
    } else if b.dim() > a.dim() {
        for i in min_dim..b.dim() {
            sum += b.data[i].abs();
        }
    }

    sum
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine() {
        let a = Vector::new(vec![1.0, 0.0]);
        let b = Vector::new(vec![0.0, 1.0]);
        assert!((cosine(&a, &b) - 0.0).abs() < 1e-6);

        let c = Vector::new(vec![1.0, 0.0]);
        let d = Vector::new(vec![1.0, 0.0]);
        assert!((cosine(&c, &d) - 1.0).abs() < 1e-6);

        let e = Vector::new(vec![1.0, 1.0]);
        let f = Vector::new(vec![-1.0, -1.0]);
        assert!((cosine(&e, &f) - (-1.0)).abs() < 1e-6);
    }

    #[test]
    fn test_euclidean() {
        let a = Vector::new(vec![0.0, 0.0]);
        let b = Vector::new(vec![3.0, 4.0]);
        assert!((euclidean(&a, &b) - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_dot_product() {
        let a = Vector::new(vec![1.0, 2.0, 3.0]);
        let b = Vector::new(vec![4.0, 5.0, 6.0]);
        assert!((dot_product(&a, &b) - 32.0).abs() < 1e-6);
    }

    #[test]
    fn test_manhattan() {
        let a = Vector::new(vec![0.0, 0.0]);
        let b = Vector::new(vec![3.0, 4.0]);
        assert!((manhattan(&a, &b) - 7.0).abs() < 1e-6);
    }
}
