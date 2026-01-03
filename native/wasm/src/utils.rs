//! Utility functions for WASM bindings

use wasm_bindgen::prelude::*;

/// Get current timestamp in seconds
#[wasm_bindgen]
pub fn timestamp() -> f64 {
    js_sys::Date::now() / 1000.0
}

/// Format a number as a string with fixed precision
#[wasm_bindgen]
pub fn formatNumber(value: f64, precision: usize) -> String {
    format!("{:.1$}", value, precision)
}

/// Sleep for a specified number of milliseconds (uses Promise)
#[wasm_bindgen]
pub async fn sleep(ms: u32) {
    use wasm_bindgen_futures::JsFuture;
    let promise = js_sys::Promise::new(&mut |resolve, _reject| {
        web_sys::window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                &resolve,
                ms as i32,
            )
            .unwrap();
    });
    JsFuture::from(promise).await.unwrap();
}
