//! # SuperInstance Native FFI
//!
//! Node.js/TypeScript bindings using napi-rs.
//!
//! ## Usage in TypeScript
//!
//! ```typescript
//! import * as native from 'superinstance-native-ffi';
//!
//! // Create a vector
//! const vec = new native.Vector([1.0, 2.0, 3.0]);
//!
//! // Calculate similarity
//! const similarity = vec.cosineSimilarity(otherVec);
//! ```

use core::memory::{SafeArray, SecureBuffer};
use core::types::{Embedding, Vector as CoreVector};

pub mod embeddings;
pub mod crypto;
pub mod crdt;
pub mod utils;
pub mod hnsw;
pub mod cache;

// Re-export for convenience
pub use embeddings::*;
pub use crypto::*;
pub use crdt::*;
pub use hnsw::*;
pub use cache::*;

/// Get library version
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get build information
#[napi]
pub fn build_info() -> BuildInfo {
    BuildInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        profile: env!("PROFILE").to_string(),
        target: env!("TARGET").to_string(),
        rust_version: env!("RUSTC").to_string(),
    }
}

/// Build information
#[napi(object)]
pub struct BuildInfo {
    pub version: String,
    pub profile: String,
    pub target: String,
    pub rust_version: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        let v = version();
        assert!(!v.is_empty());
    }

    #[test]
    fn test_build_info() {
        let info = build_info();
        assert!(!info.version.is_empty());
        assert!(!info.target.is_empty());
    }
}
