/**
 * SingletonManager - Manage singleton instances across modules
 * Ensure only one instance of singleton dependencies
 */

import type { SingletonScope, SharedDep } from "../types.js";

export class SingletonManager {
  private singletons: Map<string, SingletonScope> = new Map();
  private initOrder: string[] = [];
  private pending: Map<string, Promise<any>> = new Map();

  /**
   * Get or create singleton instance
   */
  async get(
    key: string,
    factory: () => Promise<any>,
    version: string
  ): Promise<any> {
    // Check if already exists
    const existing = this.singletons.get(key);
    if (existing) {
      return existing.instance;
    }

    // Check if initialization is in progress
    const pendingInit = this.pending.get(key);
    if (pendingInit) {
      return pendingInit;
    }

    // Initialize new instance
    const initPromise = this.initializeSingleton(key, factory, version);
    this.pending.set(key, initPromise);

    try {
      await initPromise;
      return this.singletons.get(key)!.instance;
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * Initialize singleton
   */
  private async initializeSingleton(
    key: string,
    factory: () => Promise<any>,
    version: string
  ): Promise<void> {
    const instance = await factory();

    const scope: SingletonScope = {
      instance,
      version,
      module: key,
    };

    this.singletons.set(key, scope);
    this.initOrder.push(key);
  }

  /**
   * Register existing singleton
   */
  register(key: string, instance: any, version: string = "unknown"): void {
    const scope: SingletonScope = {
      instance,
      version,
      module: key,
    };

    this.singletons.set(key, scope);

    if (!this.initOrder.includes(key)) {
      this.initOrder.push(key);
    }
  }

  /**
   * Unregister singleton
   */
  unregister(key: string): boolean {
    this.initOrder = this.initOrder.filter(k => k !== key);
    return this.singletons.delete(key);
  }

  /**
   * Get singleton info
   */
  getInfo(key: string): SingletonScope | undefined {
    return this.singletons.get(key);
  }

  /**
   * Get singleton instance
   */
  getInstance(key: string): any | undefined {
    return this.singletons.get(key)?.instance;
  }

  /**
   * Check if singleton exists
   */
  has(key: string): boolean {
    return this.singletons.has(key);
  }

  /**
   * Check if singleton is initializing
   */
  isInitializing(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get all singleton keys
   */
  keys(): string[] {
    return Array.from(this.singletons.keys());
  }

  /**
   * Get all singletons
   */
  getAll(): Map<string, SingletonScope> {
    return new Map(this.singletons);
  }

  /**
   * Get initialization order
   */
  getInitOrder(): string[] {
    return [...this.initOrder];
  }

  /**
   * Get singleton count
   */
  count(): number {
    return this.singletons.size;
  }

  /**
   * Validate singleton compatibility
   */
  validate(
    key: string,
    version: string
  ): {
    compatible: boolean;
    reason?: string;
  } {
    const existing = this.singletons.get(key);

    if (!existing) {
      return { compatible: true };
    }

    if (existing.version === version) {
      return { compatible: true };
    }

    // Check major version compatibility
    const existingMajor = existing.version.split(".")[0];
    const newMajor = version.split(".")[0];

    if (existingMajor === newMajor) {
      return { compatible: true };
    }

    return {
      compatible: false,
      reason: `Version mismatch: existing ${existing.version}, requested ${version}`,
    };
  }

  /**
   * Reset singleton
   */
  async reset(
    key: string,
    factory: () => Promise<any>,
    version: string
  ): Promise<any> {
    this.unregister(key);
    return this.get(key, factory, version);
  }

  /**
   * Clear all singletons
   */
  clear(): void {
    this.singletons.clear();
    this.initOrder = [];
    this.pending.clear();
  }

  /**
   * Get pending initializations
   */
  getPending(): string[] {
    return Array.from(this.pending.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCount: number;
    pendingCount: number;
    initOrder: string[];
  } {
    return {
      totalCount: this.singletons.size,
      pendingCount: this.pending.size,
      initOrder: [...this.initOrder],
    };
  }

  /**
   * Export singletons state
   */
  export(): Array<[string, SingletonScope]> {
    return Array.from(this.singletons.entries());
  }

  /**
   * Import singletons state
   */
  import(singletons: Array<[string, SingletonScope]>): void {
    for (const [key, scope] of singletons) {
      this.register(key, scope.instance, scope.version);
    }
  }

  /**
   * Create factory wrapper that ensures singleton
   */
  createSingletonFactory<T>(
    key: string,
    factory: () => T,
    version: string = "unknown"
  ): () => T {
    return () => {
      const existing = this.singletons.get(key);
      if (existing) {
        return existing.instance as T;
      }

      const instance = factory();
      this.register(key, instance, version);

      return instance;
    };
  }

  /**
   * Create async factory wrapper that ensures singleton
   */
  createAsyncSingletonFactory<T>(
    key: string,
    factory: () => Promise<T>,
    version: string = "unknown"
  ): () => Promise<T> {
    return () => this.get(key, factory, version);
  }

  /**
   * Get singleton by initialization index
   */
  getByInitOrder(index: number): SingletonScope | undefined {
    const key = this.initOrder[index];
    return key ? this.singletons.get(key) : undefined;
  }

  /**
   * Get initialization index for key
   */
  getInitIndex(key: string): number {
    return this.initOrder.indexOf(key);
  }

  /**
   * Check if key was initialized before another
   */
  isInitializedBefore(key1: string, key2: string): boolean {
    const idx1 = this.getInitIndex(key1);
    const idx2 = this.getInitIndex(key2);

    return idx1 !== -1 && idx2 !== -1 && idx1 < idx2;
  }
}
