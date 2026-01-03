/**
 * ModuleRegistry - Registry for loaded modules
 * Track and manage module instances
 */

import type { ModuleInfo, RegistryEntry } from "../types.js";

export class ModuleRegistry {
  private entries: Map<string, RegistryEntry> = new Map();
  private byName: Map<string, Set<string>> = new Map();
  private byVersion: Map<string, Set<string>> = new Map();

  constructor() {
    // Initialize
  }

  /**
   * Register a module
   */
  register(moduleInfo: ModuleInfo, instance: any): void {
    const entry: RegistryEntry = {
      module: moduleInfo,
      instance,
      loadedAt: Date.now(),
      accessedAt: Date.now(),
    };

    this.entries.set(moduleInfo.id, entry);

    // Index by name
    if (!this.byName.has(moduleInfo.name)) {
      this.byName.set(moduleInfo.name, new Set());
    }
    this.byName.get(moduleInfo.name)!.add(moduleInfo.id);

    // Index by version
    if (!this.byVersion.has(moduleInfo.version)) {
      this.byVersion.set(moduleInfo.version, new Set());
    }
    this.byVersion.get(moduleInfo.version)!.add(moduleInfo.id);
  }

  /**
   * Unregister a module
   */
  unregister(moduleId: string): void {
    const entry = this.entries.get(moduleId);
    if (!entry) {
      return;
    }

    // Remove from name index
    const nameSet = this.byName.get(entry.module.name);
    if (nameSet) {
      nameSet.delete(moduleId);
      if (nameSet.size === 0) {
        this.byName.delete(entry.module.name);
      }
    }

    // Remove from version index
    const versionSet = this.byVersion.get(entry.module.version);
    if (versionSet) {
      versionSet.delete(moduleId);
      if (versionSet.size === 0) {
        this.byVersion.delete(entry.module.version);
      }
    }

    // Remove entry
    this.entries.delete(moduleId);
  }

  /**
   * Get module entry
   */
  get(moduleId: string): RegistryEntry | undefined {
    const entry = this.entries.get(moduleId);
    if (entry) {
      entry.accessedAt = Date.now();
    }
    return entry;
  }

  /**
   * Get module instance
   */
  getInstance(moduleId: string): any | undefined {
    return this.get(moduleId)?.instance;
  }

  /**
   * Get module info
   */
  getModuleInfo(moduleId: string): ModuleInfo | undefined {
    return this.get(moduleId)?.module;
  }

  /**
   * Find modules by name
   */
  findByName(name: string): RegistryEntry[] {
    const ids = this.byName.get(name) || new Set();
    const results: RegistryEntry[] = [];

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry) {
        results.push(entry);
      }
    }

    return results.sort((a, b) => b.loadedAt - a.loadedAt);
  }

  /**
   * Find modules by version
   */
  findByVersion(version: string): RegistryEntry[] {
    const ids = this.byVersion.get(version) || new Set();
    const results: RegistryEntry[] = [];

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get latest version of a module
   */
  getLatestVersion(name: string): RegistryEntry | undefined {
    const entries = this.findByName(name);
    if (entries.length === 0) {
      return undefined;
    }

    // Sort by version (descending) and load time
    return entries.sort((a, b) => {
      const versionCompare = this.compareVersions(
        b.module.version,
        a.module.version
      );
      if (versionCompare !== 0) {
        return versionCompare;
      }
      return b.loadedAt - a.loadedAt;
    })[0];
  }

  /**
   * List all registered modules
   */
  listAll(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * List all module names
   */
  listNames(): string[] {
    return Array.from(this.byName.keys());
  }

  /**
   * List all versions
   */
  listVersions(): string[] {
    return Array.from(this.byVersion.keys());
  }

  /**
   * Count registered modules
   */
  count(): number {
    return this.entries.size;
  }

  /**
   * Check if module is registered
   */
  has(moduleId: string): boolean {
    return this.entries.has(moduleId);
  }

  /**
   * Update access time
   */
  updateAccess(moduleId: string): void {
    const entry = this.entries.get(moduleId);
    if (entry) {
      entry.accessedAt = Date.now();
    }
  }

  /**
   * Get stale modules (not accessed recently)
   */
  getStaleModules(maxAge: number): RegistryEntry[] {
    const now = Date.now();
    const stale: RegistryEntry[] = [];

    for (const entry of this.entries.values()) {
      if (now - entry.accessedAt > maxAge) {
        stale.push(entry);
      }
    }

    return stale;
  }

  /**
   * Clear stale modules
   */
  clearStaleModules(maxAge: number): void {
    const stale = this.getStaleModules(maxAge);
    for (const entry of stale) {
      this.unregister(entry.module.id);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalModules: number;
    totalNames: number;
    totalVersions: number;
    oldestModule?: RegistryEntry;
    newestModule?: RegistryEntry;
    leastAccessed?: RegistryEntry;
    mostAccessed?: RegistryEntry;
  } {
    const entries = Array.from(this.entries.values());

    if (entries.length === 0) {
      return {
        totalModules: 0,
        totalNames: 0,
        totalVersions: 0,
      };
    }

    const sortedByLoaded = [...entries].sort((a, b) => a.loadedAt - b.loadedAt);
    const sortedByAccessed = [...entries].sort(
      (a, b) => a.accessedAt - b.accessedAt
    );

    return {
      totalModules: entries.length,
      totalNames: this.byName.size,
      totalVersions: this.byVersion.size,
      oldestModule: sortedByLoaded[0],
      newestModule: sortedByLoaded[sortedByLoaded.length - 1],
      leastAccessed: sortedByAccessed[0],
      mostAccessed: sortedByAccessed[sortedByAccessed.length - 1],
    };
  }

  /**
   * Export registry
   */
  export(): {
    entries: Array<[string, RegistryEntry]>;
    stats: ReturnType<typeof this.getStats>;
  } {
    return {
      entries: Array.from(this.entries.entries()),
      stats: this.getStats(),
    };
  }

  /**
   * Import registry entries
   */
  import(entries: Array<[string, RegistryEntry]>): void {
    for (const [id, entry] of entries) {
      this.register(entry.module, entry.instance);
    }
  }

  /**
   * Clear all modules
   */
  clear(): void {
    this.entries.clear();
    this.byName.clear();
    this.byVersion.clear();
  }

  /**
   * Compare two version strings
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }
}
