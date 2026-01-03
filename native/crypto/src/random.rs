//! # Random Number Generation
//!
//! Cryptographically secure random number generation.

use superinstance_native_core::CoreResult;
use rand::RngCore;

/// Generate random bytes
pub fn secure_random(length: usize) -> CoreResult<Vec<u8>> {
    let mut bytes = vec![0u8; length];
    let mut rng = rand::rngs::OsRng;
    rng.fill_bytes(&mut bytes);
    Ok(bytes)
}

/// Generate a random u32
pub fn random_u32() -> CoreResult<u32> {
    let mut rng = rand::rngs::OsRng;
    Ok(rng.next_u32())
}

/// Generate a random u64
pub fn random_u64() -> CoreResult<u64> {
    let mut rng = rand::rngs::OsRng;
    Ok(rng.next_u64())
}

/// Generate a random value in a range
pub fn random_range(min: u64, max: u64) -> CoreResult<u64> {
    if min >= max {
        return Err(superinstance_native_core::CoreError::invalid_input(
            "Invalid range: min must be less than max",
        ));
    }

    let mut rng = rand::rngs::OsRng;
    Ok(rng.gen_range(min..max))
}

/// Secure random number generator
#[derive(Debug, Clone)]
pub struct SecureRandom;

impl SecureRandom {
    /// Create a new RNG
    pub fn new() -> Self {
        Self
    }

    /// Fill a buffer with random bytes
    pub fn fill_bytes(&self, buf: &mut [u8]) -> CoreResult<()> {
        let mut rng = rand::rngs::OsRng;
        rng.fill_bytes(buf);
        Ok(())
    }

    /// Generate random bytes
    pub fn gen_bytes(&self, length: usize) -> CoreResult<Vec<u8>> {
        secure_random(length)
    }

    /// Generate a random u32
    pub fn gen_u32(&self) -> CoreResult<u32> {
        random_u32()
    }

    /// Generate a random u64
    pub fn gen_u64(&self) -> CoreResult<u64> {
        random_u64()
    }
}

impl Default for SecureRandom {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_random() {
        let bytes = secure_random(32).unwrap();
        assert_eq!(bytes.len(), 32);

        // Different calls should produce different values
        let bytes2 = secure_random(32).unwrap();
        assert_ne!(bytes, bytes2);
    }

    #[test]
    fn test_random_u32() {
        let val = random_u32().unwrap();
        assert!(val <= u32::MAX);
    }

    #[test]
    fn test_random_u64() {
        let val = random_u64().unwrap();
        assert!(val <= u64::MAX);
    }

    #[test]
    fn test_random_range() {
        let val = random_range(10, 20).unwrap();
        assert!(val >= 10 && val < 20);
    }

    #[test]
    fn test_random_range_invalid() {
        let result = random_range(20, 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_secure_random_struct() {
        let rng = SecureRandom::new();
        let bytes = rng.gen_bytes(16).unwrap();
        assert_eq!(bytes.len(), 16);

        let mut buf = [0u8; 16];
        rng.fill_bytes(&mut buf).unwrap();
        assert_ne!(buf, [0u8; 16]);
    }
}
