//! # SuperInstance Python Bindings
//!
//! High-performance Python bindings for SuperInstance native modules using PyO3.
//!
//! ## Modules
//!
//! - **embeddings**: Vector operations, similarity search, semantic caching
//! - **crdt**: Conflict-free replicated data types
//! - **crypto**: Cryptographic primitives
//!
//! ## Example
//!
//! ```python
//! import superinstance as si
//!
//! # Calculate cosine similarity
//! similarity = si.cosine_similarity([1.0, 0.0], [1.0, 0.0])
//!
//! # Use semantic cache
//! cache = si.SemanticCache(threshold=0.85)
//! cache.set("key", "query", [0.1, 0.2, 0.3], {"result": "value"})
//! result = cache.get("key", [0.1, 0.2, 0.3])
//! ```

use pyo3::prelude::*;
use pyo3::exceptions::PyValueError;
use pyo3::types::PyBytes;
use std::collections::HashMap;

// ============================================================================
// Embeddings Module
// ============================================================================

/// Calculate cosine similarity between two vectors
#[pyfunction]
fn cosine_similarity(a: Vec<f32>, b: Vec<f32>) -> PyResult<f32> {
    if a.len() != b.len() {
        return Err(PyValueError::new_err(
            "Vectors must have the same dimension"
        ));
    }

    use superinstance_native_embeddings::cosine;
    use superinstance_native_core::Vector;

    let v1 = Vector::new(a);
    let v2 = Vector::new(b);

    v1.cosine_similarity(&v2)
        .ok_or_else(|| PyValueError::new_err("Failed to calculate cosine similarity"))
}

/// Calculate Euclidean distance between two vectors
#[pyfunction]
fn euclidean_distance(a: Vec<f32>, b: Vec<f32>) -> PyResult<f32> {
    if a.len() != b.len() {
        return Err(PyValueError::new_err(
            "Vectors must have the same dimension"
        ));
    }

    use superinstance_native_embeddings::euclidean;
    Ok(euclidean(&a, &b))
}

/// Calculate dot product of two vectors
#[pyfunction]
fn dot_product(a: Vec<f32>, b: Vec<f32>) -> PyResult<f32> {
    if a.len() != b.len() {
        return Err(PyValueError::new_err(
            "Vectors must have the same dimension"
        ));
    }

    use superinstance_native_core::Vector;

    let v1 = Vector::new(a);
    let v2 = Vector::new(b);

    v1.dot()
        .ok_or_else(|| PyValueError::new_err("Failed to calculate dot product"))
}

/// Calculate batch similarities between query and multiple documents
#[pyfunction]
fn batch_similarity(query: Vec<f32>, documents: Vec<Vec<f32>>) -> PyResult<Vec<f32>> {
    use superinstance_native_core::Vector;

    let q = Vector::new(query);
    let docs: Vec<Vector> = documents.into_iter().map(Vector::new).collect();

    let results: Result<Vec<_>, _> = docs
        .iter()
        .map(|doc| {
            q.cosine_similarity(doc)
                .ok_or_else(|| PyValueError::new_err("Failed to calculate similarity"))
        })
        .collect();

    results
}

/// High-performance semantic cache for AI responses
#[pyclass]
pub struct PySemanticCache {
    inner: superinstance_native_embeddings::cache::SemanticCache,
}

#[pymethods]
impl PySemanticCache {
    /// Create a new semantic cache
    ///
    /// Args:
    ///     max_size: Maximum number of entries (default: 1000)
    ///     threshold: Similarity threshold for cache hits (default: 0.85)
    ///     ttl_ms: Time-to-live in milliseconds (default: 3600000 = 1 hour)
    ///     num_threads: Number of threads for parallel processing (default: 0 = auto)
    #[new]
    #[pyo3(signature = (max_size=1000, threshold=0.85, ttl_ms=3600000, num_threads=0))]
    fn new(
        max_size: usize,
        threshold: f32,
        ttl_ms: Option<u64>,
        num_threads: usize,
    ) -> Self {
        let config = superinstance_native_embeddings::cache::CacheConfig {
            max_size,
            similarity_threshold: threshold,
            ttl_ms,
            num_threads,
        };

        Self {
            inner: superinstance_native_embeddings::cache::SemanticCache::new(config),
        }
    }

