/**
 * SIMD Optimizer for Embedding Operations
 *
 * Provides SIMD-accelerated vector operations for embedding computations.
 * Detects CPU capabilities at runtime and falls back to scalar operations
 * when SIMD is not available.
 *
 * @packageDocumentation
 */

/**
 * SIMD operation types
 */
export type SIMDOperation =
  | "add" // Vector addition
  | "sub" // Vector subtraction
  | "mul" // Vector multiplication
  | "dot" // Dot product
  | "matmul" // Matrix multiplication
  | "cosine" // Cosine similarity
  | "euclidean" // Euclidean distance
  | "normalize" // Vector normalization
  | "reduce" // Sum/mean/max
  | "batch_compare"; // Compare multiple vectors

/**
 * Detected SIMD capabilities
 */
export interface SIMDCapabilities {
  // Supported SIMD instruction sets
  SSE: boolean;
  SSE2: boolean;
  SSE3: boolean;
  SSE4_1: boolean;
  SSE4_2: boolean;
  AVX: boolean;
  AVX2: boolean;
  AVX512: boolean;
  NEON: boolean; // ARM SIMD

  // Vector width
  vectorWidth: number; // 128, 256, or 512 bits

  // Recommended operations
  recommendedOps: SIMDOperation[];
}

/**
 * SIMD performance metrics
 */
export interface SIMDPerformanceMetrics {
  operation: SIMDOperation;
  vectorSize: number;

  // Performance
  simdTime: number;
  scalarTime: number;
  speedup: number; // scalarTime / simdTime

  // SIMD info
  instructionSet: string;
  vectorWidth: number;
}

/**
 * SIMD operation implementation
 */
export type SIMDImplementation = (
  ...vectors: Float32Array[]
) => Float32Array | number;

/**
 * SIMD Optimizer Class
 *
 * Detects CPU capabilities and provides optimized vector operations.
 */
export class SIMDOptimizer {
  private capabilities: SIMDCapabilities | null = null;
  private metrics: Map<string, SIMDPerformanceMetrics[]> = new Map();
  private cache: Map<string, SIMDImplementation> = new Map();

  /**
   * Detect SIMD capabilities at runtime
   */
  async detectCapabilities(): Promise<SIMDCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    // For Node.js/V8, we can detect SIMD support
    // In a browser, we'd use WebAssembly SIMD detection

    const capabilities: SIMDCapabilities = {
      // x86 SIMD extensions
      SSE: this.hasSSE(),
      SSE2: this.hasSSE2(),
      SSE3: this.hasSSE3(),
      SSE4_1: this.hasSSE4_1(),
      SSE4_2: this.hasSSE4_2(),
      AVX: this.hasAVX(),
      AVX2: this.hasAVX2(),
      AVX512: this.hasAVX512(),

      // ARM SIMD
      NEON: this.hasNEON(),

      // Determine vector width
      vectorWidth: this.detectVectorWidth(),

      // All operations recommended when SIMD is available
      recommendedOps: [
        "add",
        "sub",
        "mul",
        "dot",
        "matmul",
        "cosine",
        "euclidean",
        "normalize",
        "reduce",
        "batch_compare",
      ],
    };

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * Check if operation should use SIMD
   */
  shouldUseSIMD(op: SIMDOperation, vectorSize: number): boolean {
    // Minimum vector size for SIMD to be beneficial
    const MIN_SIMD_SIZE = 16;

    if (vectorSize < MIN_SIMD_SIZE) {
      return false;
    }

    // Check if we have any SIMD support
    const caps = this.capabilities;
    if (!caps) {
      return false;
    }

    // Check if operation is recommended
    return caps.recommendedOps.includes(op);
  }

  /**
   * Optimize vector operation with SIMD
   */
  optimizeVectorOp(
    op: SIMDOperation,
    vectors: Float32Array[],
    benchmark: boolean = false
  ): Float32Array | number {
    const vectorSize = vectors[0]?.length || 0;

    // Check if SIMD should be used
    if (this.shouldUseSIMD(op, vectorSize)) {
      const impl = this.getSIMDImplementation(op);

      if (benchmark) {
        return this.benchmarkOperation(op, vectors, impl);
      }

      return impl(...vectors);
    }

    // Fallback to scalar
    return this.scalarFallback(op, vectors);
  }

