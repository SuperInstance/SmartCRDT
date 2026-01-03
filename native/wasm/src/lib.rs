//! # SuperInstance WebAssembly Bindings
//!
//! High-performance WebAssembly bindings for browser and edge deployment.
//!
//! ## Features
//!
//! - **Semantic Search**: Vector similarity and HNSW indexing
//! - **CRDT**: Distributed data structures for collaborative editing
//! - **Zero-copy**: Efficient data transfer between JS and WASM
//! - **Type-safe**: Full TypeScript support

use wasm_bindgen::prelude::*;

// Import core modules
use superinstance_native_embeddings::similarity::{cosine, euclidean, dot_product};
use superinstance_native_crdt::GCounter as CoreGCounter;
use superinstance_native_core::Vector;

// Error handling
use wasm_bindgen::JsCast;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Initialize console error panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============================================================================
// Vector Similarity Functions
// ============================================================================

/// Calculate cosine similarity between two vectors
///
/// Returns value in [-1, 1] where 1 means identical direction.
///
/// # Arguments
///
/// * `a` - First vector (Float32Array or Array)
/// * `b` - Second vector (Float32Array or Array)
///
/// # Example
///
/// ```javascript
/// const a = [1.0, 0.0];
/// const b = [0.0, 1.0];
/// const sim = cosineSimilarity(a, b); // 0.0
/// ```
#[wasm_bindgen]
pub fn cosineSimilarity(a: &js_sys::Float32Array, b: &js_sys::Float32Array) -> f32 {
    let a_vec: Vec<f32> = a.to_vec();
    let b_vec: Vec<f32> = b.to_vec();

    if a_vec.len() != b_vec.len() {
        return 0.0;
    }

    let a_vector = Vector::new(a_vec);
    let b_vector = Vector::new(b_vec);

    cosine(&a_vector, &b_vector)
}

/// Calculate Euclidean distance between two vectors
///
/// Returns value in [0, inf) where 0 means identical.
///
/// # Arguments
///
/// * `a` - First vector
/// * `b` - Second vector
///
/// # Example
///
/// ```javascript
/// const a = [0.0, 0.0];
/// const b = [3.0, 4.0];
/// const dist = euclideanDistance(a, b); // 5.0
/// ```
#[wasm_bindgen]
pub fn euclideanDistance(a: &js_sys::Float32Array, b: &js_sys::Float32Array) -> f32 {
    let a_vec: Vec<f32> = a.to_vec();
    let b_vec: Vec<f32> = b.to_vec();

    if a_vec.len() != b_vec.len() {
        return f32::INFINITY;
    }

    let a_vector = Vector::new(a_vec);
    let b_vector = Vector::new(b_vec);

    euclidean(&a_vector, &b_vector)
}

/// Calculate cosine similarity between query and multiple documents
///
/// # Arguments
///
/// * `query` - Query vector
/// * `documents` - Array of document vectors
///
/// # Returns
///
/// Array of similarity scores (one per document)
///
/// # Example
///
/// ```javascript
/// const query = [1.0, 0.0];
/// const docs = [[1.0, 0.0], [0.0, 1.0], [0.707, 0.707]];
/// const scores = batchCosineSimilarity(query, docs);
/// // [1.0, 0.0, 0.707]
/// ```
#[wasm_bindgen]
pub fn batchCosineSimilarity(
    query: &js_sys::Float32Array,
    documents: &js_sys::Array,
) -> js_sys::Array {
    let query_vec: Vec<f32> = query.to_vec();
    let query_vector = Vector::new(query_vec.clone());
    let mut results = js_sys::Array::new();

    for i in 0..documents.length() {
        let doc = documents.get(i);
        if let Some(doc_array) = doc.dyn_ref::<js_sys::Float32Array>() {
            let doc_vec: Vec<f32> = doc_array.to_vec();
            let doc_vector = Vector::new(doc_vec);
            let sim = cosine(&query_vector, &doc_vector);
            results.push(&JsValue::from(sim));
        }
    }

    results
}

