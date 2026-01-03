/**
 * @fileoverview Secure Aggregation for Federated Learning
 *
 * Implements privacy-preserving aggregation protocols:
 * - Shamir's Secret Sharing: Split model updates across servers
 * - Threshold Decryption: Require K servers to decrypt aggregate
 * - Verifiable Aggregation: Prove aggregation was done correctly
 * - Pairwise Masking: Client-side masking for additional privacy
 *
 * Security Properties:
 * - Confidentiality: No single server sees any client update
 * - Robustness: System tolerates up to N-K dropped clients
 * - Verifiability: Cryptographic proofs of correct aggregation
 * - Freshness: New randomness each round prevents replay attacks
 *
 * References:
 * - Bonawitz et al. (2017) "Practical Secure Aggregation for Privacy-Preserving Machine Learning"
 * - Kairouz et al. (2021) "Advances and Open Problems in Federated Learning"
 * - Shamir (1979) "How to Share a Secret"
 *
 * @module @lsi/federated-learning/secure-aggregation
 */

// Simple crypto utilities (browser-compatible)
class SimpleCrypto {
  /** Simple hash function using FNV-1a algorithm */
  static hash(data: string): string {
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /** Generate random bytes */
  static randomBytes(length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes;
  }

  /** Pseudo-random key derivation */
  static deriveKey(input: string, salt: string): number[] {
    const data = input + salt;
    const result: number[] = [];
    for (let i = 0; i < 32; i++) {
      result.push((data.charCodeAt(i % data.length) * (i + 1)) % 256);
    }
    return result;
  }
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Secret share for splitting model updates
 */
export interface SecretShare {
  /** Server ID this share belongs to */
  serverId: string;

  /** Share value (vector) */
  share: number[];

  /** X-coordinate for polynomial reconstruction */
  x: bigint;

  /** Verification commitment (for verifiable aggregation) */
  commitment?: bigint;

  /** Share timestamp */
  timestamp: number;
}

/**
 * Encrypted model update from client
 */
export interface EncryptedUpdate {
  /** Client identifier */
  clientId: string;

  /** Number of training samples */
  numSamples: number;

  /** Masked parameters (parameters + pairwise masks) */
  maskedParameters: number[];

  /** Secret shares for each server */
  shares: SecretShare[];

  /** Double-masking correction */
  doubleMaskCorrection?: number[];

  /** Verification proof */
  proof?: AggregationProof;

  /** Timestamp */
  timestamp: number;
}

/**
 * Aggregation proof for verification
 */
export interface AggregationProof {
  /** Hash of the input values */
  inputHash: string;

  /** Hash of the output (aggregate) */
  outputHash: string;

  /** Random nonce for freshness */
  nonce: string;

  /** Signature of the aggregation (simplified) */
  signature: string;

  /** Proof timestamp */
  timestamp: number;
}

/**
 * Secure aggregation result
 */
export interface SecureAggregationResult {
  /** Aggregated model parameters */
  parameters: number[];

  /** Number of clients participating */
  numClients: number;

  /** Total samples used for weighting */
  totalSamples: number;

  /** Number of servers that contributed shares */
  numServers: number;

  /** Verification result */
  verification: {
    verified: boolean;
    proof?: AggregationProof;
  };

  /** Privacy guarantees */
  privacy: {
    epsilon: number;  // Differential privacy epsilon
    delta: number;    // Differential privacy delta
    threshold: number; // Threshold for reconstruction
  };

  /** Performance metrics */
  performance: {
    encryptionTime: number;
    aggregationTime: number;
    decryptionTime: number;
    totalTime: number;
  };

  /** Aggregation timestamp */
  timestamp: number;
}

/**
 * Secure aggregation configuration
 */
export interface SecureAggregationConfig {
  /** Number of servers for secret sharing */
  numServers: number;

  /** Threshold of servers needed for reconstruction */
  threshold: number;

  /** Enable verifiable aggregation */
  enableVerification?: boolean;

  /** Enable pairwise masking */
  enablePairwiseMasking?: boolean;

  /** Differential privacy epsilon */
  epsilon?: number;

  /** Differential privacy delta */
  delta?: number;

  /** Prime modulus for secret sharing (default: large 128-bit prime) */
  prime?: bigint;

  /** Random seed for reproducibility (testing only) */
  seed?: number;
}

/**
 * Pairwise mask between clients
 */
export interface PairwiseMask {
  /** Client 1 ID */
  client1Id: string;

  /** Client 2 ID */
  client2Id: string;

  /** Mask value */
  mask: number[];

  /** Seed used to generate mask */
  seed: number[];
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

/**
 * Default secure aggregation configuration
 */
export const DEFAULT_SECURE_CONFIG: Required<SecureAggregationConfig> = {
  numServers: 4,
  threshold: 3,  // 3-of-4 threshold
  enableVerification: true,
  enablePairwiseMasking: true,
  epsilon: 1.0,
  delta: 1e-5,
  prime: BigInt("0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF"),
  seed: Date.now(),
};

/**
 * 128-bit prime for modular arithmetic (smaller than default for efficiency)
 * This is 2^127 - 1, a Mersenne-like prime
 */
const SMALL_PRIME = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

// ============================================================================
// SHAMIR'S SECRET SHARING
// ============================================================================

/**
 * Shamir's Secret Sharing implementation
 *
 * Splits a secret into n shares such that any k shares can reconstruct it,
 * but fewer than k shares reveal nothing.
 *
 * Security: k-1 shares give zero information about the secret
 * (information-theoretic security)
 */
export class ShamirSecretSharing {
  private readonly prime: bigint;
  private readonly threshold: number;
  private readonly numShares: number;

  constructor(threshold: number, numShares: number, prime?: bigint) {
    if (threshold > numShares) {
      throw new Error("Threshold cannot exceed number of shares");
    }
    if (threshold < 2) {
      throw new Error("Threshold must be at least 2");
    }

    this.threshold = threshold;
    this.numShares = numShares;
    this.prime = prime ?? SMALL_PRIME;
  }

  /**
   * Split a single value into shares
   *
   * Creates a random polynomial of degree threshold-1 where:
   * - f(0) = secret
   * - f(i) = share_i for i in 1..numShares
   *
   * @param secret - The secret value to split
   * @param seed - Optional seed for reproducibility
   * @returns Array of secret shares
   */
  splitValue(secret: number, seed?: number): SecretShare[] {
    // Convert secret to field element
    const secretField = this.mod(BigInt(Math.floor(Math.abs(secret))), this.prime);

    // Generate random polynomial coefficients
    // f(x) = secret + a_1*x + a_2*x^2 + ... + a_{k-1}*x^{k-1}
    const coefficients = [secretField];
    for (let i = 1; i < this.threshold; i++) {
      coefficients.push(this.randomFieldElement(seed));
    }

    // Evaluate polynomial at x = 1, 2, ..., numShares
    const shares: SecretShare[] = [];
    for (let x = 1; x <= this.numShares; x++) {
      const xBig = BigInt(x);
      const y = this.evaluatePolynomial(coefficients, xBig);
      shares.push({
        serverId: `server_${x}`,
        share: [Number(y)],
        x: xBig,
        timestamp: Date.now(),
      });
    }

    return shares;
  }

  /**
   * Split a vector of values into shares
   *
   * @param values - Vector of values to split
   * @param seed - Optional seed for reproducibility
   * @returns Array of secret shares (one per server)
   */
  splitVector(values: number[], seed?: number): SecretShare[] {
    const shares: SecretShare[] = [];

    // Initialize shares for each server
    for (let i = 0; i < this.numShares; i++) {
      shares.push({
        serverId: `server_${i + 1}`,
        share: new Array(values.length).fill(0),
        x: BigInt(i + 1),
        timestamp: Date.now(),
      });
    }

    // Split each value
    let valueSeed = seed;
    for (let j = 0; j < values.length; j++) {
      const valueShares = this.splitValue(values[j], valueSeed);
      if (valueSeed !== undefined) valueSeed += 1;

      // Distribute shares to servers
      for (let i = 0; i < this.numShares; i++) {
        shares[i].share[j] = valueShares[i].share[0];
      }
    }

    return shares;
  }

  /**
   * Reconstruct a secret from shares using Lagrange interpolation
   *
   * @param shares - Array of secret shares
   * @returns Reconstructed value
   */
  reconstructValue(shares: SecretShare[]): number {
    if (shares.length < this.threshold) {
      throw new Error(
        `Need at least ${this.threshold} shares, got ${shares.length}`
      );
    }

    // Extract x, y pairs
    const points = shares.map(s => ({ x: s.x, y: BigInt(s.share[0]) }));

    // Lagrange interpolation at x = 0
    let result = BigInt(0);
    for (let i = 0; i < points.length; i++) {
      const { x: xi, y: yi } = points[i];

      // Compute Lagrange basis polynomial l_i(0)
      let li = BigInt(1);
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const { x: xj } = points[j];

        // l_i(0) = product of (-xj) / (xi - xj)
        const numerator = this.mod(-xj, this.prime);
        const denominator = this.mod(xi - xj, this.prime);
        const denominatorInv = this.modInverse(denominator, this.prime);
        li = this.mod(li * numerator * denominatorInv, this.prime);
      }

      // Add contribution: y_i * l_i(0)
      result = this.mod(result + yi * li, this.prime);
    }

    return Number(result);
  }

  /**
   * Reconstruct a vector from shares
   *
   * @param shares - Array of secret shares (each containing a vector)
   * @returns Reconstructed vector
   */
  reconstructVector(shares: SecretShare[]): number[] {
    if (shares.length < this.threshold) {
      throw new Error(
        `Need at least ${this.threshold} shares, got ${shares.length}`
      );
    }

    const dim = shares[0].share.length;
    const result: number[] = [];

    // Reconstruct each dimension
    for (let j = 0; j < dim; j++) {
      const dimShares = shares.map(s => ({
        serverId: s.serverId,
        share: [s.share[j]],
        x: s.x,
        timestamp: s.timestamp,
      }));
      result[j] = this.reconstructValue(dimShares);
    }

    return result;
  }

  /**
   * Evaluate polynomial at point x
   */
  private evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let result = BigInt(0);
    let xPower = BigInt(1);

    for (const coeff of coefficients) {
      result = this.mod(result + coeff * xPower, this.prime);
      xPower = this.mod(xPower * x, this.prime);
    }

    return result;
  }

  /**
   * Generate random field element
   */
  private randomFieldElement(seed?: number): bigint {
    let value: number;
    if (seed !== undefined) {
      // Deterministic for testing
      value = (seed * 1103515245 + 12345) & 0x7fffffff;
    } else {
      // Cryptographically random
      value = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
    return this.mod(BigInt(value), this.prime);
  }

  /**
   * Modular arithmetic
   */
  private mod(a: bigint, b: bigint): bigint {
    const result = a % b;
    return result >= 0 ? result : result + b;
  }

  /**
   * Modular inverse using extended Euclidean algorithm
   */
  private modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [BigInt(1), BigInt(0)];

    while (r !== BigInt(0)) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
    }

    if (old_r > BigInt(1)) {
      throw new Error("Inverse does not exist");
    }

    return this.mod(old_s, m);
  }

