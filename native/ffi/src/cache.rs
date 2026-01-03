//! # FFI Bindings for Semantic Cache
//!
//! Node.js/TypeScript bindings for the high-performance semantic cache.

use napi_derive::napi;
use superinstance_native_core::Vector;
use superinstance_native_embeddings::{
    SemanticCache, CacheEntry, CacheHit, CacheConfig, SimilarityResult,
};

/// Cache configuration for FFI
#[napi(object)]
pub struct FfiCacheConfig {
    /// Maximum cache size
    pub max_size: u32,

    /// Similarity threshold (0-1)
    pub similarity_threshold: f64,

    /// TTL in milliseconds (0 = no expiration)
    pub ttl_ms: u64,

    /// Number of threads (0 = auto)
    pub num_threads: u32,
}

impl From<FfiCacheConfig> for CacheConfig {
    fn from(config: FfiCacheConfig) -> Self {
        Self {
            max_size: config.max_size as usize,
            similarity_threshold: config.similarity_threshold as f32,
            ttl_ms: if config.ttl_ms == 0 { None } else { Some(config.ttl_ms) },
            num_threads: config.num_threads as usize,
        }
    }
}

/// A cache entry for FFI
#[napi(object)]
pub struct FfiCacheEntry {
    /// Query text
    pub query: String,

    /// Embedding vector
    pub embedding: Vec<f32>,

    /// Serialized result
    pub result: serde_json::Value,

    /// Hit count
    pub hit_count: u64,

    /// Last accessed timestamp
    pub last_accessed: u64,

    /// Created timestamp
    pub created_at: u64,
}

impl From<CacheEntry> for FfiCacheEntry {
    fn from(entry: CacheEntry) -> Self {
        Self {
            query: entry.query,
            embedding: entry.embedding.data,
            result: entry.result,
            hit_count: entry.hit_count,
            last_accessed: entry.last_accessed,
            created_at: entry.created_at,
        }
    }
}

/// A cache hit result for FFI
#[napi(object)]
pub struct FfiCacheHit {
    /// Cache key
    pub key: String,

    /// Query text
    pub query: String,

    /// Similarity score (0-1)
    pub similarity: f64,

    /// Cached result
    pub result: serde_json::Value,
}

impl From<CacheHit> for FfiCacheHit {
    fn from(hit: CacheHit) -> Self {
        Self {
            key: hit.key,
            query: hit.query,
            similarity: hit.similarity as f64,
            result: hit.result,
        }
    }
}

/// A similarity result for FFI
#[napi(object)]
pub struct FfiSimilarityResult {
    /// Cache key
    pub key: String,

    /// Query text
    pub query: String,

    /// Similarity score (0-1)
    pub similarity: f64,
}

impl From<SimilarityResult> for FfiSimilarityResult {
    fn from(result: SimilarityResult) -> Self {
        Self {
            key: result.key,
            query: result.query,
            similarity: result.similarity as f64,
        }
    }
}

/// Semantic cache for Node.js
#[napi]
pub struct NativeSemanticCache {
    inner: SemanticCache,
}

#[napi]
impl NativeSemanticCache {
    /// Create a new semantic cache
    #[napi(constructor)]
    pub fn new(config: Option<FfiCacheConfig>) -> Self {
        let cache_config = config.map(|c| c.into()).unwrap_or_default();
        Self {
            inner: SemanticCache::new(cache_config),
        }
    }

    /// Get entry from cache with semantic similarity search
    #[napi]
    pub fn get(&self, key: String, query_embedding: Vec<f32>) -> Option<FfiCacheHit> {
        self.inner
            .get(&key, &query_embedding)
            .map(|hit| hit.into())
    }

    /// Set entry in cache
    #[napi]
    pub fn set(
        &self,
        key: String,
        query: String,
        embedding: Vec<f32>,
        result: serde_json::Value,
    ) {
        let vector = Vector::new(embedding);
        self.inner.set(key, query, vector, result);
    }

    /// Find similar entries using parallel search
    #[napi]
    pub fn find_similar(
        &self,
        query_embedding: Vec<f32>,
        threshold: f64,
    ) -> Vec<FfiSimilarityResult> {
        self.inner
            .find_similar(&query_embedding, threshold as f32)
            .into_iter()
            .map(|r| r.into())
            .collect()
    }

    /// Clear all cache entries
    #[napi]
    pub fn clear(&self) {
        self.inner.clear();
    }

    /// Get current cache size
    #[napi]
    pub fn size(&self) -> u32 {
        self.inner.size() as u32
    }

    /// Check if key exists in cache
    #[napi]
    pub fn has(&self, key: String) -> bool {
        self.inner.has(&key)
    }

    /// Delete specific entry
    #[napi]
    pub fn delete(&self, key: String) -> bool {
        self.inner.delete(&key)
    }

    /// Get all cache keys
    #[napi]
    pub fn keys(&self) -> Vec<String> {
        self.inner.keys()
    }

    /// Get cache statistics
    #[napi]
    pub fn get_stats(&self) -> CacheStats {
        let size = self.inner.size();
        CacheStats {
            size: size as u32,
            ..Default::default()
        }
    }
}

/// Cache statistics
#[napi(object)]
pub struct CacheStats {
    /// Current cache size
    pub size: u32,

    /// Number of hits (placeholder for future implementation)
    pub hits: u32,

    /// Number of misses (placeholder for future implementation)
    pub misses: u32,

    /// Hit rate (placeholder for future implementation)
    pub hit_rate: f64,
}

impl Default for CacheStats {
    fn default() -> Self {
        Self {
            size: 0,
            hits: 0,
            misses: 0,
            hit_rate: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_cache_config_conversion() {
        let config = FfiCacheConfig {
            max_size: 100,
            similarity_threshold: 0.85,
            ttl_ms: 3600000,
            num_threads: 4,
        };

        let cache_config: CacheConfig = config.into();
        assert_eq!(cache_config.max_size, 100);
        assert!((cache_config.similarity_threshold - 0.85).abs() < 1e-6);
    }

    #[test]
    fn test_ffi_cache_hit_conversion() {
        let hit = CacheHit {
            key: "test_key".to_string(),
            query: "test query".to_string(),
            similarity: 0.95,
            result: serde_json::json!({"answer": "test"}),
        };

        let ffi_hit: FfiCacheHit = hit.into();
        assert_eq!(ffi_hit.key, "test_key");
        assert!((ffi_hit.similarity - 0.95).abs() < 1e-6);
    }
}
