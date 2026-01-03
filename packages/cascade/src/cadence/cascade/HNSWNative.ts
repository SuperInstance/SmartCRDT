/**
 * HNSW Native Distance Calculations
 *
 * Provides Rust-accelerated distance calculations for HNSW index.
 * Falls back to TypeScript if native module is not available.
 *
 * @fileoverview
 * @author Claude (AI Assistant)
 * @created 2026-01-02
 */

/**
 * Native module interface (loaded dynamically)
 */
interface NativeHNSWModule {
  cosine_similarity_simd(a: number[], b: number[]): number;
  euclidean_distance_simd_ffi(a: number[], b: number[]): number;
  dot_product_simd_ffi(a: number[], b: number[]): number;
  batch_cosine_similarity_ffi(query: number[], candidates: number[][]): number[];
  batch_euclidean_distance_ffi(query: number[], candidates: number[][]): number[];
}

/**
 * Native module singleton
 */
let nativeModule: NativeHNSWModule | null = null;
let nativeAvailable = false;
let loadAttempted = false;

/**
 * Attempt to load the native Rust module
 *
 * @returns Promise that resolves to true if module is available
 */
export async function loadNativeModule(): Promise<boolean> {
  if (loadAttempted) {
    return nativeAvailable;
  }

  loadAttempted = true;

  try {
    // Try to load the native module
    const module = await import('@lsi/native/bindings');

    // Check if required functions are available
    if (
      typeof module.cosine_similarity_simd === 'function' &&
      typeof module.euclidean_distance_simd_ffi === 'function' &&
      typeof module.dot_product_simd_ffi === 'function'
    ) {
      nativeModule = module;
      nativeAvailable = true;
      console.log('[HNSWNative] ✓ Rust module loaded successfully');
    } else {
      console.warn('[HNSWNative] ✗ Native module loaded but missing required functions');
    }
  } catch (e) {
    // Module not available, will use TypeScript fallback
    console.debug('[HNSWNative] Native module not available:', (e as Error).message);
  }

  return nativeAvailable;
}

/**
 * Check if native module is available
 */
export function isNativeAvailable(): boolean {
  return nativeAvailable;
}

/**
 * Calculate cosine similarity using Rust (if available) or TypeScript fallback
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity in [-1, 1]
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (nativeAvailable && nativeModule) {
    try {
      const aArr = Array.from(a);
      const bArr = Array.from(b);
      return nativeModule.cosine_similarity_simd(aArr, bArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust cosine_similarity failed, falling back to TS:', e);
      return cosineSimilarityTS(a, b);
    }
  }

  return cosineSimilarityTS(a, b);
}

/**
 * Calculate cosine distance (1 - similarity) using Rust (if available) or TypeScript fallback
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine distance in [0, 2]
 */
