//! @file lib.rs
//! @brief ActiveLog WASM module template

#![no_std]
#![allow(non_snake_case)]

use core::panic::PanicInfo;

/// Panic handler
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

/// Module name
#[no_mangle]
pub extern "C" fn module_name() -> *const u8 {
    b"activelog_custom_parser\0".as_ptr()
}

/// Module version
#[no_mangle]
pub extern "C" fn module_version() -> *const u8 {
    b"0.1.0\0".as_ptr()
}

/// Module type: 0=parser, 1=detector, 2=generator
#[no_mangle]
pub extern "C" fn module_type() -> u32 {
    0 // parser
}

/// Parse custom log format
///
/// # Arguments
/// * `data` - Pointer to log data
/// * `len` - Length of data
///
/// # Returns
/// Number of parsed events
#[no_mangle]
pub extern "C" fn parse(data: *const u8, len: usize) -> i32 {
    // Safety: Create slice from raw pointer
    let slice = unsafe { core::slice::from_raw_parts(data, len) };

    // Convert to string (simplified)
    let _input = core::str::from_utf8(slice);

    // TODO: Implement custom parsing logic
    // For now, return 0 events parsed

    0
}

/// Module initialization (optional)
#[no_mangle]
pub extern "C" fn init(_config: *const u8, _config_len: usize) -> i32 {
    0 // success
}

/// Module cleanup (optional)
#[no_mangle]
pub extern "C" fn cleanup() -> i32 {
    0 // success
}

// Example: Simple parser implementation
/*
#[no_mangle]
pub extern "C" fn parse(data: *const u8, len: usize) -> i32 {
    let slice = unsafe { core::slice::from_raw_parts(data, len) };
    let input = match core::str::from_utf8(slice) {
        Ok(s) => s,
        Err(_) => return 0,
    };

    // Parse format: "timestamp|level|message"
    let mut count = 0;
    for line in input.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 3 {
            // Successfully parsed one event
            count += 1;
        }
    }

    count
}
*/
