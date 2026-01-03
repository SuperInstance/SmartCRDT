//! Common test helpers and utilities for integration tests
//!
//! This module provides reusable test infrastructure including:
//! - Temporary directory management
//! - Test data generators
//! - Async test utilities
//! - Assertion helpers
//! - Mock implementations

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tempfile::TempDir;
use tokio::time::timeout;
use uuid::Uuid;

/// Test configuration constants
pub mod config {
    /// Default timeout for async operations in tests
    pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

    /// Timeout for network operations
    pub const NETWORK_TIMEOUT: Duration = Duration::from_secs(10);

    /// Timeout for I/O operations
    pub const IO_TIMEOUT: Duration = Duration::from_secs(5);

    /// Number of events for stress tests
    pub const STRESS_EVENT_COUNT: usize = 10_000;

    /// Number of concurrent producers for concurrency tests
    pub const CONCURRENT_PRODUCERS: usize = 8;

    /// Test ring buffer size (small for tests)
    pub const TEST_RING_SIZE: usize = 1024 * 1024; // 1MB

    /// Test cluster size for multi-node tests
    pub const TEST_CLUSTER_SIZE: usize = 3;

    /// Port range for test QUIC endpoints
    pub const TEST_PORT_START: u16 = 15000;
    pub const TEST_PORT_END: u16 = 16000;
}

/// Temporary test environment with automatic cleanup
pub struct TestEnvironment {
    /// Temporary directory for test files
    pub temp_dir: TempDir,

    /// Base path for all test artifacts
    pub base_path: PathBuf,

    /// Unique test ID
    pub test_id: String,
}

impl TestEnvironment {
    /// Create a new test environment with a unique ID
    pub fn new(test_name: &str) -> Self {
        let test_id = format!("{}-{}", test_name, Uuid::new_v4());
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let base_path = temp_dir.path().join(&test_id);

        std::fs::create_dir_all(&base_path).expect("Failed to create base path");

        Self {
            temp_dir,
            base_path,
            test_id,
        }
    }

    /// Get path for a test artifact
    pub fn artifact_path(&self, name: &str) -> PathBuf {
        self.base_path.join(name)
    }

    /// Create a subdirectory for organized testing
    pub fn create_subdir(&self, name: &str) -> PathBuf {
        let path = self.artifact_path(name);
        std::fs::create_dir_all(&path).expect("Failed to create subdir");
        path
    }

    /// Get the base path
    pub fn path(&self) -> &Path {
        &self.base_path
    }
}

/// Generator for test vectors and embeddings
pub mod generators {
    use rand::Rng;

    /// Generate a random 384-dimensional vector (embedding size)
    pub fn random_embedding() -> [f32; 384] {
        let mut rng = rand::thread_rng();
        let mut vec = [0.0f32; 384];
        for v in vec.iter_mut() {
            *v = rng.gen::<f32>() * 2.0 - 1.0;
        }
        vec
    }

    /// Generate a normalized 384-dimensional vector
    pub fn normalized_embedding() -> [f32; 384] {
        let mut vec = random_embedding();
        let norm: f32 = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
        if norm > 0.0 {
            for v in vec.iter_mut() {
                *v /= norm;
            }
        }
        vec
    }

    /// Generate multiple embeddings with semantic similarity
    pub fn similar_embeddings(base: &[f32; 384], count: usize, similarity: f32) -> Vec<[f32; 384]> {
        let mut results = Vec::with_capacity(count);
        for _ in 0..count {
            let mut emb = *base;
            // Add noise proportional to (1 - similarity)
            let noise_scale = (1.0 - similarity).sqrt();
            for v in emb.iter_mut() {
                *v += (rand::random::<f32>() * 2.0 - 1.0) * noise_scale;
            }
            // Renormalize
            let norm: f32 = emb.iter().map(|v| v * v).sum::<f32>().sqrt();
            if norm > 0.0 {
                for v in emb.iter_mut() {
                    *v /= norm;
                }
            }
            results.push(emb);
        }
        results
    }

    /// Generate test temporal atoms
    pub struct TemporalAtomGenerator {
        next_id: u64,
    }

    impl TemporalAtomGenerator {
        pub fn new() -> Self {
            Self { next_id: 1 }
        }

