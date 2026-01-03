//! # Core Error Types
//!
//! Comprehensive error handling for all native modules.

use std::fmt;

/// Core result type for all native operations
pub type CoreResult<T> = Result<T, CoreError>;

/// Main error type for SuperInstance native modules
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    /// Invalid input provided
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Operation not supported
    #[error("Operation not supported: {0}")]
    NotSupported(String),

    /// I/O error occurred
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Vector operation error (for embeddings)
    #[error("Vector error: {0}")]
    Vector(String),

    /// Cryptographic error
    #[error("Crypto error: {0}")]
    Crypto(String),

    /// CRDT operation error
    #[error("CRDT error: {0}")]
    Crdt(String),

    /// Resource exhausted
    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),

    /// Timeout occurred
    #[error("Operation timed out after {0:?}")]
    Timeout(std::time::Duration),

    /// Internal bug
    #[error("Internal error: {0}")]
    Internal(String),

    /// Unknown error
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl CoreError {
    /// Create an invalid input error
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput(msg.into())
    }

    /// Create a not supported error
    pub fn not_supported(msg: impl Into<String>) -> Self {
        Self::NotSupported(msg.into())
    }

    /// Create a vector error
    pub fn vector(msg: impl Into<String>) -> Self {
        Self::Vector(msg.into())
    }

    /// Create a crypto error
    pub fn crypto(msg: impl Into<String>) -> Self {
        Self::Crypto(msg.into())
    }

    /// Create a CRDT error
    pub fn crdt(msg: impl Into<String>) -> Self {
        Self::Crdt(msg.into())
    }

    /// Create an internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// Check if this is a retryable error
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Timeout(_) | Self::ResourceExhausted(_))
    }

    /// Get error code for FFI
    pub fn error_code(&self) -> u32 {
        match self {
            Self::InvalidInput(_) => 1,
            Self::NotSupported(_) => 2,
            Self::Io(_) => 3,
            Self::Serialization(_) => 4,
            Self::Vector(_) => 5,
            Self::Crypto(_) => 6,
            Self::Crdt(_) => 7,
            Self::ResourceExhausted(_) => 8,
            Self::Timeout(_) => 9,
            Self::Internal(_) => 10,
            Self::Unknown(_) => 99,
        }
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        let err = CoreError::InvalidInput("test".to_string());
        assert_eq!(err.error_code(), 1);

        let err = CoreError::Timeout(std::time::Duration::from_secs(1));
        assert_eq!(err.error_code(), 9);
    }

    #[test]
    fn test_retryable() {
        let err = CoreError::Timeout(std::time::Duration::from_secs(1));
        assert!(err.is_retryable());

        let err = CoreError::InvalidInput("test".to_string());
        assert!(!err.is_retryable());
    }
}
