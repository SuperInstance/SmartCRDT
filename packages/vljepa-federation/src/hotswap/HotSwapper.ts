/**
 * HotSwapper - Hot-swap modules with state preservation
 * Enables seamless module updates without page refresh
 */

import type {
  HotSwapConfig,
  HotSwapResult,
  ModuleInfo,
  StateContainer,
  SwapStrategy,
} from "../types.js";

export class HotSwapper {
  private config: HotSwapConfig;
  private states: Map<string, StateContainer> = new Map();
  private watchers: Map<string, FileSystemWatcher> = new Map();
  private swapHistory: HotSwapResult[] = [];
  private activeSwaps: Set<string> = new Set();

  constructor(config: Partial<HotSwapConfig> = {}) {
    this.config = {
      watchFiles: config.watchFiles ?? true,
      checkInterval: config.checkInterval ?? 1000,
      preserveState: config.preserveState ?? true,
      transition: config.transition ?? "fade",
      rollbackOnError: config.rollbackOnError ?? true,
    };
  }

  /**
   * Hot swap a module
   */
  async swapModule(
    oldModule: ModuleInfo,
    newModuleFactory: () => Promise<any>,
    containerElement?: HTMLElement
  ): Promise<HotSwapResult> {
    const startTime = Date.now();
    const moduleKey = oldModule.id;

    // Check if already swapping
    if (this.activeSwaps.has(moduleKey)) {
      throw new Error(`Module ${moduleKey} is already being swapped`);
    }

    this.activeSwaps.add(moduleKey);

    try {
      // Capture state if enabled
      let capturedState: StateContainer | undefined;
      if (this.config.preserveState) {
        capturedState = this.captureState(oldModule);
      }

      // Load new module
      const newModule = await newModuleFactory();
      const newModuleInfo: ModuleInfo = {
        ...oldModule,
        version: newModule.version || "unknown",
        timestamp: Date.now(),
      };

      // Apply transition
      if (containerElement) {
        await this.applyTransition(containerElement, oldModule, newModuleInfo);
      }

      // Restore state if enabled
      if (this.config.preserveState && capturedState) {
        this.restoreState(newModuleInfo, capturedState);
      }

      const result: HotSwapResult = {
        success: true,
        oldModule,
        newModule: newModuleInfo,
        statePreserved: !!capturedState,
        transitionTime: Date.now() - startTime,
      };

      this.swapHistory.push(result);
      this.activeSwaps.delete(moduleKey);

      return result;
    } catch (error) {
      this.activeSwaps.delete(moduleKey);

      // Rollback on error if enabled
      if (this.config.rollbackOnError) {
        await this.rollback(oldModule, containerElement);
      }

      const result: HotSwapResult = {
        success: false,
        oldModule,
        newModule: oldModule,
        statePreserved: false,
        transitionTime: Date.now() - startTime,
      };

      this.swapHistory.push(result);

      throw new Error(`Hot swap failed: ${error}`);
    }
  }

  /**
   * Capture state from module
   */
  private captureState(module: ModuleInfo): StateContainer | undefined {
    try {
      // Try to get state from module
      const moduleElement = document.querySelector(
        `[data-module="${module.id}"]`
      );
      if (!moduleElement) {
        return undefined;
      }

      // Capture various state sources
      const state: Record<string, any> = {};

      // Form state
      const forms = moduleElement.querySelectorAll("form");
      state.forms = Array.from(forms).map(form => ({
        action: form.action,
        method: form.method,
        data: new FormData(form),
      }));

      // Input values
      const inputs = moduleElement.querySelectorAll("input, textarea, select");
      state.inputs = Array.from(inputs).map(input => ({
        name: input.getAttribute("name"),
        value: (input as HTMLInputElement).value,
        checked: (input as HTMLInputElement).checked,
      }));

      // Scroll position
      state.scrollPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };

      // Custom data attributes
      state.data = {};
      for (const { name, value } of Array.from(moduleElement.attributes)) {
        if (name.startsWith("data-state-")) {
          state.data[name.replace("data-state-", "")] = value;
        }
      }

      return {
        module: module.id,
        state,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn("Failed to capture state:", error);
      return undefined;
    }
  }