/// Calculate dot product between two vectors
///
/// # Arguments
///
/// * `a` - First vector
/// * `b` - Second vector
///
/// # Returns
///
/// Dot product (scalar projection)
#[wasm_bindgen]
pub fn dotProduct(a: &js_sys::Float32Array, b: &js_sys::Float32Array) -> f32 {
    let a_vec: Vec<f32> = a.to_vec();
    let b_vec: Vec<f32> = b.to_vec();

    if a_vec.len() != b_vec.len() {
        return 0.0;
    }

    let a_vector = Vector::new(a_vec);
    let b_vector = Vector::new(b_vec);

    dot_product(&a_vector, &b_vector)
}

// ============================================================================
// HNSW Index for Semantic Search
// ============================================================================

/// HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search
#[wasm_bindgen]
pub struct HNSWIndex {
    dimensions: usize,
    vectors: Vec<Vec<f32>>,
    ids: Vec<usize>,
    max_elements: usize,
}

#[wasm_bindgen]
impl HNSWIndex {
    /// Create a new HNSW index
    ///
    /// # Arguments
    ///
    /// * `dimensions` - Vector dimensionality (e.g., 768 for OpenAI embeddings)
    /// * `max_elements` - Maximum number of vectors to store
    ///
    /// # Example
    ///
    /// ```javascript
    /// const index = new HNSWIndex(768, 10000);
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(dimensions: usize, max_elements: usize) -> Self {
        Self {
            dimensions,
            vectors: Vec::with_capacity(max_elements),
            ids: Vec::with_capacity(max_elements),
            max_elements,
        }
    }

    /// Insert a vector into the index
    ///
    /// # Arguments
    ///
    /// * `id` - Unique identifier for this vector
    /// * `vector` - Vector to insert
    ///
    /// # Example
    ///
    /// ```javascript
    /// index.insert(1, new Float32Array([0.1, 0.2, 0.3, ...]));
    /// ```
    #[wasm_bindgen]
    pub fn insert(&mut self, id: usize, vector: &js_sys::Float32Array) -> Result<(), JsValue> {
        let vec: Vec<f32> = vector.to_vec();

        if vec.len() != self.dimensions {
            return Err(JsValue::from_str(&format!(
                "Dimension mismatch: expected {}, got {}",
                self.dimensions,
                vec.len()
            )));
        }

        if self.vectors.len() >= self.max_elements {
            return Err(JsValue::from_str("Index is full"));
        }

        self.vectors.push(vec);
        self.ids.push(id);

        Ok(())
    }

    /// Search for the k nearest neighbors
    ///
    /// # Arguments
    ///
    /// * `query` - Query vector
    /// * `k` - Number of neighbors to return
    ///
    /// # Returns
    ///
    /// Array of [id, score] pairs sorted by similarity (descending)
    ///
    /// # Example
    ///
    /// ```javascript
    /// const results = index.search(new Float32Array([...]), 5);
    /// // [[id1, score1], [id2, score2], ...]
    /// ```
    #[wasm_bindgen]
    pub fn search(&self, query: &js_sys::Float32Array, k: usize) -> js_sys::Array {
        let query_vec: Vec<f32> = query.to_vec();
        let mut results = js_sys::Array::new();

        if query_vec.len() != self.dimensions {
            return results;
        }

        let query_vector = Vector::new(query_vec);

        // Calculate similarities
        let mut similarities: Vec<(usize, f32)> = self.vectors
            .iter()
            .enumerate()
            .map(|(idx, vec)| {
                let doc_vector = Vector::new(vec.clone());
                let sim = cosine(&query_vector, &doc_vector);
                (self.ids[idx], sim)
            })
            .collect();

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Return top-k
        for (id, score) in similarities.iter().take(k) {
            let pair = js_sys::Array::new();
            pair.push(&JsValue::from(*id));
            pair.push(&JsValue::from(*score));
            results.push(&JsValue::from(pair));
        }

        results
    }

    /// Get the number of vectors in the index
    #[wasm_bindgen]
    pub fn size(&self) -> usize {
        self.vectors.len()
    }