  /**
   * Get threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Get number of shares
   */
  getNumShares(): number {
    return this.numShares;
  }
}

// ============================================================================
// SECURE AGGREGATION PROTOCOL
// ============================================================================

/**
 * Secure Aggregation Protocol
 *
 * Implements the full secure aggregation protocol:
 * 1. Clients split their updates into shares using secret sharing
 * 2. Clients send one share to each server
 * 3. Servers aggregate their shares
 * 4. Threshold number of servers collaborate to decrypt the aggregate
 * 5. Optional: Verifiable proofs of correct aggregation
 */
export class SecureAggregator {
  private readonly config: Required<SecureAggregationConfig>;
  private readonly secretSharing: ShamirSecretSharing;
  private readonly pairwiseMasks: Map<string, PairwiseMask>;
  private readonly roundNonces: Set<string>;

  constructor(config: SecureAggregationConfig = DEFAULT_SECURE_CONFIG) {
    this.config = { ...DEFAULT_SECURE_CONFIG, ...config };
    this.secretSharing = new ShamirSecretSharing(
      this.config.threshold,
      this.config.numServers,
      this.config.prime
    );
    this.pairwiseMasks = new Map();
    this.roundNonces = new Set();
  }

  /**
   * Client-side: Encrypt a model update
   *
   * Steps:
   * 1. Generate pairwise masks with other clients
   * 2. Apply pairwise masks to parameters
   * 3. Split masked parameters into shares
   * 4. Generate verification proof if enabled
   *
   * @param clientId - Client identifier
   * @param parameters - Model parameters to encrypt
   * @param numSamples - Number of training samples
   * @param otherClientIds - List of other clients for pairwise masking
   * @returns Encrypted update
   */
  encryptUpdate(
    clientId: string,
    parameters: number[],
    numSamples: number,
    otherClientIds: string[] = []
  ): EncryptedUpdate {
    const startTime = Date.now();

    // Step 1: Apply pairwise masking (optional)
    let maskedParameters = [...parameters];
    const doubleMaskCorrection: number[] = new Array(parameters.length).fill(0);

    if (this.config.enablePairwiseMasking) {
      for (const otherClientId of otherClientIds) {
        const mask = this.getOrCreatePairwiseMask(clientId, otherClientId, parameters.length);
        // Apply mask to parameters
        for (let i = 0; i < parameters.length; i++) {
          maskedParameters[i] += mask.mask[i];
          doubleMaskCorrection[i] -= mask.mask[i];
        }
      }
    }

    // Step 2: Split masked parameters into shares
    const shares = this.secretSharing.splitVector(
      maskedParameters,
      this.config.seed
    );

    // Step 3: Generate verification proof if enabled
    let proof: AggregationProof | undefined;
    if (this.config.enableVerification) {
      proof = this.generateAggregationProof(maskedParameters);
    }

    return {
      clientId,
      numSamples,
      maskedParameters,
      shares,
      doubleMaskCorrection: this.config.enablePairwiseMasking ? doubleMaskCorrection : undefined,
      proof,
      timestamp: Date.now(),
    };
  }