        /// Generate a test atom with modality and data
        pub fn generate(&mut self, modality: u8, data: &[u8]) -> (u64, Vec<u8>) {
            let id = self.next_id;
            self.next_id += 1;
            (id, data.to_vec())
        }

        /// Generate a batch of atoms
        pub fn generate_batch(&mut self, count: usize, modality_range: std::ops::Range<u8>) -> Vec<(u64, u8, Vec<u8>)> {
            let mut batch = Vec::with_capacity(count);
            for _ in 0..count {
                let modality = rand::random::<u8>() % (modality_range.end - modality_range.start) + modality_range.start;
                let data_len = rand::random::<usize>() % 48 + 1;
                let data: Vec<u8> = (0..data_len).map(|_| rand::random()).collect();
                batch.push((self.next_id, modality, data));
                self.next_id += 1;
            }
            batch
        }
    }

    impl Default for TemporalAtomGenerator {
        fn default() -> Self {
            Self::new()
        }
    }
}

/// Async test utilities
pub mod async_utils {
    use super::config::DEFAULT_TIMEOUT;
    use tokio::time::timeout;
    use std::time::Duration;

    /// Poll a condition until it becomes true or timeout expires
    pub async fn poll_until<F, Fut>(condition: F, timeout_duration: Duration) -> Result<(), String>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = bool>,
    {
        let start = std::time::Instant::now();
        let mut interval = tokio::time::interval(Duration::from_millis(50));

        while start.elapsed() < timeout_duration {
            interval.tick().await;
            if condition().await {
                return Ok(());
            }
        }

        Err(format!("Condition not met within {:?}", timeout_duration))
    }

    /// Retry an async operation with exponential backoff
    pub async fn retry_async<F, Fut, T, E>(
        mut operation: F,
        max_retries: usize,
        initial_delay: Duration,
    ) -> Result<T, E>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
    {
        let mut delay = initial_delay;

        for attempt in 0..max_retries {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) if attempt < max_retries - 1 => {
                    tokio::time::sleep(delay).await;
                    delay *= 2;
                }
                Err(e) => return Err(e),
            }
        }

        unreachable!()
    }

    /// Run a future with a timeout
    pub async fn with_timeout<F, T>(future: F, duration: Duration) -> Result<T, String>
    where
        F: std::future::Future<Output = T>,
    {
        timeout(duration, future)
            .await
            .map_err(|_| format!("Operation timed out after {:?}", duration))
    }
}

/// Assertion helpers for integration tests
pub mod assertions {
    use std::fmt::Debug;

    /// Assert that two values are approximately equal within tolerance
    pub fn assert_approx_eq<T>(a: T, b: T, tolerance: T)
    where
        T: std::ops::Sub<Output = T> + PartialOrd + Debug + Copy,
    {
        let diff = if a > b { a - b } else { b - a };
        assert!(
            diff <= tolerance,
            "Values not approximately equal: {:?} vs {:?} (tolerance {:?})",
            a,
            b,
            tolerance
        );
    }

    /// Assert that a vector is monotonically increasing
    pub fn assert_monotonic_increasing<T>(values: &[T])
    where
        T: PartialOrd + Debug + Copy,
    {
        for window in values.windows(2) {
            assert!(
                window[0] <= window[1],
                "Not monotonically increasing: {:?} > {:?}",
                window[0],
                window[1]
            );
        }
    }

    /// Assert that all elements in a collection satisfy a predicate
    pub fn assert_all<P, T>(items: &[T], predicate: P)
    where
        P: Fn(&T) -> bool,
        T: Debug,
    {
        for (i, item) in items.iter().enumerate() {
            assert!(
                predicate(item),
                "Predicate failed at index {}: {:?}",
                i,
                item
            );
        }
    }

    /// Assert that a condition holds for a percentage of elements
    pub fn assert_percentage<P>(items: &[usize], predicate: P, min_percentage: f64)
    where
        P: Fn(&usize) -> bool,
    {
        let passing = items.iter().filter(|x| predicate(x)).count();
        let percentage = (passing as f64 / items.len() as f64) * 100.0;
        assert!(
            percentage >= min_percentage,
            "Only {:.1}% passed, required at least {:.1}%",
            percentage,
            min_percentage
        );
    }
}

