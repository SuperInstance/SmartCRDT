//! # Key Derivation Functions
//!
//! Derive cryptographic keys from passwords and other inputs.

use superinstance_native_core::{CoreError, CoreResult};

/// Key derivation configuration
#[derive(Debug, Clone)]
pub struct KeyDerivation {
    /// Algorithm to use
    pub algorithm: KdfAlgorithm,

    /// Output key length in bytes
    pub output_length: usize,

    /// Iterations/time cost
    pub iterations: u32,

    /// Memory cost (for Argon2)
    pub memory_cost: u32,

    /// Parallelism
    pub parallelism: u32,
}

/// Key derivation algorithms
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KdfAlgorithm {
    /// Argon2id (recommended for passwords)
    Argon2id,

    /// Argon2i (data-dependent, side-channel resistant)
    Argon2i,

    /// Argon2y (data-independent)
    Argon2y,
}

impl Default for KeyDerivation {
    fn default() -> Self {
        Self {
            algorithm: KdfAlgorithm::Argon2id,
            output_length: 32,
            iterations: 3,
            memory_cost: 65536, // 64 MB
            parallelism: 4,
        }
    }
}

impl KeyDerivation {
    /// Create a fast configuration for testing
    pub fn fast() -> Self {
        Self {
            algorithm: KdfAlgorithm::Argon2id,
            output_length: 32,
            iterations: 1,
            memory_cost: 1024, // 1 KB
            parallelism: 1,
        }
    }

    /// Create a secure configuration for production
    pub fn secure() -> Self {
        Self {
            algorithm: KdfAlgorithm::Argon2id,
            output_length: 32,
            iterations: 3,
            memory_cost: 262144, // 256 MB
            parallelism: 4,
        }
    }
}

/// Derive a key from a password and salt
pub fn derive_key(password: &[u8], salt: &[u8], output_length: usize) -> CoreResult<Vec<u8>> {
    let config = KeyDerivation {
        output_length,
        ..Default::default()
    };

    derive_key_with_config(password, salt, &config)
}

/// Derive a key with a specific configuration
pub fn derive_key_with_config(
    password: &[u8],
    salt: &[u8],
    config: &KeyDerivation,
) -> CoreResult<Vec<u8>> {
    let algorithm = match config.algorithm {
        KdfAlgorithm::Argon2id => argon2::Algorithm::Argon2id,
        KdfAlgorithm::Argon2i => argon2::Algorithm::Argon2i,
        KdfAlgorithm::Argon2y => argon2::Algorithm::Argon2y,
    };

    let params = argon2::Params::new(
        config.memory_cost,
        config.iterations,
        config.parallelism,
        config.output_length,
    )
    .map_err(|e| CoreError::crypto(format!("Invalid Argon2 parameters: {}", e)))?;

    let mut output = vec![0u8; config.output_length];

    argon2::Argon2::new(algorithm, argon2::Version::V13, &params)
        .hash_password_into(password, salt, &mut output)
        .map_err(|e| CoreError::crypto(format!("Key derivation failed: {}", e)))?;

    Ok(output)
}

/// Derive a key with a default configuration (32 bytes, Argon2id)
pub fn derive_key_default(password: &[u8], salt: &[u8]) -> CoreResult<[u8; 32]> {
    let key = derive_key(password, salt, 32)?;
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&key);
    Ok(arr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key() {
        let password = b"my_password";
        let salt = b"my_salt";

        let key = derive_key(password, salt, 32).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_derive_key_deterministic() {
        let password = b"my_password";
        let salt = b"my_salt";

        let key1 = derive_key(password, salt, 32).unwrap();
        let key2 = derive_key(password, salt, 32).unwrap();

        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_different_salts() {
        let password = b"my_password";
        let salt1 = b"salt1";
        let salt2 = b"salt2";

        let key1 = derive_key(password, salt1, 32).unwrap();
        let key2 = derive_key(password, salt2, 32).unwrap();

        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derive_key_default() {
        let password = b"my_password";
        let salt = b"my_salt";

        let key = derive_key_default(password, salt).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_fast_config() {
        let config = KeyDerivation::fast();
        let password = b"password";
        let salt = b"salt";

        let key = derive_key_with_config(password, salt, &config).unwrap();
        assert_eq!(key.len(), 32);
    }
}
