//! # FFI Bindings for Crypto

use napi_derive::napi;
use superinstance_native_crypto::{
    hash_blake3, hash_sha256, derive_key, encrypt, decrypt, generate_key, generate_nonce, secure_random,
};

/// Hash algorithms
#[napi]
pub enum HashAlgorithm {
    Blake3,
    Sha256,
}

/// Hash data
#[napi]
pub fn hash(data: &[u8], algorithm: HashAlgorithm) -> Vec<u8> {
    match algorithm {
        HashAlgorithm::Blake3 => hash_blake3(data),
        HashAlgorithm::Sha256 => hash_sha256(data),
    }
}

/// Hash a string (returns hex)
#[napi]
pub fn hash_string(input: String, algorithm: HashAlgorithm) -> String {
    let bytes = hash(input.as_bytes(), algorithm);
    hex::encode(bytes)
}

/// Derive a key from password and salt
#[napi]
pub fn derive_key_from_password(password: &[u8], salt: &[u8], length: usize) -> napi::Result<Vec<u8>> {
    derive_key(password, salt, length).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Encryption result
#[napi(object)]
pub struct EncryptionResult {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

/// Encrypt data
#[napi]
pub fn encrypt_data(plaintext: &[u8], key: &[u8; 32]) -> napi::Result<EncryptionResult> {
    let nonce = generate_nonce();
    let ciphertext = encrypt(plaintext, key, &nonce).map_err(|e| napi::Error::from_reason(e.to_string()))?;

    Ok(EncryptionResult {
        ciphertext,
        nonce: nonce.to_vec(),
    })
}

/// Decrypt data
#[napi]
pub fn decrypt_data(ciphertext: &[u8], nonce: &[u8; 12], key: &[u8; 32]) -> napi::Result<Vec<u8>> {
    decrypt(ciphertext, key, nonce).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Generate a random encryption key
#[napi]
pub fn generate_encryption_key() -> [u8; 32] {
    generate_key()
}

/// Generate random bytes
#[napi]
pub fn random_bytes(length: usize) -> napi::Result<Vec<u8>> {
    secure_random(length).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Generate a random nonce
#[napi]
pub fn generate_random_nonce() -> Vec<u8> {
    generate_nonce().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_blake3() {
        let data = b"Hello, world!";
        let hash = hash(data, HashAlgorithm::Blake3);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_string() {
        let hash = hash_string("Hello".to_string(), HashAlgorithm::Blake3);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // 32 bytes * 2 (hex)
    }

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = b"Secret message";
        let key = generate_encryption_key();

        let encrypted = encrypt_data(plaintext, &key).unwrap();
        let decrypted = decrypt_data(&encrypted.ciphertext, &encrypted.nonce.try_into().unwrap(), &key).unwrap();

        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_random_bytes() {
        let bytes = random_bytes(32).unwrap();
        assert_eq!(bytes.len(), 32);
    }
}
