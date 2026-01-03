//! # FFI Result Types
//!
//! Specialized result types for FFI boundaries with proper ownership semantics.

use serde::{Deserialize, Serialize};
use std::ffi::c_void;

use crate::error::{CoreError, CoreResult};

/// Result type for FFI operations
///
/// This type is designed to be safely passed across FFI boundaries.
#[repr(C)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FFIResult<T> {
    /// Success flag
    pub success: bool,

    /// Error code (0 = success)
    pub error_code: u32,

    /// Error message (null if success)
    pub error_message: Option<String>,

    /// Result data (null if error)
    pub data: Option<T>,
}

impl<T> FFIResult<T> {
    /// Create a successful result
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            error_code: 0,
            error_message: None,
            data: Some(data),
        }
    }

    /// Create an error result
    pub fn from_err(err: CoreError) -> Self {
        Self {
            success: false,
            error_code: err.error_code(),
            error_message: Some(err.to_string()),
            data: None,
        }
    }

    /// Check if result is successful
    pub fn is_ok(&self) -> bool {
        self.success
    }

    /// Check if result is error
    pub fn is_err(&self) -> bool {
        !self.success
    }

    /// Get reference to data, if successful
    pub fn data(&self) -> Option<&T> {
        self.data.as_ref()
    }

    /// Convert to CoreResult
    pub fn to_core_result(self) -> CoreResult<T> {
        if let Some(data) = self.data {
            Ok(data)
        } else {
            Err(CoreError::Internal(
                self.error_message.unwrap_or_else(|| "Unknown error".to_string()),
            ))
        }
    }
}

impl<T> From<CoreResult<T>> for FFIResult<T> {
    fn from(result: CoreResult<T>) -> Self {
        match result {
            Ok(data) => Self::ok(data),
            Err(err) => Self::from_err(err),
        }
    }
}

/// Raw FFI result for C ABI compatibility
///
/// Used when we need to pass raw pointers across the boundary.
#[repr(C)]
pub struct RawFFIResult {
    /// Success flag
    pub success: bool,

    /// Error code
    pub error_code: u32,

    /// Pointer to error message (must be freed by caller)
    pub error_message: *mut std::os::raw::c_char,

    /// Pointer to data (must be freed by caller)
    pub data: *mut c_void,
}

impl RawFFIResult {
    /// Create a successful result
    pub fn ok(data: *mut c_void) -> Self {
        Self {
            success: true,
            error_code: 0,
            error_message: std::ptr::null_mut(),
            data,
        }
    }

    /// Create an error result
    pub fn err(code: u32, message: *mut std::os::raw::c_char) -> Self {
        Self {
            success: false,
            error_code: code,
            error_message: message,
            data: std::ptr::null_mut(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_result_ok() {
        let result: FFIResult<i32> = FFIResult::ok(42);
        assert!(result.is_ok());
        assert_eq!(result.data(), Some(&42));
    }

    #[test]
    fn test_ffi_result_err() {
        let result: FFIResult<i32> = FFIResult::from_err(CoreError::invalid_input("test"));
        assert!(result.is_err());
        assert_eq!(result.error_code, 1);
    }

    #[test]
    fn test_from_core_result() {
        let ok_result: CoreResult<i32> = Ok(42);
        let ffi_result: FFIResult<i32> = ok_result.into();
        assert!(ffi_result.is_ok());

        let err_result: CoreResult<i32> = Err(CoreError::invalid_input("test"));
        let ffi_result: FFIResult<i32> = err_result.into();
        assert!(ffi_result.is_err());
    }
}
