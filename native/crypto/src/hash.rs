//! # Hashing Functions
//!
//! Fast, secure hashing algorithms.

use superinstance_native_core::{CoreError, CoreResult};

/// Supported hash algorithms
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HashAlgorithm {
    /// BLAKE3 (fastest, recommended)
    Blake3,

    /// SHA-256 (widely compatible)
    Sha256,
}

/// Hash data using the specified algorithm
pub fn hash(data: &[u8], algorithm: HashAlgorithm) -> CoreResult<Vec<u8>> {
    match algorithm {
        HashAlgorithm::Blake3 => Ok(hash_blake3(data)),
        HashAlgorithm::Sha256 => Ok(hash_sha256(data)),
    }
}

/// Hash using BLAKE3 (returns 32 bytes)
pub fn hash_blake3(data: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(data);
    hasher.finalize().as_bytes().to_vec()
}

/// Hash using SHA-256 (returns 32 bytes)
pub fn hash_sha256(data: &[u8]) -> Vec<u8> {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Hash with key (HMAC-like using BLAKE3)
pub fn hash_blake3_keyed(data: &[u8], key: &[u8; 32]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new_keyed(key);
    hasher.update(data);
    hasher.finalize().as_bytes().to_vec()
}

/// Derive a hash from multiple inputs
pub fn hash_multiple(inputs: &[&[u8]], algorithm: HashAlgorithm) -> CoreResult<Vec<u8>> {
    match algorithm {
        HashAlgorithm::Blake3 => {
            let mut hasher = blake3::Hasher::new();
            for input in inputs {
                hasher.update(input);
            }
            Ok(hasher.finalize().as_bytes().to_vec())
        }
        HashAlgorithm::Sha256 => {
            use sha2::Digest;
            let mut hasher = sha2::Sha256::new();
            for input in inputs {
                hasher.update(input);
            }
            Ok(hasher.finalize().to_vec())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blake3() {
        let data = b"Hello, world!";
        let hash = hash_blake3(data);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_sha256() {
        let data = b"Hello, world!";
        let hash = hash_sha256(data);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_different_inputs() {
        let h1 = hash_blake3(b"input1");
        let h2 = hash_blake3(b"input2");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_same_inputs() {
        let h1 = hash_blake3(b"same input");
        let h2 = hash_blake3(b"same input");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_keyed_hash() {
        let data = b"data";
        let key = [0u8; 32];
        let h1 = hash_blake3_keyed(data, &key);
        let h2 = hash_blake3_keyed(data, &key);
        assert_eq!(h1, h2);

        let key2 = [1u8; 32];
        let h3 = hash_blake3_keyed(data, &key2);
        assert_ne!(h1, h3);
    }

    #[test]
    fn test_hash_multiple() {
        let inputs: Vec<&[u8]> = vec![b"hello", b" ", b"world"];
        let hash = hash_multiple(&inputs, HashAlgorithm::Blake3).unwrap();
        assert_eq!(hash.len(), 32);
    }
}
