/**
 * FederationHost - Consumes remote modules
 * Host application that loads and manages remote modules
 */

import type {
  FederationConfig,
  Remote,
  ModuleInfo,
  FederationContainer,
  ModuleLoadResult,
} from "../types.js";
import { FederationError } from "../types.js";

export class FederationHost {
  private config: FederationConfig;
  private remotes: Map<string, Remote> = new Map();
  private containers: Map<string, FederationContainer> = new Map();
  private loadedModules: Map<string, ModuleInfo> = new Map();
  private shareScope: string = "default";
  private initialized: boolean = false;

  constructor(config: FederationConfig) {
    this.config = config;
    this.initializeRemotes();
  }

  /**
   * Initialize remote configurations
   */
  private initializeRemotes(): void {
    for (const remote of this.config.remotes) {
      this.remotes.set(remote.name, remote);
    }
  }

  /**
   * Initialize the federation host
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load remote entry scripts
    const loadPromises = Array.from(this.remotes.values()).map(remote =>
      this.loadRemoteEntry(remote)
    );

    await Promise.allSettled(loadPromises);
    this.initialized = true;
  }

  /**
   * Load remote entry script
   */
  private async loadRemoteEntry(remote: Remote): Promise<void> {
    try {
      // Check if remote entry is already loaded
      const globalKey = `${remote.scope}_remote`;
      if ((globalThis as any)[globalKey]) {
        this.containers.set(remote.name, (globalThis as any)[globalKey]);
        return;
      }

      // Load remote entry script
      await this.loadScript(remote.entry);

      // Wait for remote container to be available
      const container = await this.waitForContainer(remote);
      this.containers.set(remote.name, container);

      // Initialize shared scope
      await container.init(this.shareScope);
    } catch (error) {
      throw new FederationError(
        `Failed to load remote entry for ${remote.name}: ${error}`,
        "REMOTE_LOAD_ERROR",
        { remote, error }
      );
    }
  }

  /**
   * Load a script dynamically
   */
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));

      document.head.appendChild(script);
    });
  }

  /**
   * Wait for remote container to be available
   */
  private async waitForContainer(
    remote: Remote,
    timeout: number = 5000
  ): Promise<FederationContainer> {
    const start = Date.now();
    const globalKey = `${remote.scope}_remote`;

    while (Date.now() - start < timeout) {
      const container = (globalThis as any)[globalKey];
      if (container) {
        return container;
      }
      await this.delay(50);
    }

    throw new Error(
      `Timeout waiting for container ${remote.name} (${globalKey})`
    );
  }

  /**
   * Load a module from a remote
   */
  async loadModule(
    remoteName: string,
    moduleName: string
  ): Promise<ModuleLoadResult> {
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    const container = this.containers.get(remoteName);
    if (!container) {
      throw new FederationError(
        `Remote container not found: ${remoteName}`,
        "CONTAINER_NOT_FOUND",
        { remoteName }
      );
    }

    try {
      // Load module from container
      const factory = await container.get(`./${moduleName}`);
      const module = factory();

      const moduleKey = `${remoteName}/${moduleName}`;
      const moduleInfo: ModuleInfo = {
        id: moduleKey,
        name: moduleName,
        version: this.remotes.get(remoteName)?.version || "unknown",
        url: this.remotes.get(remoteName)?.entry || "",
        loaded: true,
        timestamp: Date.now(),
      };

      this.loadedModules.set(moduleKey, moduleInfo);

      return {
        module,
        version: moduleInfo.version,
        loadTime: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      throw new FederationError(
        `Failed to load module ${moduleName} from ${remoteName}: ${error}`,
        "MODULE_LOAD_ERROR",
        { remoteName, moduleName, error }
      );
    }
  }

  /**
   * Preload multiple modules
   */
  async preloadModules(
    requests: Array<{ remote: string; module: string }>
  ): Promise<Map<string, ModuleLoadResult>> {
    const results = new Map<string, ModuleLoadResult>();

    await Promise.allSettled(
      requests.map(async ({ remote, module }) => {
        try {
          const result = await this.loadModule(remote, module);
          results.set(`${remote}/${module}`, result);
        } catch (error) {
          // Log error but continue with other modules
          console.warn(`Failed to preload ${remote}/${module}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Check if a module is loaded
   */
  isModuleLoaded(remoteName: string, moduleName: string): boolean {
    const moduleKey = `${remoteName}/${moduleName}`;
    return this.loadedModules.has(moduleKey);
  }

  /**
   * Get loaded module info
   */
  getModuleInfo(
    remoteName: string,
    moduleName: string
  ): ModuleInfo | undefined {
    const moduleKey = `${remoteName}/${moduleName}`;
    return this.loadedModules.get(moduleKey);
  }

  /**
   * Get all loaded modules
   */
  getAllLoadedModules(): ModuleInfo[] {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Unload a module
   */
  async unloadModule(remoteName: string, moduleName: string): Promise<void> {
    const moduleKey = `${remoteName}/${moduleName}`;
    this.loadedModules.delete(moduleKey);
  }

  /**
   * Clear all loaded modules
   */
  async clearModules(): Promise<void> {
    this.loadedModules.clear();
  }

  /**
   * Get host configuration
   */
  getConfig(): FederationConfig {
    return { ...this.config };
  }

  /**
   * Get remote info
   */
  getRemote(name: string): Remote | undefined {
    return this.remotes.get(name);
  }

  /**
   * Get all remotes
   */
  getAllRemotes(): Remote[] {
    return Array.from(this.remotes.values());
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
   * Reset the host
   */
  async reset(): Promise<void> {
    await this.clearModules();
    this.containers.clear();
    this.initialized = false;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