    /// Get entry from cache with semantic similarity search
    ///
    /// Args:
    ///     key: Exact cache key to check first
    ///     query_embedding: Query embedding for similarity search
    ///
    /// Returns:
    ///     Dictionary with keys: key, query, similarity, result (or None if not found)
    fn get(&self, key: String, query_embedding: Vec<f32>) -> PyResult<Option<PyObject>> {
        Python::with_gil(|py| {
            if let Some(hit) = self.inner.get(&key, &query_embedding) {
                let result = pyo3::types::PyDict::new(py);
                result.set_item("key", hit.key)?;
                result.set_item("query", hit.query)?;
                result.set_item("similarity", hit.similarity)?;

                // Convert JSON result to Python dict
                let json_str = serde_json::to_string(&hit.result)
                    .map_err(|e| PyValueError::new_err(format!("Failed to serialize result: {}", e)))?;
                let py_result: PyObject = pyo3::types::PyModule::import(py, "json")?
                    .getattr("loads")?
                    .call1((json_str,))?;
                result.set_item("result", py_result)?;

                Ok(Some(result.into()))
            } else {
                Ok(None)
            }
        })
    }

    /// Set entry in cache
    ///
    /// Args:
    ///     key: Cache key
    ///     query: Query text
    ///     embedding: Query embedding vector
    ///     result: Result to cache (will be converted to JSON)
    fn set(&self, key: String, query: String, embedding: Vec<f32>, result: PyObject) -> PyResult<()> {
        Python::with_gil(|py| {
            // Convert Python object to JSON
            let json_str = pyo3::types::PyModule::import(py, "json")?
                .getattr("dumps")?
                .call1((result,))?
                .extract()?;

            let json_value: serde_json::Value = serde_json::from_str(&json_str)
                .map_err(|e| PyValueError::new_err(format!("Failed to deserialize result: {}", e)))?;

            let vector = superinstance_native_core::Vector::new(embedding);
            self.inner.set(key, query, vector, json_value);
            Ok(())
        })
    }

    /// Find similar entries
    ///
    /// Args:
    ///     query_embedding: Query embedding vector
    ///     threshold: Minimum similarity threshold
    ///
    /// Returns:
    ///     List of dicts with keys: key, query, similarity
    fn find_similar(&self, query_embedding: Vec<f32>, threshold: f32) -> PyResult<Vec<PyObject>> {
        Python::with_gil(|py| {
            let results = self.inner.find_similar(&query_embedding, threshold);

            results
                .into_iter()
                .map(|r| {
                    let dict = pyo3::types::PyDict::new(py);
                    dict.set_item("key", r.key)?;
                    dict.set_item("query", r.query)?;
                    dict.set_item("similarity", r.similarity)?;
                    Ok(dict.into())
                })
                .collect()
        })
    }

    /// Clear all cache entries
    fn clear(&self) {
        self.inner.clear();
    }

    /// Get current cache size
    fn size(&self) -> usize {
        self.inner.size()
    }

    /// Check if key exists in cache
    fn has(&self, key: String) -> bool {
        self.inner.has(&key)
    }

    /// Delete specific entry
    fn delete(&self, key: String) -> bool {
        self.inner.delete(&key)
    }

    /// Get all cache keys
    fn keys(&self) -> Vec<String> {
        self.inner.keys()
    }

    /// Get cache statistics
    fn stats(&self) -> HashMap<String, PyObject> {
        Python::with_gil(|py| {
            let mut stats = HashMap::new();
            stats.insert("size".to_string(), self.inner.size().into_py(py));
            stats.insert("max_size".to_string(), 1000.into_py(py)); // TODO: get from config
            stats
        })
    }
}

// ============================================================================
// CRDT Module
// ============================================================================

/// Grow-only counter (G-Counter)
#[pyclass]
pub struct PyGCounter {
    inner: superinstance_native_crdt::GCounter,
}

#[pymethods]
impl PyGCounter {
    /// Create a new G-Counter
    #[new]
    fn new() -> Self {
        Self {
            inner: superinstance_native_crdt::GCounter::new(),
        }
    }

    /// Increment the counter for a node
    ///
    /// Args:
    ///     node: Node identifier
    ///     amount: Amount to increment (default: 1)
    fn increment(&mut self, node: String, amount: Option<u64>) {
        self.inner.increment(&node, amount.unwrap_or(1));
    }

    /// Get the current value
    fn value(&self) -> u64 {
        self.inner.value()
    }

    /// Get the count for a specific node
    fn get(&self, node: String) -> Option<u64> {
        self.inner.get(&node)
    }

    /// Merge with another G-Counter
    ///
    /// Args:
    ///     other: Another G-Counter to merge with
    fn merge(&mut self, other: &PyGCounter) {
        self.inner.merge(&other.inner);
    }

    /// Get all node counts
    fn counts(&self) -> HashMap<String, u64> {
        self.inner.counts().clone()
    }

