/**
 * Vector similarity operations
 */

import type { Vector } from './types';
import { ensureFloat32Array } from './types';

let wasmModule: any = null;

/**
 * Initialize WASM module
 */
async function initWasm(): Promise<any> {
  if (wasmModule) {
    return wasmModule;
  }

  try {
    // Dynamic import of generated WASM module
    const module = await import('../../native/wasm/pkg/superinstance_wasm.js');
    wasmModule = await module.default();
    return wasmModule;
  } catch (error) {
    throw new Error(`Failed to load WASM module: ${error}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score in [-1, 1] where 1 means identical
 *
 * @example
 * ```ts
 * const sim = cosineSimilarity([1.0, 0.0], [0.0, 1.0]); // 0.0
 * ```
 */
export async function cosineSimilarity(a: Vector, b: Vector): Promise<number> {
  const wasm = await initWasm();
  const aArray = ensureFloat32Array(a);
  const bArray = ensureFloat32Array(b);
  return wasm.cosineSimilarity(aArray, bArray);
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance in [0, inf) where 0 means identical
 *
 * @example
 * ```ts
 * const dist = euclideanDistance([0.0, 0.0], [3.0, 4.0]); // 5.0
 * ```
 */
export async function euclideanDistance(a: Vector, b: Vector): Promise<number> {
  const wasm = await initWasm();
  const aArray = ensureFloat32Array(a);
  const bArray = ensureFloat32Array(b);
  return wasm.euclideanDistance(aArray, bArray);
}

/**
 * Calculate dot product between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product (scalar projection)
 */
export async function dotProduct(a: Vector, b: Vector): Promise<number> {
  const wasm = await initWasm();
  const aArray = ensureFloat32Array(a);
  const bArray = ensureFloat32Array(b);
  return wasm.dotProduct(aArray, bArray);
}

/**
 * Calculate cosine similarity between query and multiple documents
 *
 * @param query - Query vector
 * @param documents - Array of document vectors
 * @returns Array of similarity scores
 *
 * @example
 * ```ts
 * const scores = batchCosineSimilarity(
 *   [1.0, 0.0],
 *   [[1.0, 0.0], [0.0, 1.0], [0.707, 0.707]]
 * );
 * // [1.0, 0.0, ~0.707]
 * ```
 */
export async function batchCosineSimilarity(
  query: Vector,
  documents: Vector[]
): Promise<number[]> {
  const wasm = await initWasm();
  const queryArray = ensureFloat32Array(query);
  const docArrays = documents.map(ensureFloat32Array);
  return wasm.batchCosineSimilarity(queryArray, docArrays);
}

/**
 * Normalize a vector to unit length
 *
 * @param vector - Vector to normalize
 * @returns Normalized vector
 */
export async function normalize(vector: Vector): Promise<Float32Array> {
  const wasm = await initWasm();
  const v = ensureFloat32Array(vector);
  return wasm.normalize(v);
}
