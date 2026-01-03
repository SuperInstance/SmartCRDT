//! Sample embedding fixtures for testing
//!
//! Pre-computed embeddings for semantic similarity testing

use smartcrt_core::resonance::ResonanceCompute;

/// Sample intent embedding for "user login" event
pub const INTENT_LOGIN: [f32; 384] = {
    let mut arr = [0.0f32; 384];
    let mut i = 0;
    // Simulated embedding for authentication context
    while i < 384 {
        arr[i] = ((i as f32) * 0.01234567).sin() * 0.3;
        i += 1;
    }
    arr
};

/// Sample intent embedding for "file access" event
pub const INTENT_FILE_ACCESS: [f32; 384] = {
    let mut arr = [0.0f32; 384];
    let mut i = 0;
    // Simulated embedding for file system context
    while i < 384 {
        arr[i] = ((i as f32) * 0.02345678).cos() * 0.4;
        i += 1;
    }
    arr
};

/// Sample state embedding for "authenticated user" state
pub const STATE_AUTHENTICATED: [f32; 384] = {
    let mut arr = [0.0f32; 384];
    let mut i = 0;
    while i < 384 {
        arr[i] = ((i as f32) * 0.03456789).sin() * 0.5;
        i += 1;
    }
    arr
};

/// Sample state embedding for "file open" state
pub const STATE_FILE_OPEN: [f32; 384] = {
    let mut arr = [0.0f32; 384];
    let mut i = 0;
    while i < 384 {
        arr[i] = ((i as f32) * 0.04567890).cos() * 0.6;
        i += 1;
    }
    arr
};

/// Cluster of similar embeddings for anomaly detection testing
pub const ANOMALY_CLUSTER_BASE: [f32; 384] = {
    let mut arr = [0.0f32; 384];
    let mut i = 0;
    while i < 384 {
        arr[i] = ((i as f32) * 0.05678901).tan() * 0.2;
        i += 1;
    }
    arr
};

/// Generate semantic variations for clustering tests
pub fn generate_cluster_embeddings(center: &[f32; 384], count: usize, spread: f32) -> Vec<[f32; 384]> {
    let mut embeddings = Vec::with_capacity(count);
    for i in 0..count {
        let mut emb = *center;
        for j in 0..384 {
            emb[j] += ((i as f32 * 0.1 + j as f32 * 0.01).sin() - 0.5) * spread;
        }
        embeddings.push(emb);
    }
    embeddings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_constants() {
        assert_eq!(INTENT_LOGIN.len(), 384);
        assert_eq!(STATE_AUTHENTICATED.len(), 384);
    }

    #[test]
    fn test_cluster_generation() {
        let cluster = generate_cluster_embeddings(&ANOMALY_CLUSTER_BASE, 10, 0.1);
        assert_eq!(cluster.len(), 10);
    }
}