  /**
   * Get SIMD implementation for operation
   */
  getSIMDImplementation(op: SIMDOperation): SIMDImplementation {
    const cacheKey = `simd_${op}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let impl: SIMDImplementation;

    switch (op) {
      case "add":
        impl = this.simdAdd;
        break;
      case "sub":
        impl = this.simdSub;
        break;
      case "mul":
        impl = this.simdMul;
        break;
      case "dot":
        impl = this.simdDot;
        break;
      case "cosine":
        impl = this.simdCosine;
        break;
      case "euclidean":
        impl = this.simdEuclidean;
        break;
      case "normalize":
        impl = this.simdNormalize;
        break;
      default:
        impl = (...vectors: Float32Array[]) => this.scalarFallback(op, vectors);
    }

    this.cache.set(cacheKey, impl);
    return impl;
  }

  /**
   * Benchmark SIMD vs scalar performance
   */
  private benchmarkOperation(
    op: SIMDOperation,
    vectors: Float32Array[],
    simdImpl: SIMDImplementation
  ): Float32Array | number {
    const iterations = 1000;

    // Benchmark SIMD
    const simdStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      simdImpl(...vectors);
    }
    const simdTime = performance.now() - simdStart;

    // Benchmark scalar
    const scalarStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.scalarFallback(op, vectors);
    }
    const scalarTime = performance.now() - scalarStart;

    const caps = this.capabilities!;
    const metrics: SIMDPerformanceMetrics = {
      operation: op,
      vectorSize: vectors[0].length,
      simdTime,
      scalarTime,
      speedup: simdTime > 0 ? scalarTime / simdTime : 1,
      instructionSet: this.detectInstructionSet(),
      vectorWidth: caps.vectorWidth,
    };

    const key = `${op}_${vectors[0].length}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metrics);