    /// Reset all counts (use with caution)
    fn reset(&mut self) {
        self.inner.reset();
    }

    /// Serialize to binary format
    fn to_bytes(&self) -> PyResult<PyObject> {
        Python::with_gil(|py| {
            let bytes = self.inner.to_bytes()
                .map_err(|e| PyValueError::new_err(format!("Failed to serialize: {}", e)))?;
            Ok(PyBytes::new(py, &bytes).into())
        })
    }

    /// Deserialize from binary format
    #[staticmethod]
    fn from_bytes(data: &[u8]) -> PyResult<PyGCounter> {
        let inner = superinstance_native_crdt::GCounter::from_bytes(data)
            .map_err(|e| PyValueError::new_err(format!("Failed to deserialize: {}", e)))?;
        Ok(PyGCounter { inner })
    }

    /// Get serialized size estimate
    fn serialized_size(&self) -> usize {
        self.inner.serialized_size()
    }

    /// String representation
    fn __repr__(&self) -> String {
        format!("PyGCounter(value={})", self.inner.value())
    }
}

/// PN-Counter (supports increments and decrements)
#[pyclass]
pub struct PyPNCounter {
    inner: superinstance_native_crdt::PNCounter,
}

#[pymethods]
impl PyPNCounter {
    /// Create a new PN-Counter
    #[new]
    fn new() -> Self {
        Self {
            inner: superinstance_native_crdt::PNCounter::new(),
        }
    }

    /// Increment the counter for a node
    fn increment(&mut self, node: String, amount: Option<u64>) {
        self.inner.increment(&node, amount.unwrap_or(1));
    }

    /// Decrement the counter for a node
    fn decrement(&mut self, node: String, amount: Option<u64>) {
        self.inner.decrement(&node, amount.unwrap_or(1));
    }

    /// Get the current value
    fn value(&self) -> i64 {
        self.inner.value()
    }

    /// Merge with another PN-Counter
    fn merge(&mut self, other: &PyPNCounter) {
        self.inner.merge(&other.inner);
    }

    fn __repr__(&self) -> String {
        format!("PyPNCounter(value={})", self.inner.value())
    }
}

/// Last-write-wins register
#[pyclass]
pub struct PyLWWRegister {
    inner: superinstance_native_crdt::LWWRegister<String>,
}

#[pymethods]
impl PyLWWRegister {
    /// Create a new LWW register with initial value
    #[new]
    fn new(initial_value: String) -> Self {
        Self {
            inner: superinstance_native_crdt::LWWRegister::new(initial_value),
        }
    }

    /// Set the value
    fn set(&mut self, value: String) {
        self.inner.set(value);
    }

    /// Get the current value
    fn get(&self) -> String {
        self.inner.get()
    }

    /// Merge with another register
    fn merge(&mut self, other: &PyLWWRegister) {
        self.inner.merge(&other.inner);
    }

    fn __repr__(&self) -> String {
        format!("PyLWWRegister(value={})", self.inner.get())
    }
}

/// Observed-remove set (OR-Set)
#[pyclass]
pub struct PyORSet {
    inner: superinstance_native_crdt::ORSet<String>,
}

#[pymethods]
impl PyORSet {
    /// Create a new OR-Set
    #[new]
    fn new() -> Self {
        Self {
            inner: superinstance_native_crdt::ORSet::new(),
        }
    }

    /// Add an element to the set
    fn add(&mut self, element: String, node: String) {
        self.inner.add(element, &node);
    }

    /// Remove an element from the set
    fn remove(&mut self, element: String) {
        self.inner.remove(&element);
    }

    /// Check if element is in the set
    fn contains(&self, element: String) -> bool {
        self.inner.contains(&element)
    }

    /// Get all elements
    fn elements(&self) -> Vec<String> {
        self.inner.elements()
    }

    /// Get the size of the set
    fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if set is empty
    fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Merge with another set
    fn merge(&mut self, other: &PyORSet) {
        self.inner.merge(&other.inner);
    }

    /// Convert to Python set
    fn to_pyset(&self, py: Python) -> PyObject {
        let elements = self.inner.elements();
        let set = pyo3::types::PySet::new(py, &elements).unwrap();
        set.into()
    }

    fn __repr__(&self) -> String {
        format!("PyORSet(size={})", self.inner.len())
    }
}

// ============================================================================
// Crypto Module
// ============================================================================

/// Hash algorithms
#[pyclass]
#[derive(Clone, Copy)]
pub enum HashAlgorithm {
    BLAKE3,
    SHA256,
}

