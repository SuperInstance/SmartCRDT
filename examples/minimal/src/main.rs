//! @file minimal.rs
//! @brief Minimal ActiveLog example in Rust (~30 lines)
//!
//! Demonstrates the complete ActiveLog workflow:
//! 1. Initialize library
//! 2. Register suggestion callback
//! 3. Post events
//! 4. Shutdown gracefully

use std::thread;
use std::time::Duration;
use activelog::{ActiveLog, activelog_init, activelog_on_suggest, activelog_post, activelog_free};

fn main() {
    // Step 1: Initialize ActiveLog
    println!("[INFO] ActiveLog initializing...");

    if unsafe { activelog_init(b"127.0.0.1:8080\0".as_ptr() as *const i8) } != 0 {
        eprintln!("[ERROR] Failed to initialize ActiveLog");
        return;
    }

    println!("[INFO] ActiveLog ready on 127.0.0.1:8080\n");

    // Step 2: Register callback for suggestions
    extern "C" fn on_suggestion(text: *const i8, confidence: f32) {
        if confidence > 0.8 {
            let text_str = unsafe { std::ffi::CStr::from_ptr(text) }
                .to_string_lossy()
                .into_owned();
            println!("[SUGGESTION] Pattern detected: {} (confidence: {:.2})", text_str, confidence);
        }
    }

    unsafe { activelog_on_suggest(on_suggestion) };

    // Step 3: Post some example events (modality 0 = text)
    let events = [
        "User logged in at 10:30 AM",
        "File saved: document.txt",
        "Compilation failed with 3 errors",
    ];

    for event in &events {
        println!("[EVENT] Posted: {}", event);

        // Zero-copy event posting
        unsafe {
            activelog_post(
                0, // modality: text
                event.as_ptr(),
                event.len()
            );
        }

        // Give suggestion engine time to process
        thread::sleep(Duration::from_millis(100));
    }

    println!();

    // Step 4: Shutdown gracefully
    println!("[INFO] Shutting down...");
    unsafe { activelog_free() };

    println!("[INFO] Goodbye!");
}
