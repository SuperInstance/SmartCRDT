//! # Vector Operations
//!
//! Batch and parallel operations on vectors.

use superinstance_native_core::{CoreError, CoreResult, Vector};

/// Normalize a batch of vectors to unit length
pub fn batch_normalize(vectors: &mut [Vector]) {
    for vec in vectors {
        vec.normalize();
    }
}

/// Calculate batch distances between two sets of vectors
///
/// Returns a matrix where result[i][j] = distance(vectors1[i], vectors2[j])
pub fn batch_distance(
    vectors1: &[Vector],
    vectors2: &[Vector],
    metric: super::similarity::SimilarityMetric,
) -> CoreResult<Vec<Vec<f32>>> {
    let mut result = Vec::with_capacity(vectors1.len());

    for v1 in vectors1 {
        let mut row = Vec::with_capacity(vectors2.len());
        for v2 in vectors2 {
            let distance = match metric {
                super::similarity::SimilarityMetric::Cosine => {
                    super::super::cosine(v1, v2)
                }
                super::similarity::SimilarityMetric::Euclidean => {
                    super::super::euclidean(v1, v2)
                }
                super::similarity::SimilarityMetric::DotProduct => {
                    super::super::dot_product(v1, v2)
                }
            };
            row.push(distance);
        }
        result.push(row);
    }

    Ok(result)
}

/// Simple matrix multiplication for dense matrices
///
/// matrices are stored in row-major order
pub fn matmul(a: &[f32], b: &[f32], m: usize, n: usize, p: usize) -> Vec<f32> {
    let mut c = vec![0.0; m * p];

    for i in 0..m {
        for j in 0..p {
            let mut sum = 0.0;
            for k in 0..n {
                sum += a[i * n + k] * b[k * p + j];
            }
            c[i * p + j] = sum;
        }
    }

    c
}

/// Calculate mean of vectors
pub fn mean(vectors: &[Vector]) -> CoreResult<Vector> {
    if vectors.is_empty() {
        return Err(CoreError::invalid_input("Cannot compute mean of empty vector list"));
    }

    let dim = vectors[0].dim();
    if !vectors.iter().all(|v| v.dim() == dim) {
        return Err(CoreError::vector("All vectors must have the same dimension"));
    }

    let mut mean_data = vec![0.0; dim];
    for vec in vectors {
        for (i, &val) in vec.data.iter().enumerate() {
            mean_data[i] += val;
        }
    }

    let count = vectors.len() as f32;
    for val in &mut mean_data {
        *val /= count;
    }

    Ok(Vector::new(mean_data))
}

/// Calculate weighted sum of vectors
pub fn weighted_sum(vectors: &[Vector], weights: &[f32]) -> CoreResult<Vector> {
    if vectors.is_empty() {
        return Err(CoreError::invalid_input("Cannot compute weighted sum of empty list"));
    }

    if vectors.len() != weights.len() {
        return Err(CoreError::invalid_input(
            "Vectors and weights must have the same length",
        ));
    }

    let dim = vectors[0].dim();
    if !vectors.iter().all(|v| v.dim() == dim) {
        return Err(CoreError::vector("All vectors must have the same dimension"));
    }

    let mut result = vec![0.0; dim];
    for (vec, &weight) in vectors.iter().zip(weights.iter()) {
        for (i, &val) in vec.data.iter().enumerate() {
            result[i] += val * weight;
        }
    }

    Ok(Vector::new(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_normalize() {
        let mut vectors = vec![
            Vector::new(vec![3.0, 4.0]),
            Vector::new(vec![5.0, 12.0]),
        ];

        batch_normalize(&mut vectors);

        for vec in &vectors {
            assert!((vec.norm() - 1.0).abs() < 1e-6);
        }
    }

    #[test]
    fn test_batch_distance() {
        let v1 = vec![Vector::new(vec![1.0, 0.0])];
        let v2 = vec![
            Vector::new(vec![1.0, 0.0]),
            Vector::new(vec![0.0, 1.0]),
        ];

        let result = batch_distance(&v1, &v2, super::similarity::SimilarityMetric::Cosine).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].len(), 2);
        assert!((result[0][0] - 1.0).abs() < 1e-6);
        assert!((result[0][1] - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_matmul() {
        let a = vec![1.0, 2.0, 3.0, 4.0]; // 2x2 matrix
        let b = vec![5.0, 6.0, 7.0, 8.0]; // 2x2 matrix

        let c = matmul(&a, &b, 2, 2, 2);

        assert_eq!(c.len(), 4);
        assert!((c[0] - 19.0).abs() < 1e-6); // 1*5 + 2*7
        assert!((c[1] - 22.0).abs() < 1e-6); // 1*6 + 2*8
        assert!((c[2] - 43.0).abs() < 1e-6); // 3*5 + 4*7
        assert!((c[3] - 50.0).abs() < 1e-6); // 3*6 + 4*8
    }

    #[test]
    fn test_mean() {
        let vectors = vec![
            Vector::new(vec![1.0, 2.0]),
            Vector::new(vec![3.0, 4.0]),
            Vector::new(vec![5.0, 6.0]),
        ];

        let mean = mean(&vectors).unwrap();
        assert!((mean.data[0] - 3.0).abs() < 1e-6);
        assert!((mean.data[1] - 4.0).abs() < 1e-6);
    }

    #[test]
    fn test_weighted_sum() {
        let vectors = vec![
            Vector::new(vec![1.0, 2.0]),
            Vector::new(vec![3.0, 4.0]),
        ];
        let weights = vec![0.5, 0.5];

        let result = weighted_sum(&vectors, &weights).unwrap();
        assert!((result.data[0] - 2.0).abs() < 1e-6);
        assert!((result.data[1] - 3.0).abs() < 1e-6);
    }

    #[test]
    fn test_mean_empty() {
        let vectors: Vec<Vector> = vec![];
        let result = mean(&vectors);
        assert!(result.is_err());
    }

    #[test]
    fn test_weighted_sum_mismatch() {
        let vectors = vec![Vector::new(vec![1.0, 2.0])];
        let weights = vec![0.5, 0.5];

        let result = weighted_sum(&vectors, &weights);
        assert!(result.is_err());
    }
}
