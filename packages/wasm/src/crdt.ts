/**
 * CRDT (Conflict-free Replicated Data Types) for collaborative editing
 */

let wasmModule: any = null;

async function initWasm(): Promise<any> {
  if (wasmModule) {
    return wasmModule;
  }

  try {
    const module = await import('../../native/wasm/pkg/superinstance_wasm.js');
    wasmModule = await module.default();
    return wasmModule;
  } catch (error) {
    throw new Error(`Failed to load WASM module: ${error}`);
  }
}

/**
 * G-Counter (Grow-only Counter)
 *
 * A counter that can only increment. Supports distributed merging.
 *
 * @example
 * ```ts
 * const counter = new GCounter();
 * await counter.increment("node1", 5);
 * await counter.increment("node2", 3);
 * console.log(await counter.value()); // 8
 *
 * // Serialize and merge with another counter
 * const bytes = await counter.toBytes();
 * const other = new GCounter();
 * await other.fromBytes(bytes);
 * ```
 */
export class GCounter {
  private inner: any = null;

  /**
   * Create a new G-Counter
   */
  constructor() {
    // Will be initialized lazily
  }

  /**
   * Initialize the WASM counter
   */
  private async ensureInitialized(): Promise<void> {
    if (this.inner) {
      return;
    }

    const wasm = await initWasm();
    this.inner = new wasm.GCounter();
  }

  /**
   * Increment the counter for a node
   *
   * @param node - Node identifier
   * @param amount - Amount to increment (default: 1)
   */
  async increment(node: string, amount: number = 1): Promise<void> {
    await this.ensureInitialized();
    this.inner.increment(node, amount);
  }

  /**
   * Get the current value (sum of all node counts)
   */
  async value(): Promise<number> {
    await this.ensureInitialized();
    return this.inner.value();
  }

  /**
   * Get the count for a specific node
   *
   * @param node - Node identifier
   * @returns Count for the node, or 0 if not found
   */
  async get(node: string): Promise<number> {
    await this.ensureInitialized();
    return this.inner.get(node);
  }

  /**
   * Merge with another G-Counter
   *
   * Takes the maximum value for each node.
   *
   * @param other - Binary serialized data from another counter
   */
  async merge(other: Uint8Array): Promise<void> {
    await this.ensureInitialized();
    this.inner.merge(other);
  }

  /**
   * Serialize to binary format
   *
   * @returns Binary representation of the counter
   */
  async toBytes(): Promise<Uint8Array> {
    await this.ensureInitialized();
    return this.inner.toBytes();
  }

  /**
   * Deserialize from binary format
   *
   * @param data - Binary data
   */
  async fromBytes(data: Uint8Array): Promise<void> {
    const wasm = await initWasm();
    this.inner = wasm.GCounter.fromBytes(data);
  }

  /**
   * Reset all counts (use with caution)
   */
  async reset(): Promise<void> {
    await this.ensureInitialized();
    this.inner.reset();
  }

  /**
   * Create a counter from binary data
   *
   * @param data - Binary serialized counter data
   * @returns New GCounter instance
   */
  static async fromBytes(data: Uint8Array): Promise<GCounter> {
    const counter = new GCounter();
    await counter.fromBytes(data);
    return counter;
  }
}