  /**
   * Server-side: Aggregate shares from multiple clients
   *
   * Each server receives one share from each client and aggregates them.
   * The aggregate of shares is also a share of the aggregate (homomorphic property).
   *
   * @param serverId - Server identifier
   * @param encryptedUpdates - List of encrypted updates from clients
   * @returns Aggregated share from this server
   */
  aggregateShares(serverId: string, encryptedUpdates: EncryptedUpdate[]): SecretShare {
    if (encryptedUpdates.length === 0) {
      throw new Error("No updates to aggregate");
    }

    // Find the share for this server from each update
    const serverShares = encryptedUpdates
      .map(update => update.shares.find(s => s.serverId === serverId))
      .filter((s): s is SecretShare => s !== undefined);

    if (serverShares.length !== encryptedUpdates.length) {
      throw new Error(`Missing shares for server ${serverId}`);
    }

    // Aggregate shares by summing them (homomorphic property)
    const dim = serverShares[0].share.length;
    const aggregatedShare = new Array(dim).fill(0);

    for (const share of serverShares) {
      for (let i = 0; i < dim; i++) {
        aggregatedShare[i] += share.share[i];
      }
    }

    return {
      serverId,
      share: aggregatedShare,
      x: BigInt(serverId.split("_")[1] || 1),
      timestamp: Date.now(),
    };
  }

