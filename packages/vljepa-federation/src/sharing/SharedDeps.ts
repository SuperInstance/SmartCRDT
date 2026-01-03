/**
 * SharedDeps - Manage shared dependencies across modules
 * Shared singleton instances of React, VL-JEPA, etc.
 */

import type { SharedConfig, SharedDep, SingletonScope } from "../types.js";

export class SharedDeps {
  private config: SharedConfig;
  private singletons: Map<string, SingletonScope> = new Map();
  private scopes: Map<string, Map<string, any>> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<SharedConfig> = {}) {
    this.config = {
      dependencies: config.dependencies || {},
      singleton: config.singleton ?? true,
      strictVersion: config.strictVersion ?? false,
      requiredVersion: config.requiredVersion || "*",
    };
  }

  /**
   * Initialize shared dependencies
   */
  async init(shareScope: string = "default"): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create share scope
    if (!this.scopes.has(shareScope)) {
      this.scopes.set(shareScope, new Map());
    }

    // Initialize shared dependencies
    await this.initializeShared(shareScope);

    this.initialized = true;
  }

  /**
   * Initialize shared dependencies in scope
   */
  private async initializeShared(shareScope: string): Promise<void> {
    const scope = this.scopes.get(shareScope);
    if (!scope) {
      return;
    }

    for (const [key, dep] of Object.entries(this.config.dependencies)) {
      try {
        const instance = await this.resolveDependency(key, dep);
        if (instance) {
          scope.set(key, instance);

          if (dep.singleton) {
            this.singletons.set(key, {
              instance,
              version: dep.requiredVersion,
              module: key,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to initialize shared dependency ${key}:`, error);
      }
    }
  }

  /**
   * Resolve a dependency
   */
  private async resolveDependency(key: string, dep: SharedDep): Promise<any> {
    // Try globalThis first (for bundled dependencies)
    if ((globalThis as any)[key]) {
      return (globalThis as any)[key];
    }

    // Try to import (would need dynamic import support)
    try {
      // This is a placeholder - real implementation would use dynamic imports
      // const module = await import(key);
      // return module.default || module;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Register a shared dependency
   */
  register(key: string, instance: any, version: string = "unknown"): void {
    for (const scope of this.scopes.values()) {
      scope.set(key, instance);
    }

    const dep = this.config.dependencies[key];
    if (dep?.singleton) {
      this.singletons.set(key, {
        instance,
        version,
        module: key,
      });
    }
  }

  /**
   * Get a shared dependency
   */
  get(key: string, shareScope: string = "default"): any | undefined {
    const scope = this.scopes.get(shareScope);
    return scope?.get(key);
  }

  /**
   * Get singleton instance
   */
  getSingleton(key: string): SingletonScope | undefined {
    return this.singletons.get(key);
  }

  /**
   * Check if dependency is shared
   */
  isShared(key: string): boolean {
    return key in this.config.dependencies;
  }

  /**
   * Check if dependency is singleton
   */
  isSingleton(key: string): boolean {
    return this.config.dependencies[key]?.singleton ?? false;
  }

  /**
   * Add shared dependency
   */
  addShared(key: string, dep: SharedDep): void {
    this.config.dependencies[key] = dep;
  }

  /**
   * Remove shared dependency
   */
  removeShared(key: string): void {
    delete this.config.dependencies[key];
    this.singletons.delete(key);

    for (const scope of this.scopes.values()) {
      scope.delete(key);
    }
  }

  /**
   * Get all shared dependencies
   */
  getAllShared(): Record<string, SharedDep> {
    return { ...this.config.dependencies };
  }

  /**
   * Get all singletons
   */
  getAllSingletons(): Map<string, SingletonScope> {
    return new Map(this.singletons);
  }

  /**
   * Create share scope
   */
  createScope(name: string): void {
    if (!this.scopes.has(name)) {
      this.scopes.set(name, new Map());
    }
  }

  /**
   * Get share scope
   */
  getScope(name: string): Map<string, any> | undefined {
    return this.scopes.get(name);
  }

  /**
   * Get all scope names
   */
  getScopeNames(): string[] {
    return Array.from(this.scopes.keys());
  }

  /**
   * Share module between scopes
   */
  shareModule(
    key: string,
    instance: any,
    fromScope: string,
    toScope: string
  ): void {
    const from = this.scopes.get(fromScope);
    const to = this.scopes.get(toScope);

    if (from && to) {
      to.set(key, from.get(key) || instance);
    }
  }

  /**
   * Export shared configuration
   */
  exportConfig(): SharedConfig {
    return {
      dependencies: { ...this.config.dependencies },
      singleton: this.config.singleton,
      strictVersion: this.config.strictVersion,
      requiredVersion: this.config.requiredVersion,
    };
  }

  /**
   * Import shared configuration
   */
  importConfig(config: SharedConfig): void {
    this.config = { ...config };
  }

  /**
   * Get config
   */
  getConfig(): SharedConfig {
    return { ...this.config };
  }

  /**
   * Is initialized
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Reset
   */
  reset(): void {
    this.singletons.clear();
    this.scopes.clear();
    this.initialized = false;
  }
}

/**
 * Default shared dependencies for VL-JEPA
 */
export function createDefaultSharedDeps(): SharedConfig {
  return {
    dependencies: {
      react: {
        requiredVersion: "^18.0.0",
        strictVersion: false,
        singleton: true,
      },
      "react-dom": {
        requiredVersion: "^18.0.0",
        strictVersion: false,
        singleton: true,
      },
      "@lsi/vljepa": {
        requiredVersion: "^1.0.0",
        strictVersion: false,
        singleton: false,
      },
      "@lsi/protocol": {
        requiredVersion: "^1.0.0",
        strictVersion: true,
        singleton: true,
      },
    },
    singleton: true,
    strictVersion: false,
    requiredVersion: "*",
  };
}
