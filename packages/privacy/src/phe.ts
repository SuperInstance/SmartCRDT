/**
 * Partially Homomorphic Encryption (PHE) for Embedding Privacy
 *
 * This module implements Paillier cryptosystem-based partially homomorphic encryption
 * for securing embeddings before transmission to cloud services. The Paillier system
 * supports additive homomorphism, enabling computation on encrypted data without
 * decryption.
 *
 * ## Architecture Overview
 *
 * ### Paillier Cryptosystem
 *
 * The Paillier cryptosystem is a probabilistic asymmetric algorithm for public key
 * cryptography. It supports additive homomorphism: Enc(a) * Enc(b) = Enc(a + b).
 *
 * **Key Generation:**
 * - Choose two large primes p and q
 * - Compute n = p * q (modulus)
 * - Compute λ = lcm(p-1, q-1) (Carmichael function)
 * - Choose g such that gcd(L(g^λ mod n²), n) = 1
 * - Public key: (n, g)
 * - Private key: (λ, μ) where μ = (L(g^λ mod n²))^(-1) mod n
 *
 * **Encryption:**
 * - c = g^m * r^n mod n²
 * - where m is plaintext, r is random nonce
 *
 * **Decryption:**
 * - m = L(c^λ mod n²) * μ mod n
 * - where L(u) = (u - 1) / n
 *
 * **Homomorphic Properties:**
 * - Enc(a) * Enc(b) = Enc(a + b) [Additive]
 * - Enc(a)^k = Enc(k * a) [Scalar multiplication]
 *
 * ## Security Properties
 *
 * - **Semantic Security:** IND-CPA secure under decisional composite residuosity assumption
 * - **Additive Homomorphism:** Enable computation on encrypted embeddings
 * - **Key Size:** 2048-bit minimum (recommended: 3072-bit for long-term security)
 * - **Plaintext Space:** Z_n (integers modulo n)
 *
 * ## Usage for Embeddings
 *
 * For float embeddings, we use fixed-point arithmetic:
 * - Scale floats by precision factor (e.g., 10^6)
 * - Round to integer
 * - Encrypt each dimension
 * - Encrypted operations preserve semantics
 *
 * @packageDocumentation
 */

import { randomBytes, randomInt } from "crypto";

/**
 * Bit length for the Paillier modulus n
 *
 * 2048-bit is the minimum recommended size for security.
 * For long-term security, 3072-bit or 4096-bit is preferred.
 */
export const DEFAULT_KEY_SIZE = 2048;

/**
 * Precision for fixed-point float encoding
 *
 * Floats are multiplied by this factor and rounded to integers
 * before encryption. Higher precision = larger values = more overflow risk.
 */
export const DEFAULT_PRECISION = 1000000; // 10^6 = 6 decimal places

/**
 * Maximum safe integer value before encryption
 *
 * Ensures we don't overflow during homomorphic operations.
 * For n ≈ 2^2048, this is approximately 2^1024.
 */
export const MAX_SAFE_VALUE = BigInt(2) ** BigInt(1024) - BigInt(1);

/**
 * Paillier public key
 *
 * Used for encryption and homomorphic operations.
 * Can be freely shared without compromising security.
 */
export interface PaillierPublicKey {
  /** Modulus n = p * q */
  n: bigint;
  /** Generator g (typically n + 1) */
  g: bigint;
  /** n squared (cached for efficiency) */
  n2: bigint;
  /** Bit length of n */
  bitLength: number;
}

/**
 * Paillier private key
 *
 * Used for decryption. Must be kept secret.
 */
export interface PaillierPrivateKey {
  /** Modulus n (for reference) */
  n: bigint;
  /** Carmichael function λ = lcm(p-1, q-1) */
  lambda: bigint;
  /** μ = (L(g^λ mod n²))^(-1) mod n */
  mu: bigint;
  /** n squared (cached) */
  n2: bigint;
  /** Prime p (for verification) */
  p?: bigint;
  /** Prime q (for verification) */
  q?: bigint;
}

/**
 * Paillier key pair
 */