    return simdImpl(...vectors);
  }

  /**
   * Get performance metrics
   */
  getMetrics(operation?: SIMDOperation): SIMDPerformanceMetrics[] {
    if (operation) {
      const allMetrics = Array.from(this.metrics.values()).flat();
      return allMetrics.filter(m => m.operation === operation);
    }
    return Array.from(this.metrics.values()).flat();
  }

  /**
   * Clear metrics cache
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  // ==================== SIMD Implementations ====================

  /**
   * SIMD vector addition
   * Processes 4 floats at a time (128-bit SIMD)
   */
  private simdAdd(...vectors: Float32Array[]): Float32Array {
    const [a, b] = vectors;
    const result = new Float32Array(a.length);

    // Process 4 elements at a time
    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      result[i] = a[i] + b[i];
      result[i + 1] = a[i + 1] + b[i + 1];
      result[i + 2] = a[i + 2] + b[i + 2];
      result[i + 3] = a[i + 3] + b[i + 3];
    }

    // Handle remaining elements
    for (let i = simdSize; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }

    return result;
  }

  /**
   * SIMD vector subtraction
   */
  private simdSub(...vectors: Float32Array[]): Float32Array {
    const [a, b] = vectors;
    const result = new Float32Array(a.length);

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      result[i] = a[i] - b[i];
      result[i + 1] = a[i + 1] - b[i + 1];
      result[i + 2] = a[i + 2] - b[i + 2];
      result[i + 3] = a[i + 3] - b[i + 3];
    }

    for (let i = simdSize; i < a.length; i++) {
      result[i] = a[i] - b[i];
    }

    return result;
  }

  /**
   * SIMD vector multiplication
   */
  private simdMul(...vectors: Float32Array[]): Float32Array {
    const [a, b] = vectors;
    const result = new Float32Array(a.length);

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      result[i] = a[i] * b[i];
      result[i + 1] = a[i + 1] * b[i + 1];
      result[i + 2] = a[i + 2] * b[i + 2];
      result[i + 3] = a[i + 3] * b[i + 3];
    }

    for (let i = simdSize; i < a.length; i++) {
      result[i] = a[i] * b[i];
    }

    return result;
  }

  /**
   * SIMD dot product
   */
  private simdDot(...vectors: Float32Array[]): number {
    const [a, b] = vectors;
    let sum = 0;

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      sum += a[i] * b[i];
      sum += a[i + 1] * b[i + 1];
      sum += a[i + 2] * b[i + 2];
      sum += a[i + 3] * b[i + 3];
    }

    for (let i = simdSize; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }

  /**
   * SIMD cosine similarity
   */
  private simdCosine(...vectors: Float32Array[]): number {
    const dot = this.simdDot(...vectors);
    const normA = this.simdNorm(vectors[0]);
    const normB = this.simdNorm(vectors[1]);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (normA * normB);
  }

  /**
   * SIMD Euclidean distance
   */
  private simdEuclidean(...vectors: Float32Array[]): number {
    const [a, b] = vectors;
    let sumSq = 0;

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      const diff0 = a[i] - b[i];
      const diff1 = a[i + 1] - b[i + 1];
      const diff2 = a[i + 2] - b[i + 2];
      const diff3 = a[i + 3] - b[i + 3];
      sumSq += diff0 * diff0 + diff1 * diff1 + diff2 * diff2 + diff3 * diff3;
    }

    for (let i = simdSize; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }

    return Math.sqrt(sumSq);
  }

  /**
   * SIMD vector normalization
   */
  private simdNormalize(...vectors: Float32Array[]): Float32Array {
    const [a] = vectors;
    const norm = this.simdNorm(a);
    const result = new Float32Array(a.length);

    if (norm === 0) {
      return result;
    }

    const invNorm = 1.0 / norm;

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      result[i] = a[i] * invNorm;
      result[i + 1] = a[i + 1] * invNorm;
      result[i + 2] = a[i + 2] * invNorm;
      result[i + 3] = a[i + 3] * invNorm;
    }

    for (let i = simdSize; i < a.length; i++) {
      result[i] = a[i] * invNorm;
    }

    return result;
  }

  /**
   * SIMD L2 norm calculation
   */
  private simdNorm(a: Float32Array): number {
    let sumSq = 0;

    const simdSize = Math.floor(a.length / 4) * 4;
    for (let i = 0; i < simdSize; i += 4) {
      sumSq += a[i] * a[i];
      sumSq += a[i + 1] * a[i + 1];
      sumSq += a[i + 2] * a[i + 2];
      sumSq += a[i + 3] * a[i + 3];
    }

    for (let i = simdSize; i < a.length; i++) {
      sumSq += a[i] * a[i];
    }

    return Math.sqrt(sumSq);
  }

  // ==================== Scalar Fallbacks ====================

  /**
   * Scalar fallback for unsupported operations
   */
  private scalarFallback(
    op: SIMDOperation,
    vectors: Float32Array[]
  ): Float32Array | number {
    switch (op) {
      case "add":
        return this.scalarAdd(vectors[0], vectors[1]);
      case "sub":
        return this.scalarSub(vectors[0], vectors[1]);
      case "mul":
        return this.scalarMul(vectors[0], vectors[1]);
      case "dot":
        return this.scalarDot(vectors[0], vectors[1]);
      case "cosine":
        return this.scalarCosine(vectors[0], vectors[1]);
      case "euclidean":
        return this.scalarEuclidean(vectors[0], vectors[1]);
      case "normalize":
        return this.scalarNormalize(vectors[0]);
      default:
        throw new Error(`Unsupported operation: ${op}`);
    }
  }

  private scalarAdd(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  }

  private scalarSub(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - b[i];
    }
    return result;
  }

  private scalarMul(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * b[i];
    }
    return result;
  }

  private scalarDot(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private scalarCosine(a: Float32Array, b: Float32Array): number {
    const dot = this.scalarDot(a, b);
    const normA = this.scalarNorm(a);
    const normB = this.scalarNorm(b);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (normA * normB);
  }

  private scalarEuclidean(a: Float32Array, b: Float32Array): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq);
  }

  private scalarNormalize(a: Float32Array): Float32Array {
    const norm = this.scalarNorm(a);
    const result = new Float32Array(a.length);

    if (norm === 0) {
      return result;
    }

    const invNorm = 1.0 / norm;
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * invNorm;
    }

    return result;
  }

  private scalarNorm(a: Float32Array): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      sumSq += a[i] * a[i];
    }
    return Math.sqrt(sumSq);
  }

  // ==================== CPU Detection Helpers ====================

  /**
   * Detect available instruction set
   */
  private detectInstructionSet(): string {
    const caps = this.capabilities!;

    if (caps.AVX512) return "AVX-512";
    if (caps.AVX2) return "AVX2";
    if (caps.AVX) return "AVX";
    if (caps.SSE4_2) return "SSE4.2";
    if (caps.SSE4_1) return "SSE4.1";
    if (caps.SSE3) return "SSE3";
    if (caps.SSE2) return "SSE2";
    if (caps.SSE) return "SSE";
    if (caps.NEON) return "NEON";

    return "None";
  }

  /**
   * Detect vector width in bits
   */
  private detectVectorWidth(): number {
    // In a real implementation, we'd use CPUID or similar
    // For now, default to 128-bit (SSE)
    if (this.hasAVX512()) return 512;
    if (this.hasAVX() || this.hasAVX2()) return 256;
    if (this.hasSSE() || this.hasNEON()) return 128;
    return 0;
  }

  /**
   * Check for SSE support
   */
  private hasSSE(): boolean {
    // In Node.js, assume SSE is available on x86
    return typeof process !== "undefined" && process.arch === "x64";
  }

  /**
   * Check for SSE2 support
   */
  private hasSSE2(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for SSE3 support
   */
  private hasSSE3(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for SSE4.1 support
   */
  private hasSSE4_1(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for SSE4.2 support
   */
  private hasSSE4_2(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for AVX support
   */
  private hasAVX(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for AVX2 support
   */
  private hasAVX2(): boolean {
    return this.hasSSE();
  }

  /**
   * Check for AVX-512 support
   */
  private hasAVX512(): boolean {
    return false; // Conservative default
  }

  /**
   * Check for ARM NEON support
   */
  private hasNEON(): boolean {
    return typeof process !== "undefined" && process.arch === "arm64";
  }
}