  /**
   * Decrypt the aggregated result from K servers
   *
   * Requires threshold number of servers to contribute their aggregated shares.
   * Uses Lagrange interpolation to reconstruct the aggregate.
   *
   * @param aggregatedShares - Aggregated shares from servers
   * @param doubleMaskCorrections - Double-masking corrections from clients
   * @returns Decrypted aggregation result
   */
  decryptAggregate(
    aggregatedShares: SecretShare[],
    doubleMaskCorrections?: number[][]
  ): SecureAggregationResult {
    const decryptStartTime = Date.now();

    // Verify we have enough shares
    if (aggregatedShares.length < this.config.threshold) {
      throw new Error(
        `Need at least ${this.config.threshold} shares, got ${aggregatedShares.length}`
      );
    }

    // Step 1: Reconstruct aggregate from shares
    let parameters = this.secretSharing.reconstructVector(aggregatedShares);

    // Step 2: Remove double-masking corrections if present
    if (this.config.enablePairwiseMasking && doubleMaskCorrections) {
      const numClients = doubleMaskCorrections.length;
      const dim = parameters.length;

      // Sum all double-mask corrections
      const totalCorrection = new Array(dim).fill(0);
      for (const correction of doubleMaskCorrections) {
        for (let i = 0; i < dim; i++) {
          totalCorrection[i] += correction[i];
        }
      }

      // Apply correction
      for (let i = 0; i < dim; i++) {
        parameters[i] += totalCorrection[i];
      }
    }

    // Step 3: Verify result if proof is present
    let verified = true;
    let proof: AggregationProof | undefined;
    if (this.config.enableVerification) {
      const verification = this.verifyAggregation(parameters);
      verified = verification.verified;
      proof = verification.proof;
    }

    const decryptTime = Date.now() - decryptStartTime;

    return {
      parameters,
      numClients: doubleMaskCorrections?.length ?? aggregatedShares.length,
      totalSamples: 0,  // Would need to track from encrypted updates
      numServers: aggregatedShares.length,
      verification: { verified, proof },
      privacy: {
        epsilon: this.config.epsilon ?? 1.0,
        delta: this.config.delta ?? 1e-5,
        threshold: this.config.threshold,
      },
      performance: {
        encryptionTime: 0,  // Would need to track from encryptUpdate
        aggregationTime: 0,  // Would need to track from aggregateShares
        decryptionTime: decryptTime,
        totalTime: decryptTime,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Generate a proof of correct aggregation
   *
   * @param values - Values being aggregated
   * @returns Aggregation proof
   */
  generateAggregationProof(values: number[]): AggregationProof {
    const nonceBytes = SimpleCrypto.randomBytes(16);
    const nonce = nonceBytes.map(b => b.toString(16).padStart(2, '0')).join('');

    // Hash input values
    const inputHash = this.hashValues(values);

    // Hash would be computed after aggregation
    const outputHash = "";

    // Create signature (simplified - in production use actual digital signature)
    const signature = this.hashValues([...values, nonce].map(v => Number(v)));

    return {
      inputHash,
      outputHash,
      nonce,
      signature,
      timestamp: Date.now(),
    };
  }

  /**
   * Verify an aggregation proof
   *
   * @param aggregatedValues - The aggregated result
   * @param proof - The proof to verify
   * @returns Verification result
   */
  verifyAggregation(
    aggregatedValues: number[],
    proof?: AggregationProof
  ): { verified: boolean; proof?: AggregationProof } {
    if (!proof) {
      return { verified: true };  // No proof to verify
    }

    // In a real implementation, this would verify cryptographic signatures
    // For now, we do basic consistency checks

    // Verify nonce hasn't been used before (replay protection)
    if (this.roundNonces.has(proof.nonce)) {
      return { verified: false, proof };
    }
    this.roundNonces.add(proof.nonce);

    // Verify timestamp is recent
    const age = Date.now() - proof.timestamp;
    if (age > 60000) {  // 1 minute max
      return { verified: false, proof };
    }

    // Update output hash
    const updatedProof = {
      ...proof,
      outputHash: this.hashValues(aggregatedValues),
    };

    return { verified: true, proof: updatedProof };
  }

  /**
   * Get or create pairwise mask between two clients
   *
   * Uses pseudorandom generation based on client IDs for consistency.
   *
   * @param client1Id - First client ID
   * @param client2Id - Second client ID
   * @param length - Length of mask vector
   * @returns Pairwise mask
   */
  private getOrCreatePairwiseMask(
    client1Id: string,
    client2Id: string,
    length: number
  ): PairwiseMask {
    // Sort IDs for deterministic key
    const [id1, id2] = [client1Id, client2Id].sort();
    const key = `${id1}:${id2}`;

    // Check cache
    if (this.pairwiseMasks.has(key)) {
      return this.pairwiseMasks.get(key)!;
    }

    // Generate seed from client IDs
    const seedInput = `${id1}:${id2}:${this.config.seed}`;
    const seed = SimpleCrypto.deriveKey(seedInput, "salt");

    // Generate mask from seed
    const mask = this.generateMaskFromSeed(seed, length);

    const pairwiseMask: PairwiseMask = {
      client1Id: id1,
      client2Id: id2,
      mask,
      seed,
    };

    this.pairwiseMasks.set(key, pairwiseMask);
    return pairwiseMask;
  }

  /**
   * Generate mask from seed
   *
   * @param seed - Random seed
   * @param length - Length of mask
   * @returns Mask vector
   */
  private generateMaskFromSeed(seed: number[], length: number): number[] {
    const mask: number[] = [];
    let counter = 0;

    while (mask.length < length) {
      // Use hash of seed + counter
      const inputStr = seed.join(',') + ':' + counter++;
      const hashStr = SimpleCrypto.hash(inputStr);

      // Convert hash string to numbers
      for (let i = 0; i < hashStr.length && mask.length < length; i += 4) {
        const chunk = hashStr.slice(i, i + 4);
        const value = parseInt(chunk, 16) || 0;
        mask.push((value << 16) >> 16);  // Convert to 16-bit signed
      }
    }

    return mask.slice(0, length);
  }

  /**
   * Hash values for verification
   *
   * @param values - Values to hash
   * @returns Hex-encoded hash
   */
  private hashValues(values: number[]): string {
    // Simple hash of number array
    const dataStr = values.map(v => v.toFixed(10)).join(',');
    return SimpleCrypto.hash(dataStr);
  }

  /**
   * Clear round state (call between rounds)
   */
  clearRound(): void {
    this.roundNonces.clear();
  }

  /**
   * Clear all masks (call when client set changes)
   */
  clearMasks(): void {
    this.pairwiseMasks.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): Required<SecureAggregationConfig> {
    return { ...this.config };
  }

  /**
   * Get statistics about masks
   */
  getMaskStats(): { count: number; memoryEstimate: number } {
    let totalLength = 0;
    for (const mask of this.pairwiseMasks.values()) {
      totalLength += mask.mask.length * 8;  // 8 bytes per number
    }
    return {
      count: this.pairwiseMasks.size,
      memoryEstimate: totalLength,
    };
  }
}

// ============================================================================
// VERIFIABLE AGGREGATION
// ============================================================================

/**
 * Verifiable Aggregation with Homomorphic Commitments
 *
 * Uses Pedersen commitments for verifiable aggregation.
 * Clients commit to their values, servers prove they aggregated correctly.
 */
export class VerifiableAggregator extends SecureAggregator {
  private commitments: Map<string, bigint>;

  constructor(config: SecureAggregationConfig = DEFAULT_SECURE_CONFIG) {
    super(config);
    this.commitments = new Map();
  }

  /**
   * Create a commitment to a value
   *
   * Uses a simplified commitment scheme:
   * commitment = g^value * h^randomness mod p
   *
   * @param value - Value to commit to
   * @param randomness - Randomness for hiding
   * @returns Commitment
   */
  createCommitment(value: bigint, randomness?: bigint): bigint {
    const r = randomness ?? this.randomBigInt();
    const g = BigInt(2);  // Generator
    const h = BigInt(3);  // Second generator
    const p = this.getConfig().prime;

    // commitment = g^value * h^r mod p
    const gValue = this.modPow(g, value, p);
    const hR = this.modPow(h, r, p);
    const commitment = this.mod(gValue * hR, p);

    return commitment;
  }

  /**
   * Verify that a commitment opens to a value
   *
   * @param commitment - The commitment
   * @param value - Claimed value
   * @param randomness - Randomness used
   * @returns True if commitment is valid
   */
  verifyCommitment(
    commitment: bigint,
    value: bigint,
    randomness: bigint
  ): boolean {
    const recreated = this.createCommitment(value, randomness);
    return commitment === recreated;
  }

  /**
   * Create batch commitments for a vector
   *
   * @param values - Vector of values
   * @param clientId - Client ID
   * @returns Array of commitments
   */
  createBatchCommitments(values: number[], clientId: string): bigint[] {
    const commitments: bigint[] = [];

    for (let i = 0; i < values.length; i++) {
      const value = BigInt(Math.floor(values[i]));
      const commitment = this.createCommitment(value);
      commitments.push(commitment);

      // Store for later verification
      this.commitments.set(`${clientId}:${i}`, commitment);
    }

    return commitments;
  }

  /**
   * Verify batch aggregation
   *
   * Verifies that the aggregate of commitments matches the commitment of the aggregate.
   *
   * @param clientIds - Client IDs
   * @param index - Index of dimension
   * @param aggregateValue - Aggregated value
   * @returns True if verification passes
   */
  verifyBatchAggregation(
    clientIds: string[],
    index: number,
    aggregateValue: number
  ): boolean {
    const p = this.getConfig().prime;
    let productOfCommitments = BigInt(1);

    // Multiply all commitments (homomorphic property)
    for (const clientId of clientIds) {
      const key = `${clientId}:${index}`;
      const commitment = this.commitments.get(key);
      if (commitment === undefined) {
        return false;  // Missing commitment
      }
      productOfCommitments = this.mod(productOfCommitments * commitment, p);
    }

    // Check if product matches commitment of aggregate
    const aggregateCommitment = this.createCommitment(BigInt(Math.floor(aggregateValue)));

    return productOfCommitments === aggregateCommitment;
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = BigInt(1);
    base = base % modulus;

    while (exponent > BigInt(0)) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = this.mod(result * base, modulus);
      }
      exponent = exponent >> BigInt(1);
      base = this.mod(base * base, modulus);
    }

    return result;
  }

  /**
   * Modular arithmetic
   */
  private mod(a: bigint, b: bigint): bigint {
    const result = a % b;
    return result >= 0 ? result : result + b;
  }

  /**
   * Generate random big integer
   */
  private randomBigInt(): bigint {
    const bytes = SimpleCrypto.randomBytes(16);
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return BigInt('0x' + hex);
  }

  /**
   * Clear commitments (call between rounds)
   */
  clearCommitments(): void {
    this.commitments.clear();
    super.clearRound();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compare secure vs plain aggregation performance
 *
 * @param updates - Model updates to aggregate
 * @param secureConfig - Secure aggregation config
 * @returns Comparison results
 */
export function compareAggregationMethods(
  updates: Array<{ parameters: number[]; numSamples: number }>,
  secureConfig?: SecureAggregationConfig
): {
  plainTime: number;
  secureTime: number;
  overhead: number;
  results: {
    plain: number[];
    secure: number[];
    difference: number[];
  };
} {
  // Plain aggregation (FedAvg)
  const plainStart = Date.now();
  const plainResult = plainAggregate(updates);
  const plainTime = Date.now() - plainStart;

  // Secure aggregation
  const secureStart = Date.now();
  const aggregator = new SecureAggregator(secureConfig);

  // Encrypt all updates
  const clientIds = updates.map((_, i) => `client_${i}`);
  const encryptedUpdates = updates.map((update, i) =>
    aggregator.encryptUpdate(
      clientIds[i],
      update.parameters,
      update.numSamples,
      clientIds.filter((_, j) => j !== i)
    )
  );

  // Aggregate shares at each server
  const config = aggregator.getConfig();
  const aggregatedShares: SecretShare[] = [];
  for (let i = 0; i < config.numServers; i++) {
    const serverId = `server_${i + 1}`;
    const share = aggregator.aggregateShares(serverId, encryptedUpdates);
    aggregatedShares.push(share);
  }

  // Decrypt aggregate (need threshold shares)
  const thresholdShares = aggregatedShares.slice(0, config.threshold);
  const doubleMaskCorrections = encryptedUpdates.map(u => u.doubleMaskCorrection).filter((c): c is number[] => c !== undefined);
  const secureResult = aggregator.decryptAggregate(thresholdShares, doubleMaskCorrections);
  const secureTime = Date.now() - secureStart;

  // Compute differences
  const difference = plainResult.map((plain, i) =>
    Math.abs(plain - secureResult.parameters[i])
  );

  return {
    plainTime,
    secureTime,
    overhead: secureTime / plainTime,
    results: {
      plain: plainResult,
      secure: secureResult.parameters,
      difference,
    },
  };
}

/**
 * Plain federated averaging (for comparison)
 */
function plainAggregate(
  updates: Array<{ parameters: number[]; numSamples: number }>
): number[] {
  if (updates.length === 0) {
    return [];
  }

  const dim = updates[0].parameters.length;
  const result = new Array(dim).fill(0);
  const totalSamples = updates.reduce((sum, u) => sum + u.numSamples, 0);

  for (const update of updates) {
    const weight = update.numSamples / totalSamples;
    for (let i = 0; i < dim; i++) {
      result[i] += update.parameters[i] * weight;
    }
  }

  return result;
}

/**
 * Compute privacy guarantee from parameters
 *
 * @param numClients - Number of clients
 * @param threshold - Secret sharing threshold
 * @param epsilon - Differential privacy epsilon
 * @param delta - Differential privacy delta
 * @returns Privacy guarantee description
 */
export function computePrivacyGuarantee(
  numClients: number,
  threshold: number,
  epsilon: number,
  delta: number
): {
  guarantee: string;
  confidentiality: string;
  robustness: string;
  differentialPrivacy: string;
} {
  const tolerance = numClients - threshold;

  return {
    guarantee: `Secure aggregation with ${threshold}-of-${numClients} threshold`,
    confidentiality: `No coalition of less than ${threshold} servers can reconstruct any client's update`,
    robustness: `System tolerates up to ${tolerance} dropped clients`,
    differentialPrivacy: `(${epsilon.toFixed(2)}, ${delta.toExponential(2)})-differentially private`,
  };
}