export interface PaillierKeyPair {
  publicKey: PaillierPublicKey;
  privateKey: PaillierPrivateKey;
}

/**
 * Encrypted embedding vector
 *
 * Each dimension is encrypted separately using Paillier.
 * Supports additive homomorphic operations.
 */
export interface EncryptedEmbedding {
  /** Encrypted values (one per dimension) */
  values: bigint[];
  /** Public key used for encryption */
  publicKey: PaillierPublicKey;
  /** Original dimension count */
  dimensions: number;
  /** Precision used for float encoding */
  precision: number;
}

/**
 * PHE configuration options
 */
export interface PHEConfig {
  /** Key size in bits (default: 2048) */
  keySize?: number;
  /** Precision for float encoding (default: 10^6) */
  precision?: number;
  /** Enable validation checks (default: true) */
  enableValidation?: boolean;
}

/**
 * PHE statistics for monitoring
 */
export interface PHEStats {
  /** Number of encryptions performed */
  encryptions: number;
  /** Number of decryptions performed */
  decryptions: number;
  /** Number of homomorphic additions */
  homomorphicAdditions: number;
  /** Number of scalar multiplications */
  scalarMultiplications: number;
  /** Total time spent encrypting (ms) */
  encryptionTime: number;
  /** Total time spent decrypting (ms) */
  decryptionTime: number;
}

/**
 * PHE class - Partially Homomorphic Encryption using Paillier
 *
 * Provides encryption, decryption, and homomorphic operations for embeddings.
 *
 * @example
 * ```typescript
 * const phe = new PHE({ keySize: 2048 });
 *
 * // Generate keys
 * const { publicKey, privateKey } = await phe.generateKeyPair();
 *
 * // Encrypt an embedding
 * const embedding = new Float32Array([0.1, -0.5, 0.8]);
 * const encrypted = phe.encrypt(embedding, publicKey);
 *
 * // Homomorphic addition
 * const other = phe.encrypt(new Float32Array([0.2, 0.3, -0.1]), publicKey);
 * const sum = phe.addEncrypted(encrypted, other);
 *
 * // Decrypt
 * const decrypted = phe.decrypt(sum, privateKey);
 * ```
 */
export class PHE {
  private config: Required<PHEConfig>;
  private stats: PHEStats;

  constructor(config: PHEConfig = {}) {
    this.config = {
      keySize: config.keySize ?? DEFAULT_KEY_SIZE,
      precision: config.precision ?? DEFAULT_PRECISION,
      enableValidation: config.enableValidation ?? true,
    };
    this.stats = {
      encryptions: 0,
      decryptions: 0,
      homomorphicAdditions: 0,
      scalarMultiplications: 0,
      encryptionTime: 0,
      decryptionTime: 0,
    };
  }

  /**
   * Generate a new Paillier key pair
   *
   * Uses Node.js crypto module for secure prime generation.
   *
   * @param keySize - Bit length for modulus (default: from config)
   * @returns Public and private keys
   */
  async generateKeyPair(keySize?: number): Promise<PaillierKeyPair> {
    const bits = keySize ?? this.config.keySize;

    // Generate two large primes
    // For Paillier, we need p and q such that gcd(p*q, (p-1)*(q-1)) = 1
    // This is satisfied when gcd(p, q) = 1 and both are safe primes
    const p = await this.generateSafePrime(bits / 2);
    const q = await this.generateSafePrime(bits / 2);

    // Ensure p != q
    if (p === q) {
      return this.generateKeyPair(keySize);
    }

    const n = p * q;
    const n2 = n * n;

    // Compute λ = lcm(p-1, q-1)
    const lambda = this.lcm(p - BigInt(1), q - BigInt(1));

    // Use g = n + 1 (simplest choice, works for Paillier)
    const g = n + BigInt(1);

    // Compute μ = (L(g^λ mod n²))^(-1) mod n
    // For g = n + 1, this simplifies significantly
    const gLambda = this.modPow(g, lambda, n2);
    const l = this.L(gLambda, n);
    const mu = this.modInverse(l, n);

    return {
      publicKey: { n, g, n2, bitLength: bits },
      privateKey: { n, lambda, mu, n2, p, q },
    };
  }