/// Performance measurement utilities
pub mod benchmark {
    use std::time::{Duration, Instant};

    /// Measure execution time of a closure
    pub fn measure<F, R>(f: F) -> (R, Duration)
    where
        F: FnOnce() -> R,
    {
        let start = Instant::now();
        let result = f();
        let elapsed = start.elapsed();
        (result, elapsed)
    }

    /// Measure throughput (operations per second)
    pub fn measure_throughput<F>(count: usize, operation: F) -> f64
    where
        F: FnMut(usize),
    {
        let start = Instant::now();
        for i in 0..count {
            operation(i);
        }
        let elapsed = start.elapsed().as_secs_f64();
        count as f64 / elapsed
    }

    /// Statistics for multiple measurements
    #[derive(Debug, Clone)]
    pub struct Stats {
        pub count: usize,
        pub min: Duration,
        pub max: Duration,
        pub mean: Duration,
        pub median: Duration,
        pub p95: Duration,
        pub p99: Duration,
    }

    /// Compute statistics from a list of durations
    pub fn compute_stats(mut measurements: Vec<Duration>) -> Stats {
        measurements.sort();
        let count = measurements.len();
        let min = measurements.first().copied().unwrap_or(Duration::ZERO);
        let max = measurements.last().copied().unwrap_or(Duration::ZERO);
        let sum: Duration = measurements.iter().sum();
        let mean = sum / count as u32;

        let median = measurements[count / 2];
        let p95 = measurements[(count * 95) / 100];
        let p99 = measurements[(count * 99) / 100];

        Stats {
            count,
            min,
            max,
            mean,
            median,
            p95,
            p99,
        }
    }
}

/// Concurrency test utilities
pub mod concurrency {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Run multiple concurrent operations
    pub async fn run_concurrent<F, Fut>(count: usize, mut operation: F) -> Vec<tokio::task::JoinHandle<()>>
    where
        F: FnMut(usize) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let mut handles = Vec::with_capacity(count);

        for i in 0..count {
            let handle = tokio::spawn(operation(i));
            handles.push(handle);
        }

        handles
    }

    /// Coordinate concurrent operations with a barrier
    pub struct ConcurrentBarrier {
        counter: Arc<AtomicUsize>,
        total: usize,
        notify: Arc<tokio::sync::Notify>,
    }

    impl ConcurrentBarrier {
        pub fn new(total: usize) -> Self {
            Self {
                counter: Arc::new(AtomicUsize::new(0)),
                total,
                notify: Arc::new(tokio::sync::Notify::new()),
            }
        }

        /// Wait for all participants to reach the barrier
        pub async fn wait(&self) {
            let count = self.counter.fetch_add(1, Ordering::SeqCst) + 1;
            if count == self.total {
                self.notify.notify_waiters();
            } else {
                self.notify.notified().await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_test_environment() {
        let env = TestEnvironment::new("test-env");
        assert!(env.base_path.exists());
        assert!(env.artifact_path("test.txt").parent().unwrap().exists());
    }

    #[test]
    fn test_random_embedding() {
        let emb1 = generators::random_embedding();
        let emb2 = generators::random_embedding();
        assert_ne!(emb1, emb2);
    }

    #[test]
    fn test_normalized_embedding() {
        let emb = generators::normalized_embedding();
        let norm: f32 = emb.iter().map(|v| v * v).sum::<f32>().sqrt();
        assert_approx_eq(norm, 1.0, 1e-6);
    }

    #[test]
    fn test_similar_embeddings() {
        let base = generators::normalized_embedding();
        let similar = generators::similar_embeddings(&base, 5, 0.9);
        assert_eq!(similar.len(), 5);
    }

    #[test]
    fn test_assert_approx_eq() {
        assertions::assert_approx_eq(1.0f32, 1.001f32, 0.01);
    }

    #[test]
    fn test_assert_monotonic_increasing() {
        let values = vec![1, 2, 3, 4, 5];
        assertions::assert_monotonic_increasing(&values);
    }

    #[tokio::test]
    async fn test_poll_until() {
        let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter_clone = counter.clone();

        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        async_utils::poll_until(
            || async { counter.load(Ordering::SeqCst) > 0 },
            Duration::from_secs(1),
        )
        .await
        .unwrap();
    }
}
