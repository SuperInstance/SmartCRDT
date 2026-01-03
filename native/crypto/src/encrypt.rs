//! # Encryption Functions
//!
//! AEAD (Authenticated Encryption with Associated Data) using ChaCha20-Poly1305.

use superinstance_native_core::{CoreError, CoreResult};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};

/// Cipher for encryption/decryption
pub type Cipher = ChaCha20Poly1305;

/// Nonce size for ChaCha20-Poly1305
pub const NONCE_SIZE: usize = 12;

/// Key size for ChaCha20-Poly1305
pub const KEY_SIZE: usize = 32;

/// Tag size for authentication
pub const TAG_SIZE: usize = 16;

/// Encrypt data using ChaCha20-Poly1305 AEAD
///
/// # Arguments
///
/// * `plaintext` - Data to encrypt
/// * `key` - 32-byte encryption key
/// * `nonce` - 12-byte nonce (must be unique per encryption)
///
/// # Returns
///
/// Ciphertext with authentication tag appended
pub fn encrypt(plaintext: &[u8], key: &[u8; KEY_SIZE], nonce: &[u8; NONCE_SIZE]) -> CoreResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CoreError::crypto(format!("Encryption failed: {}", e)))
}

/// Decrypt data using ChaCha20-Poly1305 AEAD
///
/// # Arguments
///
/// * `ciphertext` - Data to decrypt (with tag)
/// * `key` - 32-byte encryption key
/// * `nonce` - 12-byte nonce used for encryption
///
/// # Returns
///
/// Decrypted plaintext
pub fn decrypt(ciphertext: &[u8], key: &[u8; KEY_SIZE], nonce: &[u8; NONCE_SIZE]) -> CoreResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CoreError::crypto(format!("Decryption failed: {}", e)))
}

/// Encrypt with associated data (AEAD)
///
/// Associated data is authenticated but not encrypted.
pub fn encrypt_aead(
    plaintext: &[u8],
    associated_data: &[u8],
    key: &[u8; KEY_SIZE],
    nonce: &[u8; NONCE_SIZE],
) -> CoreResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher
        .encrypt(nonce, chacha20poly1305::aead::Payload { aad: associated_data, msg: plaintext })
        .map_err(|e| CoreError::crypto(format!("Encryption failed: {}", e)))
}

/// Decrypt with associated data (AEAD)
pub fn decrypt_aead(
    ciphertext: &[u8],
    associated_data: &[u8],
    key: &[u8; KEY_SIZE],
    nonce: &[u8; NONCE_SIZE],
) -> CoreResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, chacha20poly1305::aead::Payload { aad: associated_data, msg: ciphertext })
        .map_err(|e| CoreError::crypto(format!("Decryption failed: {}", e)))
}

/// Generate a random nonce
pub fn generate_nonce() -> [u8; NONCE_SIZE] {
    ChaCha20Poly1305::generate_nonce().into()
}

/// Generate a random key
pub fn generate_key() -> [u8; KEY_SIZE] {
    ChaCha20Poly1305::generate_key().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let plaintext = b"Secret message";
        let key = generate_key();
        let nonce = generate_nonce();

        let ciphertext = encrypt(plaintext, &key, &nonce).unwrap();
        assert_ne!(ciphertext, plaintext.to_vec());

        let decrypted = decrypt(&ciphertext, &key, &nonce).unwrap();
        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_encrypt_decrypt_aead() {
        let plaintext = b"Secret message";
        let associated_data = b"Additional authenticated data";
        let key = generate_key();
        let nonce = generate_nonce();

        let ciphertext = encrypt_aead(plaintext, associated_data, &key, &nonce).unwrap();

        let decrypted = decrypt_aead(&ciphertext, associated_data, &key, &nonce).unwrap();
        assert_eq!(decrypted, plaintext.to_vec());
    }

    #[test]
    fn test_wrong_key_fails() {
        let plaintext = b"Secret message";
        let key1 = generate_key();
        let key2 = generate_key();
        let nonce = generate_nonce();

        let ciphertext = encrypt(plaintext, &key1, &nonce).unwrap();

        let result = decrypt(&ciphertext, &key2, &nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_associated_data_fails() {
        let plaintext = b"Secret message";
        let ad1 = b"Associated data 1";
        let ad2 = b"Associated data 2";
        let key = generate_key();
        let nonce = generate_nonce();

        let ciphertext = encrypt_aead(plaintext, ad1, &key, &nonce).unwrap();

        let result = decrypt_aead(&ciphertext, ad2, &key, &nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_modified_ciphertext_fails() {
        let plaintext = b"Secret message";
        let key = generate_key();
        let nonce = generate_nonce();

        let mut ciphertext = encrypt(plaintext, &key, &nonce).unwrap();
        ciphertext[0] ^= 1; // Modify one byte

        let result = decrypt(&ciphertext, &key, &nonce);
        assert!(result.is_err());
    }
}