export function cosineDistance(a: Float32Array, b: Float32Array): number {
  if (nativeAvailable && nativeModule) {
    try {
      const aArr = Array.from(a);
      const bArr = Array.from(b);
      return 1.0 - nativeModule.cosine_similarity_simd(aArr, bArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust cosine_distance failed, falling back to TS:', e);
      return cosineDistanceTS(a, b);
    }
  }

  return cosineDistanceTS(a, b);
}

/**
 * Calculate Euclidean distance using Rust (if available) or TypeScript fallback
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Euclidean distance in [0, ∞)
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (nativeAvailable && nativeModule) {
    try {
      const aArr = Array.from(a);
      const bArr = Array.from(b);
      return nativeModule.euclidean_distance_simd_ffi(aArr, bArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust euclidean_distance failed, falling back to TS:', e);
      return euclideanDistanceTS(a, b);
    }
  }

  return euclideanDistanceTS(a, b);
}

/**
 * Calculate dot product using Rust (if available) or TypeScript fallback
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (nativeAvailable && nativeModule) {
    try {
      const aArr = Array.from(a);
      const bArr = Array.from(b);
      return nativeModule.dot_product_simd_ffi(aArr, bArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust dot_product failed, falling back to TS:', e);
      return dotProductTS(a, b);
    }
  }

  return dotProductTS(a, b);
}

/**
 * Batch calculate cosine similarities
 *
 * @param query - Query vector
 * @param candidates - Array of candidate vectors
 * @returns Array of similarities
 */
export function batchCosineSimilarity(
  query: Float32Array,
  candidates: Float32Array[]
): number[] {
  if (nativeAvailable && nativeModule) {
    try {
      const queryArr = Array.from(query);
      const candidatesArr = candidates.map((c) => Array.from(c));
      return nativeModule.batch_cosine_similarity_ffi(queryArr, candidatesArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust batch_cosine_similarity failed, falling back to TS:', e);
      return batchCosineSimilarityTS(query, candidates);
    }
  }

  return batchCosineSimilarityTS(query, candidates);
}

/**
 * Batch calculate Euclidean distances
 *
 * @param query - Query vector
 * @param candidates - Array of candidate vectors
 * @returns Array of distances
 */
export function batchEuclideanDistance(
  query: Float32Array,
  candidates: Float32Array[]
): number[] {
  if (nativeAvailable && nativeModule) {
    try {
      const queryArr = Array.from(query);
      const candidatesArr = candidates.map((c) => Array.from(c));
      return nativeModule.batch_euclidean_distance_ffi(queryArr, candidatesArr);
    } catch (e) {
      console.warn('[HNSWNative] Rust batch_euclidean_distance failed, falling back to TS:', e);
      return batchEuclideanDistanceTS(query, candidates);
    }
  }

  return batchEuclideanDistanceTS(query, candidates);
}

// TypeScript fallback implementations

function cosineSimilarityTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

function cosineDistanceTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Infinity;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Process 4 elements at a time (SIMD-style)
  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    const a0 = a[i], b0 = b[i];
    const a1 = a[i + 1], b1 = b[i + 1];
    const a2 = a[i + 2], b2 = b[i + 2];
    const a3 = a[i + 3], b3 = b[i + 3];

    dotProduct += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
    normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
    normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
  }

  // Handle remaining elements
  for (let i = limit; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    if (normA === 0 && normB === 0) return 0;
    return 2;
  }

  const similarity = dotProduct / denominator;
  return 1 - similarity;
}

function euclideanDistanceTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Infinity;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let sumSq = 0;

  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    const a0 = a[i], b0 = b[i];
    const a1 = a[i + 1], b1 = b[i + 1];
    const a2 = a[i + 2], b2 = b[i + 2];
    const a3 = a[i + 3], b3 = b[i + 3];

    const diff0 = a0 - b0;
    const diff1 = a1 - b1;
    const diff2 = a2 - b2;
    const diff3 = a3 - b3;

    sumSq += diff0 * diff0 + diff1 * diff1 + diff2 * diff2 + diff3 * diff3;
  }

  for (let i = limit; i < len; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }

  return Math.sqrt(sumSq);
}

function dotProductTS(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  const len = a.length;
  const simdWidth = 4;
  const remainder = len % simdWidth;

  let dot = 0;

  const limit = len - remainder;
  for (let i = 0; i < limit; i += simdWidth) {
    dot += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
  }

  for (let i = limit; i < len; i++) {
    dot += a[i] * b[i];
  }

  return dot;
}

function batchCosineSimilarityTS(query: Float32Array, candidates: Float32Array[]): number[] {
  return candidates.map((candidate) => cosineSimilarityTS(query, candidate));
}

function batchEuclideanDistanceTS(query: Float32Array, candidates: Float32Array[]): number[] {
  return candidates.map((candidate) => euclideanDistanceTS(query, candidate));
}

/**
 * Enable or disable native module
 *
 * @param enabled - Whether to use native module
 */
export function setNativeEnabled(enabled: boolean): void {
  if (enabled && !loadAttempted) {
    // Try to load the module
    loadNativeModule().catch(() => {
      // Module not available, will use TS fallback
    });
  } else if (!enabled) {
    nativeAvailable = false;
  }
}

/**
 * Get performance statistics
 */
export function getStats() {
  return {
    nativeAvailable,
    loadAttempted,
  };
}
