/**
 * FederationRemote - Exposes modules to host
 * Remote application that provides modules to host applications
 */

import type {
  FederationConfig,
  Expose,
  ModuleInfo,
  SharedDependency,
  FederationContainer,
  FederationError,
} from "../types.js";

export class FederationRemote {
  private config: FederationConfig;
  private exposes: Map<string, Expose> = new Map();
  private modules: Map<string, any> = new Map();
  private sharedDeps: Map<string, SharedDependency> = new Map();
  private initialized: boolean = false;
  private shareScope: string = "default";

  constructor(config: FederationConfig) {
    this.config = config;
    this.initializeExposes();
    this.initializeShared();
  }

  /**
   * Initialize exposed modules
   */
  private initializeExposes(): void {
    for (const expose of this.config.exposes) {
      this.exposes.set(expose.name, expose);
    }
  }

  /**
   * Initialize shared dependencies
   */
  private initializeShared(): void {
    for (const dep of this.config.shared) {
      this.sharedDeps.set(dep.key, dep);
    }
  }

  /**
   * Initialize the remote
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register shared dependencies
    this.registerSharedDependencies();

    // Initialize container
    this.initializeContainer();

    this.initialized = true;
  }

  /**
   * Register shared dependencies
   */
  private registerSharedDependencies(): void {
    const sharedScope = this.getSharedScope();

    for (const [key, dep] of this.sharedDeps) {
      try {
        const module = this.resolveDependency(key);
        if (module) {
          sharedScope.register(key, module);
        }
      } catch (error) {
        console.warn(`Failed to register shared dependency ${key}:`, error);
      }
    }
  }

  /**
   * Get or create shared scope
   */
  private getSharedScope(): any {
    const scopeKey = `__webpack_share_scopes__${this.shareScope}`;
    if (!(globalThis as any)[scopeKey]) {
      (globalThis as any)[scopeKey] = {};
    }
    return (globalThis as any)[scopeKey];
  }

  /**
   * Resolve a dependency
   */
  private resolveDependency(key: string): any {
    // Try to require from global
    if ((globalThis as any)[key]) {
      return (globalThis as any)[key];
    }

    // Try dynamic import
    try {
      // This would typically be handled by webpack/module-federation
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Initialize container
   */
  private initializeContainer(): void {
    const container: FederationContainer = {
      init: async (shareScope: string) => {
        this.shareScope = shareScope;
        await this.initializeShared();
      },
      get: async (module: string) => {
        return this.getModuleFactory(module);
      },
    };

    // Register container globally
    const globalKey = `${this.config.name}_remote`;
    (globalThis as any)[globalKey] = container;
  }

  /**
   * Get module factory for container
   */
  private async getModuleFactory(modulePath: string): Promise<() => any> {
    const moduleName = modulePath.replace(/^\.\//, "");

    const expose = this.exposes.get(moduleName);
    if (!expose) {
      throw new FederationError(
        `Module not exposed: ${moduleName}`,
        "MODULE_NOT_EXPOSED",
        { moduleName }
      );
    }

    const module = this.modules.get(moduleName);
    if (!module) {
      throw new FederationError(
        `Module not loaded: ${moduleName}`,
        "MODULE_NOT_LOADED",
        { moduleName }
      );
    }

    return () => module;
  }

  /**
   * Expose a module
   */
  exposeModule(name: string, module: any): void {
    if (!this.exposes.has(name)) {
      throw new FederationError(
        `Module not configured for exposure: ${name}`,
        "MODULE_NOT_CONFIGURED",
        { name }
      );
    }

    this.modules.set(name, module);
  }

  /**
   * Batch expose modules
   */
  exposeModules(modules: Record<string, any>): void {
    for (const [name, module] of Object.entries(modules)) {
      this.exposeModule(name, module);
    }
  }

  /**
   * Unexpose a module
   */
  unexposeModule(name: string): void {
    this.modules.delete(name);
  }

  /**
   * Get exposed module
   */
  getExposedModule(name: string): any | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all exposed modules
   */
  getAllExposedModules(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, module] of this.modules) {
      result[name] = module;
    }
    return result;
  }

  /**
   * Get exposed module info
   */
  getExposedModuleInfo(name: string): ModuleInfo | undefined {
    const expose = this.exposes.get(name);
    if (!expose || !this.modules.has(name)) {
      return undefined;
    }

    return {
      id: `${this.config.name}/${name}`,
      name,
      version: this.config.version,
      url: expose.import,
      loaded: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all exposed modules info
   */
  getAllExposedModulesInfo(): ModuleInfo[] {
    const infos: ModuleInfo[] = [];
    for (const name of this.modules.keys()) {
      const info = this.getExposedModuleInfo(name);
      if (info) {
        infos.push(info);
      }
    }
    return infos;
  }

  /**
   * Add shared dependency
   */
  addSharedDependency(dep: SharedDependency): void {
    this.sharedDeps.set(dep.key, dep);
  }

  /**
   * Remove shared dependency
   */
  removeSharedDependency(key: string): void {
    this.sharedDeps.delete(key);
  }

  /**
   * Get shared dependency
   */
  getSharedDependency(key: string): SharedDependency | undefined {
    return this.sharedDeps.get(key);
  }

  /**
   * Get all shared dependencies
   */
  getAllSharedDependencies(): SharedDependency[] {
    return Array.from(this.sharedDeps.values());
  }

  /**
   * Get remote configuration
   */
  getConfig(): FederationConfig {
    return { ...this.config };
  }

  /**
   * Get exposes
   */
  getExposes(): Expose[] {
    return Array.from(this.exposes.values());
  }

  /**
   * Set share scope
   */
  setShareScope(scope: string): void {
    this.shareScope = scope;
  }

  /**
   * Get share scope
   */
  getShareScope(): string {
    return this.shareScope;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get container global key
   */
  getContainerKey(): string {
    return `${this.config.name}_remote`;
  }

  /**
   * Generate entry URL
   */
  getEntryUrl(basePath: string = "/"): string {
    return `${basePath}${this.config.filename}`;
  }

  /**
   * Create manifest entry
   */
  createManifestEntry(basePath: string = "/"): {
    name: string;
    version: string;
    entry: string;
    exposes: string[];
    shared: Record<string, string>;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      entry: this.getEntryUrl(basePath),
      exposes: Array.from(this.exposes.keys()),
      shared: Object.fromEntries(
        Array.from(this.sharedDeps.entries()).map(([key, dep]) => [
          key,
          dep.requiredVersion,
        ])
      ),
    };
  }

  /**
   * Reset the remote
   */
  async reset(): Promise<void> {
    this.modules.clear();
    this.initialized = false;
  }
}
