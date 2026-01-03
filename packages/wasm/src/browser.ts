/**
 * Browser-specific exports and utilities
 */

// Re-export everything for browser use
export * from './index';

/**
 * Initialize WASM module for browser use
 *
 * This should be called once at application startup.
 *
 * @example
 * ```html
 * <script type="module">
 *   import { initWasm } from '@lsi/wasm/browser';
 *   await initWasm();
 *   // Use WASM functions...
 * </script>
 * ```
 */
export async function initWasm(): Promise<void> {
  try {
    // The WASM module will be initialized automatically on first use
    // This function is provided for explicit initialization if needed
    await import('../../native/wasm/pkg/superinstance_wasm.js');
  } catch (error) {
    console.error('Failed to initialize WASM module:', error);
    throw error;
  }
}

/**
 * Check if WASM is supported in the current browser
 */
export function isWasmSupported(): boolean {
  try {
    return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * Get WASM module info
 */
export async function getWasmInfo(): Promise<{
  supported: boolean;
  features: string[];
}> {
  const features: string[] = [];

  if (isWasmSupported()) {
    // Check for various WASM features
    try {
      if (typeof WebAssembly?.Global === 'function') {
        features.push('mutable_globals');
      }
      if (typeof WebAssembly?.Table === 'function') {
        features.push('bulk_memory');
      }
      // Add more feature checks as needed
    } catch (e) {
      // Feature detection failed
    }
  }

  return {
    supported: isWasmSupported(),
    features,
  };
}
