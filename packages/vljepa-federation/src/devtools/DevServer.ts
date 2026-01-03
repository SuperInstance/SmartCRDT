/**
 * DevServer - Development server for module federation
 * Local development with hot module reload
 */

import type { DevServerConfig, ModuleInfo } from "../types.js";

export class FederationDevServer {
  private config: DevServerConfig;
  private modules: Map<string, ModuleInfo> = new Map();
  private watchers: Set<FileSystemWatcher> = new Set();
  private running: boolean = false;

  constructor(config: Partial<DevServerConfig> = {}) {
    this.config = {
      port: config.port || 3579,
      hot: config.hot ?? true,
      allowedHosts: config.allowedHosts || ["localhost", "127.0.0.1"],
      headers: config.headers || {},
    };
  }

  /**
   * Start the dev server
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    console.log(`Starting federation dev server on port ${this.config.port}`);

    // Start file watchers
    for (const module of this.modules.values()) {
      const watcher = new FileSystemWatcher(module.url, 1000);
      watcher.on("change", () => {
        this.onModuleChanged(module);
      });
      this.watchers.add(watcher);
      watcher.start();
    }

    this.running = true;
  }

  /**
   * Stop the dev server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log("Stopping federation dev server");

    for (const watcher of this.watchers) {
      watcher.stop();
    }

    this.watchers.clear();
    this.running = false;
  }

  /**
   * Register a module for development
   */
  registerModule(module: ModuleInfo): void {
    this.modules.set(module.id, module);
  }

  /**
   * Unregister a module
   */
  unregisterModule(moduleId: string): void {
    this.modules.delete(moduleId);
  }

  /**
   * Handle module change
   */
  private onModuleChanged(module: ModuleInfo): void {
    console.log(`Module changed: ${module.name}`);

    if (this.config.hot) {
      this.reloadModule(module);
    }
  }

  /**
   * Reload a module
   */
  private reloadModule(module: ModuleInfo): void {
    // Trigger HMR
    if (typeof window !== "undefined" && (window as any).$hmr$) {
      (window as any).$hmr$.emit("federation:reload", {
        module: module.id,
      });
    }
  }

  /**
   * Get registered modules
   */
  getModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get module by ID
   */
  getModule(id: string): ModuleInfo | undefined {
    return this.modules.get(id);
  }

  /**
   * Get config
   */
  getConfig(): DevServerConfig {
    return { ...this.config };
  }

  /**
   * Is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Simple file system watcher
 */
class FileSystemWatcher {
  private interval: number | null = null;
  private callbacks: Set<() => void> = new Set();
  private lastHash: string = "";

  constructor(
    private url: string,
    private checkInterval: number
  ) {}

  on(event: "change", callback: () => void): void {
    this.callbacks.add(callback);
  }

  start(): void {
    this.fetchHash().then(hash => {
      this.lastHash = hash;
      this.interval = window.setInterval(async () => {
        const hash = await this.fetchHash();
        if (hash !== this.lastHash) {
          this.lastHash = hash;
          for (const callback of this.callbacks) {
            callback();
          }
        }
      }, this.checkInterval);
    });
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async fetchHash(): Promise<string> {
    try {
      const response = await fetch(this.url, { method: "HEAD" });
      const etag = response.headers.get("etag");
      return etag || Date.now().toString();
    } catch {
      return Date.now().toString();
    }
  }
}