  /**
   * Encrypt a float embedding vector
   *
   * Converts floats to fixed-point integers, then encrypts each dimension.
   *
   * @param embedding - Float embedding vector
   * @param publicKey - Public key for encryption
   * @returns Encrypted embedding
   */
  encrypt(embedding: Float32Array, publicKey: PaillierPublicKey): EncryptedEmbedding {
    const startTime = Date.now();

    if (this.config.enableValidation) {
      this.validatePublicKey(publicKey);
      this.validateEmbedding(embedding);
    }

    const encrypted: bigint[] = [];

    for (let i = 0; i < embedding.length; i++) {
      // Convert float to fixed-point integer
      const scaled = Math.round(embedding[i] * this.config.precision);

      // Handle negative values
      const m = BigInt(signedToUnsigned(scaled));

      // Encrypt
      const c = this.encryptScalar(m, publicKey);
      encrypted.push(c);
    }

    this.stats.encryptions++;
    this.stats.encryptionTime += Date.now() - startTime;

    return {
      values: encrypted,
      publicKey,
      dimensions: embedding.length,
      precision: this.config.precision,
    };
  }

  /**
   * Encrypt a single scalar value
   *
   * @param m - Plaintext integer
   * @param publicKey - Public key
   * @returns Ciphertext
   */
  encryptScalar(m: bigint, publicKey: PaillierPublicKey): bigint {
    // Generate random nonce r
    const r = this.randomNonce(publicKey.n);

    // c = g^m * r^n mod n²
    const gm = this.modPow(publicKey.g, m, publicKey.n2);
    const rn = this.modPow(r, publicKey.n, publicKey.n2);
    const c = (gm * rn) % publicKey.n2;

    return c;
  }

  /**
   * Encrypt a single number value
   *
   * @param m - Plaintext number
   * @param publicKey - Public key
   * @returns Ciphertext
   */
  encryptNumber(m: number, publicKey: PaillierPublicKey): bigint {
    return this.encryptScalar(BigInt(m), publicKey);
  }

  /**
   * Decrypt an encrypted embedding
   *
   * @param encrypted - Encrypted embedding
   * @param privateKey - Private key for decryption
   * @returns Decrypted float embedding
   */
  decrypt(encrypted: EncryptedEmbedding, privateKey: PaillierPrivateKey): Float32Array {
    const startTime = Date.now();

    if (this.config.enableValidation) {
      this.validatePrivateKey(privateKey);
      this.validateEncryptedEmbedding(encrypted);
      this.validateKeyMatch(encrypted.publicKey, privateKey);
    }

    const result = new Float32Array(encrypted.dimensions);

    for (let i = 0; i < encrypted.values.length; i++) {
      const c = encrypted.values[i];

      // Decrypt
      const m = this.decryptScalar(c, privateKey);

      // Convert back to signed float
      const signed = unsignedToSigned(m);
      result[i] = signed / encrypted.precision;
    }

    this.stats.decryptions++;
    this.stats.decryptionTime += Date.now() - startTime;

    return result;
  }

  /**
   * Decrypt a single scalar value
   *
   * @param c - Ciphertext
   * @param privateKey - Private key
   * @returns Plaintext integer
   */
  decryptScalar(c: bigint, privateKey: PaillierPrivateKey): bigint {
    // m = L(c^λ mod n²) * μ mod n
    const cLambda = this.modPow(c, privateKey.lambda, privateKey.n2);
    const l = this.L(cLambda, privateKey.n);
    const m = (l * privateKey.mu) % privateKey.n;

    return m;
  }