  /**
   * Restore state to module
   */
  private restoreState(module: ModuleInfo, container: StateContainer): boolean {
    try {
      const moduleElement = document.querySelector(
        `[data-module="${module.id}"]`
      );
      if (!moduleElement) {
        return false;
      }

      const { state } = container;

      // Restore forms
      if (state.forms) {
        for (const formData of state.forms) {
          const form = moduleElement.querySelector(
            `form[action="${formData.action}"]`
          );
          if (form) {
            // Form data restoration would go here
          }
        }
      }

      // Restore inputs
      if (state.inputs) {
        for (const input of state.inputs) {
          const element = moduleElement.querySelector(
            `[name="${input.name}"]`
          ) as HTMLInputElement;
          if (element) {
            element.value = input.value;
            if (input.checked !== undefined) {
              element.checked = input.checked;
            }
          }
        }
      }

      // Restore scroll position
      if (state.scrollPosition) {
        window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
      }

      // Restore custom data
      if (state.data) {
        for (const [key, value] of Object.entries(state.data)) {
          moduleElement.setAttribute(`data-state-${key}`, String(value));
        }
      }

      return true;
    } catch (error) {
      console.warn("Failed to restore state:", error);
      return false;
    }
  }

  /**
   * Apply transition effect
   */
  private async applyTransition(
    container: HTMLElement,
    oldModule: ModuleInfo,
    newModule: ModuleInfo
  ): Promise<void> {
    switch (this.config.transition) {
      case "instant":
        // No transition
        break;

      case "fade":
        await this.fadeTransition(container);
        break;

      case "slide":
        await this.slideTransition(container);
        break;
    }
  }

  /**
   * Fade transition
   */
  private async fadeTransition(container: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      container.style.transition = "opacity 0.3s ease";
      container.style.opacity = "0";

      setTimeout(() => {
        container.style.opacity = "1";
        setTimeout(resolve, 300);
      }, 50);
    });
  }

  /**
   * Slide transition
   */
  private async slideTransition(container: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      container.style.transition = "transform 0.3s ease";
      container.style.transform = "translateX(-100%)";

      setTimeout(() => {
        container.style.transform = "translateX(0)";
        setTimeout(resolve, 300);
      }, 50);
    });
  }

  /**
   * Rollback to old module
   */
  private async rollback(
    module: ModuleInfo,
    container?: HTMLElement
  ): Promise<void> {
    console.warn(`Rolling back module ${module.id}`);

    // Revert any changes made during swap
    if (container && this.config.transition !== "instant") {
      await this.applyTransition(module, module, module);
    }
  }

  /**
   * Start watching a module for changes
   */
  startWatching(
    module: ModuleInfo,
    onChange: (module: ModuleInfo) => void
  ): void {
    if (!this.config.watchFiles) {
      return;
    }

    const watcher = new FileSystemWatcher(
      module.url,
      this.config.checkInterval
    );
    watcher.on("change", () => {
      onChange(module);
    });

    this.watchers.set(module.id, watcher);
    watcher.start();
  }

  /**
   * Stop watching a module
   */
  stopWatching(moduleId: string): void {
    const watcher = this.watchers.get(moduleId);
    if (watcher) {
      watcher.stop();
      this.watchers.delete(moduleId);
    }
  }

  /**
   * Stop all watchers
   */
  stopAllWatching(): void {
    for (const watcher of this.watchers.values()) {
      watcher.stop();
    }
    this.watchers.clear();
  }

  /**
   * Get swap history
   */
  getSwapHistory(): HotSwapResult[] {
    return [...this.swapHistory];
  }

  /**
   * Clear swap history
   */
  clearSwapHistory(): void {
    this.swapHistory = [];
  }

  /**
   * Get active swaps
   */
  getActiveSwaps(): string[] {
    return Array.from(this.activeSwaps);
  }

  /**
   * Get captured states
   */
  getCapturedStates(): StateContainer[] {
    return Array.from(this.states.values());
  }

  /**
   * Clear captured states
   */
  clearStates(): void {
    this.states.clear();
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<HotSwapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): HotSwapConfig {
    return { ...this.config };
  }
}

/**
 * Simple file system watcher
 */
class FileSystemWatcher {
  private interval: number | null = null;
  private lastHash: string = "";
  private callbacks: Set<() => void> = new Set();

  constructor(
    private url: string,
    private checkInterval: number
  ) {}

  on(event: "change", callback: () => void): void {
    this.callbacks.add(callback);
  }

  off(event: "change", callback: () => void): void {
    this.callbacks.delete(callback);
  }

  async start(): Promise<void> {
    this.lastHash = await this.fetchHash();

    this.interval = window.setInterval(async () => {
      const hash = await this.fetchHash();
      if (hash !== this.lastHash) {
        this.lastHash = hash;
        for (const callback of this.callbacks) {
          callback();
        }
      }
    }, this.checkInterval);
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
      const lastModified = response.headers.get("last-modified");
      return etag || lastModified || Date.now().toString();
    } catch {
      return Date.now().toString();
    }
  }
}