/// Calculate hash of data
#[pyfunction]
fn hash(data: Vec<u8>, algorithm: HashAlgorithm) -> PyResult<Vec<u8>> {
    use superinstance_native_crypto::{HashAlgorithm as CryptoHashAlgo, hash};

    let algo = match algorithm {
        HashAlgorithm::BLAKE3 => CryptoHashAlgo::BLAKE3,
        HashAlgorithm::SHA256 => CryptoHashAlgo::SHA256,
    };

    hash(&data, algo).map_err(|e| PyValueError::new_err(format!("Hash failed: {}", e)))
}

/// Calculate BLAKE3 hash (fastest)
#[pyfunction]
fn hash_blake3(data: Vec<u8>) -> Vec<u8> {
    use superinstance_native_crypto::hash_blake3;
    hash_blake3(&data)
}

/// Calculate SHA256 hash
#[pyfunction]
fn hash_sha256(data: Vec<u8>) -> Vec<u8> {
    use superinstance_native_crypto::hash_sha256;
    hash_sha256(&data)
}

/// Encrypt data using ChaCha20-Poly1305
#[pyfunction]
fn encrypt(plaintext: Vec<u8>, key: Vec<u8>, nonce: Vec<u8>) -> PyResult<Vec<u8>> {
    use superinstance_native_crypto::encrypt;

    if key.len() != 32 {
        return Err(PyValueError::new_err("Key must be 32 bytes"));
    }

    if nonce.len() != 12 {
        return Err(PyValueError::new_err("Nonce must be 12 bytes"));
    }

    encrypt(&plaintext, &key.try_into().unwrap(), &nonce.try_into().unwrap())
        .map_err(|e| PyValueError::new_err(format!("Encryption failed: {}", e)))
}

/// Decrypt data using ChaCha20-Poly1305
#[pyfunction]
fn decrypt(ciphertext: Vec<u8>, key: Vec<u8>, nonce: Vec<u8>) -> PyResult<Vec<u8>> {
    use superinstance_native_crypto::decrypt;

    if key.len() != 32 {
        return Err(PyValueError::new_err("Key must be 32 bytes"));
    }

    if nonce.len() != 12 {
        return Err(PyValueError::new_err("Nonce must be 12 bytes"));
    }

    decrypt(&ciphertext, &key.try_into().unwrap(), &nonce.try_into().unwrap())
        .map_err(|e| PyValueError::new_err(format!("Decryption failed: {}", e)))
}

/// Derive a key from password using Argon2
#[pyfunction]
fn derive_key(password: Vec<u8>, salt: Vec<u8>, length: usize) -> PyResult<Vec<u8>> {
    use superinstance_native_crypto::derive_key;

    if length < 16 || length > 64 {
        return Err(PyValueError::new_err("Key length must be between 16 and 64 bytes"));
    }

    derive_key(&password, &salt, length)
        .map_err(|e| PyValueError::new_err(format!("Key derivation failed: {}", e)))
}

/// Generate cryptographically secure random bytes
#[pyfunction]
fn secure_random(length: usize) -> Vec<u8> {
    use superinstance_native_crypto::secure_random;
    secure_random(length)
}

// ============================================================================
// Module Definition
// ============================================================================

/// SuperInstance native modules - Python bindings
#[pymodule]
fn superinstance(_py: Python, m: &PyModule) -> PyResult<()> {
    // Embeddings module
    m.add_function(wrap_pyfunction!(cosine_similarity, m)?)?;
    m.add_function(wrap_pyfunction!(euclidean_distance, m)?)?;
    m.add_function(wrap_pyfunction!(dot_product, m)?)?;
    m.add_function(wrap_pyfunction!(batch_similarity, m)?)?;
    m.add_class::<PySemanticCache>()?;

    // CRDT module
    m.add_class::<PyGCounter>()?;
    m.add_class::<PyPNCounter>()?;
    m.add_class::<PyLWWRegister>()?;
    m.add_class::<PyORSet>()?;

    // Crypto module
    m.add_class::<HashAlgorithm>()?;
    m.add_function(wrap_pyfunction!(hash, m)?)?;
    m.add_function(wrap_pyfunction!(hash_blake3, m)?)?;
    m.add_function(wrap_pyfunction!(hash_sha256, m)?)?;
    m.add_function(wrap_pyfunction!(encrypt, m)?)?;
    m.add_function(wrap_pyfunction!(decrypt, m)?)?;
    m.add_function(wrap_pyfunction!(derive_key, m)?)?;
    m.add_function(wrap_pyfunction!(secure_random, m)?)?;

    // Module metadata
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;

    Ok(())
}