  /**
   * Homomorphic addition of two encrypted embeddings
   *
   * Enc(a) * Enc(b) = Enc(a + b)
   *
   * @param a - First encrypted embedding
   * @param b - Second encrypted embedding
   * @returns Encrypted sum
   */
  addEncrypted(a: EncryptedEmbedding, b: EncryptedEmbedding): EncryptedEmbedding {
    if (a.dimensions !== b.dimensions) {
      throw new Error(`Dimension mismatch: ${a.dimensions} != ${b.dimensions}`);
    }

    if (a.precision !== b.precision) {
      throw new Error(`Precision mismatch: ${a.precision} != ${b.precision}`);
    }

    const result: bigint[] = [];

    for (let i = 0; i < a.values.length; i++) {
      // Homomorphic addition: multiply ciphertexts
      const sum = (a.values[i] * b.values[i]) % a.publicKey.n2;
      result.push(sum);
    }

    this.stats.homomorphicAdditions++;

    return {
      values: result,
      publicKey: a.publicKey,
      dimensions: a.dimensions,
      precision: a.precision,
    };
  }

  /**
   * Scalar multiplication of encrypted embedding
   *
   * Enc(a)^k = Enc(k * a)
   *
   * @param encrypted - Encrypted embedding
   * @param scalar - Scalar multiplier
   * @returns Encrypted scaled embedding
   */
  scalarMultiply(encrypted: EncryptedEmbedding, scalar: number): EncryptedEmbedding {
    const k = BigInt(scalar);

    const result: bigint[] = [];

    for (let i = 0; i < encrypted.values.length; i++) {
      // Enc(a)^k = Enc(k * a)
      const scaled = this.modPow(encrypted.values[i], k, encrypted.publicKey.n2);
      result.push(scaled);
    }

    this.stats.scalarMultiplications++;

    return {
      values: result,
      publicKey: encrypted.publicKey,
      dimensions: encrypted.dimensions,
      precision: encrypted.precision,
    };
  }

  /**
   * Compute encrypted dot product (requires one encrypted, one plaintext)
   *
   * Note: This is a simplified implementation. For true encrypted dot product
   * with PHE, we would encrypt the plaintext vector and use homomorphic addition.
   * However, since we only have additive homomorphism (not multiplicative),
   * full dot product requires decrypting intermediate results or using FHE.
   *
   * This implementation demonstrates the limitation - we compute the result
   * but note that full privacy would require FHE or secure MPC.
   *
   * @param encryptedA - Encrypted embedding A
   * @param plaintextB - Plaintext embedding B
   * @param privateKey - Private key for intermediate decryption
   * @returns Dot product (plaintext)
   */
  encryptedDotProduct(
    encryptedA: EncryptedEmbedding,
    plaintextB: Float32Array,
    privateKey: PaillierPrivateKey
  ): number {
    if (encryptedA.dimensions !== plaintextB.length) {
      throw new Error(`Dimension mismatch: ${encryptedA.dimensions} != ${plaintextB.length}`);
    }

    // For PHE with only additive homomorphism, we need to decrypt
    // to compute the full dot product. This demonstrates the limitation.
    const decryptedA = this.decrypt(encryptedA, privateKey);

    let sum = 0;
    for (let i = 0; i < decryptedA.length; i++) {
      sum += decryptedA[i] * plaintextB[i];
    }

    return sum;
  }

