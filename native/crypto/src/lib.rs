//! # SuperInstance Native Crypto
//!
//! Cryptographic primitives for hashing, encryption, and secure operations.
//!
//! ## Features
//!
//! - **Fast hashing**: BLAKE3 for high-performance hashing
//! - **Password hashing**: Argon2 for secure password storage
//! - **AEAD encryption**: ChaCha20-Poly1305 for authenticated encryption
//! - **Zero-copy operations**: Minimize memory overhead
//!
//! ## Security Guarantees
//!
//! - All secret data is zeroed on drop
//! - Constant-time operations where applicable
//! - Memory-safe implementations

pub mod hash;
pub mod encrypt;
pub mod kdf;
pub mod random;

pub use hash::{HashAlgorithm, hash, hash_blake3, hash_sha256};
pub use encrypt::{Cipher, encrypt, decrypt};
pub use kdf::{derive_key, KeyDerivation};
pub use random::{secure_random, SecureRandom};

use superinstance_native_core::{CoreError, CoreResult};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_blake3() {
        let data = b"Hello, world!";
        let hash = hash_blake3(data);
        assert_eq!(hash.len(), 32); // BLAKE3 output is 32 bytes
    }

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = b"Secret message";
        let key = [0u8; 32];
        let nonce = [0u8; 12];

        let ciphertext = encrypt(plaintext, &key, &nonce).unwrap();
        assert_ne!(ciphertext, plaintext.to_vec());

        let decrypted = decrypt(&ciphertext, &key, &nonce).unwrap();
        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_derive_key() {
        let password = b"my_password";
        let salt = b"my_salt";
        let key = derive_key(password, salt, 32).unwrap();
        assert_eq!(key.len(), 32);
    }
}
