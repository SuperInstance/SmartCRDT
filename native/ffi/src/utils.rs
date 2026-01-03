//! # Utility Functions

use napi_derive::napi;

/// Generate a UUID v4
#[napi]
pub fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Get current timestamp in milliseconds
#[napi]
pub fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Encode bytes to hex
#[napi]
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

/// Decode hex to bytes
#[napi]
pub fn hex_to_bytes(hex: String) -> napi::Result<Vec<u8>> {
    hex::decode(hex).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Base64 encode
#[napi]
pub fn base64_encode(data: &[u8]) -> String {
    use base64::prelude::*;
    BASE64_STANDARD.encode(data)
}

/// Base64 decode
#[napi]
pub fn base64_decode(input: String) -> napi::Result<Vec<u8>> {
    use base64::prelude::*;
    BASE64_STANDARD
        .decode(input)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_uuid() {
        let uuid = generate_uuid();
        assert_eq!(uuid.len(), 36); // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    }

    #[test]
    fn test_current_timestamp() {
        let ts = current_timestamp();
        assert!(ts > 0);
    }

    #[test]
    fn test_hex_encode_decode() {
        let data = b"Hello, world!";
        let hex = bytes_to_hex(data);
        let decoded = hex_to_bytes(hex).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_base64_encode_decode() {
        let data = b"Hello, world!";
        let encoded = base64_encode(data);
        let decoded = base64_decode(encoded).unwrap();
        assert_eq!(decoded, data);
    }
}