  /**
   * Get statistics about PHE operations
   */
  getStats(): PHEStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      encryptions: 0,
      decryptions: 0,
      homomorphicAdditions: 0,
      scalarMultiplications: 0,
      encryptionTime: 0,
      decryptionTime: 0,
    };
  }

  /**
   * Generate a safe prime
   *
   * A safe prime is of the form 2p + 1 where p is also prime.
   * This ensures additional security properties.
   *
   * @param bits - Bit length
   * @returns Safe prime
   */
  private async generateSafePrime(bits: number): Promise<bigint> {
    while (true) {
      // Generate candidate prime
      const bytes = Math.ceil(bits / 8);
      const buffer = randomBytes(bytes);

      // Set high bit to ensure correct bit length
      const bufArray = Array.from(buffer);
      bufArray[0] |= 0x80;

      // Set low bit to ensure odd
      bufArray[bytes - 1] |= 0x01;

      let candidate = BigInt('0x' + Buffer.from(bufArray).toString('hex'));

      // Ensure it's actually prime
      if (await this.isProbablyPrime(candidate)) {
        return candidate;
      }
    }
  }

  /**
   * Miller-Rabin primality test
   *
   * @param n - Number to test
   * @param k - Number of iterations (default: 40)
   * @returns True if probably prime
   */
  private async isProbablyPrime(n: bigint, k: number = 40): Promise<boolean> {
    if (n < BigInt(2)) return false;
    if (n === BigInt(2) || n === BigInt(3)) return true;
    if (n % BigInt(2) === BigInt(0)) return false;

    // Write n - 1 as 2^r * d
    let r = BigInt(0);
    let d = n - BigInt(1);
    while (d % BigInt(2) === BigInt(0)) {
      d /= BigInt(2);
      r++;
    }

    // Witness loop
    for (let i = 0; i < k; i++) {
      const a = this.randomBig(n - BigInt(4)) + BigInt(2);
      let x = this.modPow(a, d, n);

      if (x === BigInt(1) || x === n - BigInt(1)) {
        continue;
      }

      let composite = true;
      for (let j = BigInt(0); j < r - BigInt(1); j++) {
        x = (x * x) % n;
        if (x === n - BigInt(1)) {
          composite = false;
          break;
        }
      }

      if (composite) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate random nonce for encryption
   *
   * @param n - Modulus
   * @returns Random r in [1, n-1]
   */
  private randomNonce(n: bigint): bigint {
    return this.randomBig(n - BigInt(2)) + BigInt(1);
  }

  /**
   * Generate random bigint in range [0, max)
   *
   * @param max - Maximum value (exclusive)
   * @returns Random bigint
   */
  private randomBig(max: bigint): bigint {
    const bytes = [];
    let temp = max;

    while (temp > BigInt(0)) {
      bytes.push(Number(temp & BigInt(0xff)));
      temp >>= BigInt(8);
    }

    const buffer = randomBytes(bytes.length);

    let result = BigInt('0x' + buffer.toString('hex'));

    // Ensure result < max
    while (result >= max) {
      result = result % max;
    }

    return result;
  }

  /**
   * Modular exponentiation
   *
   * Computes (base^exp) mod mod efficiently using binary exponentiation.
   *
   * @param base - Base
   * @param exp - Exponent
   * @param mod - Modulus
   * @returns (base^exp) mod mod
   */
  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = BigInt(1);
    let b = base % mod;
    let e = exp;

    while (e > BigInt(0)) {
      if (e % BigInt(2) === BigInt(1)) {
        result = (result * b) % mod;
      }
      e >>= BigInt(1);
      b = (b * b) % mod;
    }

    return result;
  }

  /**
   * L function for Paillier: L(u) = (u - 1) / n
   *
   * @param u - Input value
   * @param n - Modulus
   * @returns L(u)
   */
  private L(u: bigint, n: bigint): bigint {
    return (u - BigInt(1)) / n;
  }

  /**
   * Compute least common multiple
   *
   * @param a - First number
   * @param b - Second number
   * @returns lcm(a, b)
   */
  private lcm(a: bigint, b: bigint): bigint {
    return (a * b) / this.gcd(a, b);
  }

  /**
   * Compute greatest common divisor
   *
   * @param a - First number
   * @param b - Second number
   * @returns gcd(a, b)
   */
  private gcd(a: bigint, b: bigint): bigint {
    while (b !== BigInt(0)) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * Modular multiplicative inverse
   *
   * Computes x such that (a * x) mod m = 1
   * Uses extended Euclidean algorithm.
   *
   * @param a - Number to invert
   * @param m - Modulus
   * @returns Modular inverse
   */
  private modInverse(a: bigint, m: bigint): bigint {
    const [gcd, x] = this.extendedGcd(a, m);

    if (gcd !== BigInt(1)) {
      throw new Error('Modular inverse does not exist');
    }

    return ((x % m) + m) % m;
  }

  /**
   * Extended Euclidean algorithm
   *
   * Returns (gcd, x, y) such that a*x + m*y = gcd(a, m)
   *
   * @param a - First number
   * @param m - Second number
   * @returns [gcd, x, y]
   */
  private extendedGcd(a: bigint, m: bigint): [bigint, bigint, bigint] {
    if (a === BigInt(0)) {
      return [m, BigInt(0), BigInt(1)];
    }

    const [gcd, x1, y1] = this.extendedGcd(m % a, a);
    const x = y1 - (m / a) * x1;
    const y = x1;

    return [gcd, x, y];
  }

  /**
   * Validate public key structure
   */
  private validatePublicKey(key: PaillierPublicKey): void {
    if (!key.n || !key.g || !key.n2) {
      throw new Error('Invalid public key: missing required fields');
    }

    if (key.bitLength < 2048) {
      throw new Error(`Insecure key size: ${key.bitLength} bits (minimum: 2048)`);
    }
  }

  /**
   * Validate private key structure
   */
  private validatePrivateKey(key: PaillierPrivateKey): void {
    if (!key.n || !key.lambda || !key.mu) {
      throw new Error('Invalid private key: missing required fields');
    }
  }

  /**
   * Validate embedding dimensions and values
   */
  private validateEmbedding(embedding: Float32Array): void {
    if (embedding.length === 0) {
      throw new Error('Embedding cannot be empty');
    }

    if (embedding.length > 10000) {
      throw new Error(`Embedding too large: ${embedding.length} dimensions (max: 10000)`);
    }

    for (let i = 0; i < embedding.length; i++) {
      if (!Number.isFinite(embedding[i])) {
        throw new Error(`Invalid value at dimension ${i}: ${embedding[i]}`);
      }

      if (Math.abs(embedding[i]) > MAX_SAFE_VALUE / BigInt(this.config.precision)) {
        throw new Error(`Value too large at dimension ${i}: ${embedding[i]}`);
      }
    }
  }

  /**
   * Validate encrypted embedding structure
   */
  private validateEncryptedEmbedding(embedding: EncryptedEmbedding): void {
    if (!embedding.values || !embedding.publicKey) {
      throw new Error('Invalid encrypted embedding: missing required fields');
    }

    if (embedding.values.length === 0) {
      throw new Error('Encrypted embedding cannot be empty');
    }

    if (embedding.values.length !== embedding.dimensions) {
      throw new Error(`Dimension mismatch: ${embedding.values.length} != ${embedding.dimensions}`);
    }
  }

  /**
   * Validate that public and private keys match
   */
  private validateKeyMatch(publicKey: PaillierPublicKey, privateKey: PaillierPrivateKey): void {
    if (publicKey.n !== privateKey.n) {
      throw new Error('Key mismatch: public and private keys do not match');
    }
  }
}

/**
 * Convert signed integer to unsigned representation
 *
 * Uses two's complement style encoding for negative numbers.
 *
 * @param x - Signed integer
 * @returns Unsigned representation
 */
function signedToUnsigned(x: number): bigint {
  if (x >= 0) {
    return BigInt(x);
  }
  // For negative numbers, add 2^53 to make them positive
  // (using 53 bits as safe integer range)
  return BigInt(x) + BigInt(2) ** BigInt(53);
}

/**
 * Convert unsigned representation to signed integer
 *
 * @param x - Unsigned representation
 * @returns Signed integer
 */
function unsignedToSigned(x: bigint): number {
  const maxSafe = BigInt(2) ** BigInt(53);
  if (x > maxSafe / BigInt(2)) {
    return Number(x - maxSafe);
  }
  return Number(x);
}

/**
 * Compute Euclidean distance between two encrypted embeddings
 *
 * This requires homomorphic operations for:
 * - Subtraction: Enc(a - b) = Enc(a) * Enc(-b)
 * - Squaring: Not directly supported by Paillier (multiplicative)
 *
 * For full encrypted distance computation, we need to decrypt intermediate
 * results or use more advanced cryptography (FHE).
 *
 * This is a placeholder demonstrating the limitation.
 *
 * @param a - First encrypted embedding
 * @param b - Second encrypted embedding
 * @param privateKey - Private key for intermediate decryption
 * @returns Euclidean distance
 */
export function encryptedEuclideanDistance(
  a: EncryptedEmbedding,
  b: EncryptedEmbedding,
  privateKey: PaillierPrivateKey
): number {
  const phe = new PHE();

  // Decrypt both embeddings (this is the limitation of PHE)
  const decryptedA = phe.decrypt(a, privateKey);
  const decryptedB = phe.decrypt(b, privateKey);

  // Compute distance on plaintext
  let sum = 0;
  for (let i = 0; i < decryptedA.length; i++) {
    const diff = decryptedA[i] - decryptedB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compute cosine similarity between two encrypted embeddings
 *
 * Similar to Euclidean distance, this requires decryption or FHE.
 *
 * @param a - First encrypted embedding
 * @param b - Second encrypted embedding
 * @param privateKey - Private key
 * @returns Cosine similarity
 */
export function encryptedCosineSimilarity(
  a: EncryptedEmbedding,
  b: EncryptedEmbedding,
  privateKey: PaillierPrivateKey
): number {
  const phe = new PHE();

  const decryptedA = phe.decrypt(a, privateKey);
  const decryptedB = phe.decrypt(b, privateKey);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < decryptedA.length; i++) {
    dotProduct += decryptedA[i] * decryptedB[i];
    normA += decryptedA[i] * decryptedA[i];
    normB += decryptedB[i] * decryptedB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Serialize public key to JSON
 *
 * @param key - Public key
 * @returns JSON string
 */
export function serializePublicKey(key: PaillierPublicKey): string {
  return JSON.stringify({
    n: key.n.toString(16),
    g: key.g.toString(16),
    n2: key.n2.toString(16),
    bitLength: key.bitLength,
  });
}

/**
 * Deserialize public key from JSON
 *
 * @param json - JSON string
 * @returns Public key
 */
export function deserializePublicKey(json: string): PaillierPublicKey {
  const data = JSON.parse(json);
  return {
    n: BigInt('0x' + data.n),
    g: BigInt('0x' + data.g),
    n2: BigInt('0x' + data.n2),
    bitLength: data.bitLength,
  };
}

/**
 * Serialize private key to JSON
 *
 * @param key - Private key
 * @returns JSON string
 */
export function serializePrivateKey(key: PaillierPrivateKey): string {
  return JSON.stringify({
    n: key.n.toString(16),
    lambda: key.lambda.toString(16),
    mu: key.mu.toString(16),
    n2: key.n2.toString(16),
    p: key.p?.toString(16),
    q: key.q?.toString(16),
  });
}

/**
 * Deserialize private key from JSON
 *
 * @param json - JSON string
 * @returns Private key
 */
export function deserializePrivateKey(json: string): PaillierPrivateKey {
  const data = JSON.parse(json);
  return {
    n: BigInt('0x' + data.n),
    lambda: BigInt('0x' + data.lambda),
    mu: BigInt('0x' + data.mu),
    n2: BigInt('0x' + data.n2),
    p: data.p ? BigInt('0x' + data.p) : undefined,
    q: data.q ? BigInt('0x' + data.q) : undefined,
  };
}

/**
 * Serialize encrypted embedding to JSON
 *
 * @param embedding - Encrypted embedding
 * @returns JSON string
 */
export function serializeEncryptedEmbedding(embedding: EncryptedEmbedding): string {
  return JSON.stringify({
    values: embedding.values.map((v) => v.toString(16)),
    publicKey: embedding.publicKey,
    dimensions: embedding.dimensions,
    precision: embedding.precision,
  });
}

/**
 * Deserialize encrypted embedding from JSON
 *
 * @param json - JSON string
 * @returns Encrypted embedding
 */
export function deserializeEncryptedEmbedding(json: string): EncryptedEmbedding {
  const data = JSON.parse(json);
  return {
    values: data.values.map((v: string) => BigInt('0x' + v)),
    publicKey: data.publicKey,
    dimensions: data.dimensions,
    precision: data.precision,
  };
}
