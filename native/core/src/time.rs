//! # Time Utilities
//!
//! Time and duration types for native operations.

use serde::{Deserialize, Serialize};

/// Unix timestamp in milliseconds
pub type Timestamp = u64;

/// Duration in milliseconds
pub type Duration = u64;

/// Get current timestamp in milliseconds
pub fn now() -> Timestamp {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Convert seconds to milliseconds
pub const fn secs_to_ms(secs: u64) -> Duration {
    secs * 1000
}

/// Convert milliseconds to seconds
pub const fn ms_to_secs(ms: Duration) -> u64 {
    ms / 1000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_conversions() {
        assert_eq!(secs_to_ms(1), 1000);
        assert_eq!(ms_to_secs(5000), 5);
    }

    #[test]
    fn test_now() {
        let t = now();
        assert!(t > 0);
    }
}