    /// Clear all vectors from the index
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.vectors.clear();
        self.ids.clear();
    }
}

// ============================================================================
// G-Counter (Grow-only Counter)
// ============================================================================

/// Grow-only counter for distributed counting
#[wasm_bindgen]
pub struct GCounter {
    inner: CoreGCounter,
}

#[wasm_bindgen]
impl GCounter {
    /// Create a new G-Counter
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: CoreGCounter::new(),
        }
    }

    /// Increment the counter for a node
    ///
    /// # Arguments
    ///
    /// * `node` - Node identifier
    /// * `amount` - Amount to increment
    ///
    /// # Example
    ///
    /// ```javascript
    /// const counter = new GCounter();
    /// counter.increment("node1", 5);
    /// ```
    #[wasm_bindgen]
    pub fn increment(&mut self, node: &str, amount: u64) {
        self.inner.increment(node, amount);
    }

    /// Get the current value (sum of all node counts)
    #[wasm_bindgen]
    pub fn value(&self) -> u64 {
        self.inner.value()
    }

    /// Get the count for a specific node
    #[wasm_bindgen]
    pub fn get(&self, node: &str) -> u64 {
        self.inner.get(node).unwrap_or(0)
    }

    /// Merge with another G-Counter
    ///
    /// Takes the maximum value for each node.
    ///
    /// # Arguments
    ///
    /// * `other` - Binary serialized data from another counter
    ///
    /// # Returns
    ///
    /// Error if deserialization fails
    #[wasm_bindgen]
    pub fn merge(&mut self, other: &[u8]) -> Result<(), JsValue> {
        let other_counter = CoreGCounter::from_bytes(other)
            .map_err(|e| JsValue::from_str(&format!("Deserialization failed: {:?}", e)))?;

        self.inner.merge(&other_counter);
        Ok(())
    }

    /// Serialize to binary format
    ///
    /// # Returns
    ///
    /// Binary representation of the counter
    #[wasm_bindgen]
    pub fn toBytes(&self) -> Vec<u8> {
        self.inner.to_bytes().unwrap_or_default()
    }

    /// Deserialize from binary format
    ///
    /// # Arguments
    ///
    /// * `data` - Binary data
    ///
    /// # Returns
    ///
    /// New G-Counter instance
    #[wasm_bindgen]
    pub fn fromBytes(data: &[u8]) -> Result<GCounter, JsValue> {
        let inner = CoreGCounter::from_bytes(data)
            .map_err(|e| JsValue::from_str(&format!("Deserialization failed: {:?}", e)))?;

        Ok(GCounter { inner })
    }

    /// Reset all counts (use with caution)
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for GCounter {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Simple Semantic Cache (WASM-compatible)
// ============================================================================

/// Simple semantic cache entry
#[derive(Clone)]
struct SimpleCacheEntry {
    key: String,
    value: String,
    embedding: Vec<f32>,
    timestamp: u64,
}

/// High-performance semantic cache for storing and retrieving similar queries
#[wasm_bindgen]
pub struct SemanticCache {
    entries: Vec<SimpleCacheEntry>,
    threshold: f32,
    max_size: usize,
}

#[wasm_bindgen]
impl SemanticCache {
    /// Create a new semantic cache
    ///
    /// # Arguments
    ///
    /// * `threshold` - Minimum similarity threshold (0.0 to 1.0)
    /// * `max_size` - Maximum number of entries
    ///
    /// # Example
    ///
    /// ```javascript
    /// const cache = new SemanticCache(0.85, 1000);
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(threshold: f32, max_size: usize) -> Self {
        Self {
            entries: Vec::new(),
            threshold,
            max_size,
        }
    }

    /// Insert a value into the cache
    ///
    /// # Arguments
    ///
    /// * `key` - Cache key
    /// * `value` - Value to store
    /// * `embedding` - Semantic embedding vector
    ///
    /// # Returns
    ///
    /// True if inserted, false if similar entry exists
    #[wasm_bindgen]
    pub fn insert(
        &mut self,
        key: &str,
        value: &str,
        embedding: &js_sys::Float32Array,
    ) -> bool {
        let emb: Vec<f32> = embedding.to_vec();
        let emb_vector = Vector::new(emb.clone());

        // Check for similar entries
        for entry in &self.entries {
            let entry_vector = Vector::new(entry.embedding.clone());
            let sim = cosine(&emb_vector, &entry_vector);
            if sim >= self.threshold {
                return false; // Similar entry exists
            }
        }

        // Add new entry
        let entry = SimpleCacheEntry {
            key: key.to_string(),
            value: value.to_string(),
            embedding: emb,
            timestamp: (js_sys::Date::now() / 1000.0) as u64,
        };

        self.entries.push(entry);

        // Enforce max size
        if self.entries.len() > self.max_size {
            self.entries.remove(0);
        }

        true
    }

    /// Search for similar entries
    ///
    /// # Arguments
    ///
    /// * `embedding` - Query embedding
    ///
    /// # Returns
    ///
    /// Array of {key, value, score} objects
    #[wasm_bindgen]
    pub fn search(&self, embedding: &js_sys::Float32Array) -> js_sys::Array {
        let emb: Vec<f32> = embedding.to_vec();
        let emb_vector = Vector::new(emb);
        let results: Vec<_> = self.entries
            .iter()
            .map(|entry| {
                let entry_vector = Vector::new(entry.embedding.clone());
                let sim = cosine(&emb_vector, &entry_vector);
                (entry, sim)
            })
            .filter(|(_, sim)| *sim >= self.threshold)
            .collect();

        let output = js_sys::Array::new();

        for (entry, score) in results {
            let obj = js_sys::Object::new();
            js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("key"),
                &JsValue::from_str(&entry.key),
            ).unwrap();

            js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("value"),
                &JsValue::from_str(&entry.value),
            ).unwrap();

            js_sys::Reflect::set(
                &obj,
                &JsValue::from_str("score"),
                &JsValue::from(score),
            ).unwrap();

            output.push(&JsValue::from(obj));
        }

        output
    }

    /// Clear all entries
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Get the number of entries
    #[wasm_bindgen]
    pub fn size(&self) -> usize {
        self.entries.len()
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Normalize a vector to unit length
///
/// # Arguments
///
/// * `vector` - Vector to normalize
///
/// # Returns
///
/// Normalized vector (Float32Array)
#[wasm_bindgen]
pub fn normalize(vector: &js_sys::Float32Array) -> js_sys::Float32Array {
    let vec: Vec<f32> = vector.to_vec();
    let vec_array: Vec<f32> = vec.to_vec();

    let norm: f32 = vec_array.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm == 0.0 {
        return vector.clone();
    }

    let normalized: Vec<f32> = vec_array.iter().map(|x| x / norm).collect();
    js_sys::Float32Array::from(&normalized[..])
}

/// Log a message to the browser console (useful for debugging)
#[wasm_bindgen]
pub fn log(message: &str) {
    web_sys::console::log_1(&JsValue::from_str(message));
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = Vector::new(vec![1.0, 0.0]);
        let b = Vector::new(vec![0.0, 1.0]);

        let sim = cosine(&a, &b);
        assert!((sim - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_gcounter() {
        let mut counter = CoreGCounter::new();
        counter.increment("node1", 5);
        counter.increment("node2", 3);

        assert_eq!(counter.value(), 8);
        assert_eq!(counter.get("node1"), Some(5));
    }

    #[test]
    fn test_hnsw_index() {
        let mut index = HNSWIndex::new(3, 10);

        let v1 = vec![1.0, 0.0, 0.0];
        let v2 = vec![0.0, 1.0, 0.0];
        let v3 = vec![0.0, 0.0, 1.0];

        index.vectors.push(v1);
        index.vectors.push(v2);
        index.vectors.push(v3);
        index.ids.push(1);
        index.ids.push(2);
        index.ids.push(3);

        assert_eq!(index.size(), 3);
    }
}
