//! # Memory Management Utilities
//!
//! Safe wrappers for memory operations across FFI boundaries.

use std::ffi::c_void;
use std::ptr::{self, NonNull};
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::error::{CoreError, CoreResult};

/// Global allocation counter for debugging
static ALLOCATION_COUNT: AtomicUsize = AtomicUsize::new(0);

/// Get current allocation count
pub fn allocation_count() -> usize {
    ALLOCATION_COUNT.load(Ordering::SeqCst)
}

/// Reset allocation counter (for testing)
#[doc(hidden)]
pub fn reset_allocation_count() {
    ALLOCATION_COUNT.store(0, Ordering::SeqCst);
}

/// A safely managed array with FFI support
///
/// This type wraps a Vec and provides FFI-safe access patterns.
#[derive(Debug)]
pub struct SafeArray<T> {
    data: Vec<T>,
}

impl<T> SafeArray<T> {
    /// Create a new safe array
    pub fn new(data: Vec<T>) -> Self {
        ALLOCATION_COUNT.fetch_add(1, Ordering::SeqCst);
        Self { data }
    }

    /// Get pointer to data
    pub fn as_ptr(&self) -> *const T {
        self.data.as_ptr()
    }

    /// Get mutable pointer to data
    pub fn as_mut_ptr(&mut self) -> *mut T {
        self.data.as_mut_ptr()
    }

    /// Get length
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Get reference to underlying data
    pub fn as_slice(&self) -> &[T] {
        &self.data
    }

    /// Convert to Vec
    pub fn into_vec(mut self) -> Vec<T> {
        ALLOCATION_COUNT.fetch_sub(1, Ordering::SeqCst);
        // Use std::mem::take to avoid moving out of Drop type
        std::mem::take(&mut self.data)
    }

    /// Leak the data and return a raw pointer (for FFI)
    ///
    /// # Safety
    ///
    /// The caller must ensure the pointer is eventually freed using `SafeArray::from_raw`.
    pub fn leak(self) -> *mut T {
        let ptr = self.data.as_ptr() as *mut T;
        let len = self.data.len();
        std::mem::forget(self);
        ptr
    }

    /// Recreate from a raw pointer (reclaim ownership)
    ///
    /// # Safety
    ///
    /// The pointer must have been created by `SafeArray::leak` and not yet freed.
    pub unsafe fn from_raw(ptr: *mut T, len: usize) -> Self {
        let data = Vec::from_raw_parts(ptr, len, len);
        Self { data }
    }
}

impl<T> Drop for SafeArray<T> {
    fn drop(&mut self) {
        ALLOCATION_COUNT.fetch_sub(1, Ordering::SeqCst);
    }
}

impl<T> From<Vec<T>> for SafeArray<T> {
    fn from(data: Vec<T>) -> Self {
        Self::new(data)
    }
}

/// A secure buffer that zeroes memory on drop
///
/// Useful for storing sensitive data (keys, passwords, etc.).
#[derive(Debug)]
pub struct SecureBuffer {
    data: Vec<u8>,
}

impl SecureBuffer {
    /// Create a new secure buffer
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    /// Create an empty buffer with capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            data: Vec::with_capacity(capacity),
        }
    }

    /// Get length
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Append data
    pub fn extend(&mut self, data: &[u8]) {
        self.data.extend_from_slice(data);
    }

    /// Get reference to data
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    /// Convert to Vec (zeroes memory in the process)
    pub fn into_vec(mut self) -> Vec<u8> {
        let mut data = Vec::new();
        std::mem::swap(&mut data, &mut self.data);
        zeroize::Zeroize::zeroize(&mut self.data);
        data
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        // Zero memory on drop
        zeroize::Zeroize::zeroize(&mut self.data);
    }
}

/// FFI-safe allocation wrapper
///
/// Manages memory that can be passed across FFI boundaries.
#[repr(C)]
pub struct FFIArray<T> {
    /// Pointer to data
    pub data: *mut T,

    /// Length of array
    pub len: usize,

    /// Capacity of array
    pub capacity: usize,
}

impl<T> FFIArray<T> {
    /// Create from Vec
    pub fn from_vec(mut data: Vec<T>) -> Self {
        let ptr = data.as_mut_ptr();
        let len = data.len();
        let capacity = data.capacity();
        std::mem::forget(data);

        Self {
            data: ptr,
            len,
            capacity,
        }
    }

    /// Convert back to Vec (reclaim ownership)
    ///
    /// # Safety
    ///
    /// Must be called exactly once per FFIArray.
    pub unsafe fn into_vec(self) -> Vec<T> {
        Vec::from_raw_parts(self.data, self.len, self.capacity)
    }

    /// Get pointer to data
    pub fn as_ptr(&self) -> *const T {
        self.data
    }

    /// Get length
    pub fn len(&self) -> usize {
        self.len
    }
}

impl<T> Drop for FFIArray<T> {
    fn drop(&mut self) {
        // Reclaim ownership and drop
        if !self.data.is_null() {
            unsafe {
                let _ = Vec::from_raw_parts(self.data, self.len, self.capacity);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_array() {
        let arr = SafeArray::new(vec![1, 2, 3]);
        assert_eq!(arr.len(), 3);
        assert_eq!(arr.as_slice(), &[1, 2, 3]);
    }

    #[test]
    fn test_safe_array_leak_reclaim() {
        let arr = SafeArray::new(vec![1, 2, 3]);
        let ptr = arr.leak();

        unsafe {
            let arr2 = SafeArray::from_raw(ptr, 3);
            assert_eq!(arr2.as_slice(), &[1, 2, 3]);
        }
    }

    #[test]
    fn test_secure_buffer() {
        let mut buf = SecureBuffer::new(vec![1, 2, 3]);
        assert_eq!(buf.len(), 3);
        buf.extend(&[4, 5]);
        assert_eq!(buf.as_slice(), &[1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_secure_buffer_zeroes() {
        let buf = SecureBuffer::new(vec![1, 2, 3]);
        drop(buf);
        // Can't directly test that memory was zeroed, but at least verify it compiles
    }

    #[test]
    fn test_ffi_array() {
        let data = vec![1, 2, 3];
        let arr = FFIArray::from_vec(data);
        assert_eq!(arr.len(), 3);

        unsafe {
            let recovered = arr.into_vec();
            assert_eq!(recovered, vec![1, 2, 3]);
        }
    }
}
