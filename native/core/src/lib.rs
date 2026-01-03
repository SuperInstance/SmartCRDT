//! # SuperInstance Native Core
//!
//! Core utilities, error types, and common functionality for SuperInstance native modules.
//!
//! ## Design Principles
//!
//! - **Zero-copy**: Prefer references over cloning where possible
//! - **Memory safety**: Leverage Rust's type system for safety guarantees
//! - **Error handling**: Comprehensive error types with context
//! - **Cross-platform**: Support Linux, macOS, Windows, and ARM64

pub mod error;
pub mod result;
pub mod types;
pub mod memory;
pub mod time;

// Re-exports for convenience
pub use error::{CoreError, CoreResult};
pub use result::FFIResult;
pub use types::{Vector, Embedding, Similarity};
pub use memory::{SafeArray, SecureBuffer};
pub use time::{Timestamp, Duration};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = CoreError::InvalidInput("test".to_string());
        assert!(matches!(err, CoreError::InvalidInput(_)));
    }

    #[test]
    fn test_result_conversion() {
        let result: CoreResult<i32> = Ok(42);
        assert!(result.is_ok());
    }
}
