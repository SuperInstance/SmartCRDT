/**
 * HMRHandler - Hot Module Reload handler
 * Handle HMR updates for federated modules
 */

import type { HMRConfig, ModuleInfo } from "../types.js";

export class HMRHandler {
  private config: HMRConfig;
  private listeners: Map<string, Set<() => void>> = new Map();
  private overlays: Map<string, ErrorOverlay> = new Map();

  constructor(config: Partial<HMRConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      overlay: config.overlay ?? true,
      port: config.port || 3579,
    };

    if (this.config.enabled) {
      this.setupWebSocket();
    }
  }

  /**
   * Setup WebSocket connection for HMR
   */
  private setupWebSocket(): void {
    const wsUrl = `ws://localhost:${this.config.port}/hmr`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = event => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "update":
            this.handleUpdate(data.module);
            break;
          case "error":
            this.handleError(data.error);
            break;
          case "full-reload":
            this.handleFullReload();
            break;
        }
      };

      ws.onclose = () => {
        // Attempt reconnection
        setTimeout(() => this.setupWebSocket(), 3000);
      };
    } catch (error) {
      console.warn("Failed to connect HMR WebSocket:", error);
    }
  }

  /**
   * Handle module update
   */
  private handleUpdate(moduleId: string): void {
    console.log(`HMR update: ${moduleId}`);

    // Notify listeners
    const callbacks = this.listeners.get(moduleId);
    if (callbacks) {
      for (const callback of callbacks) {
        callback();
      }
    }

    // Update overlays
    this.overlays.delete(moduleId);
    this.removeOverlay();
  }

  /**
   * Handle error
   */
  private handleError(error: any): void {
    console.error("HMR error:", error);

    if (this.config.overlay) {
      this.showErrorOverlay(error);
    }
  }

  /**
   * Handle full reload
   */
  private handleFullReload(): void {
    console.log("HMR full reload");
    window.location.reload();
  }

  /**
   * Subscribe to module updates
   */
  subscribe(moduleId: string, callback: () => void): () => void {
    if (!this.listeners.has(moduleId)) {
      this.listeners.set(moduleId, new Set());
    }

    this.listeners.get(moduleId)!.add(callback);

    return () => {
      this.listeners.get(moduleId)?.delete(callback);
    };
  }

  /**
   * Show error overlay
   */
  private showErrorOverlay(error: any): void {
    const overlay = this.createErrorOverlay(error);
    document.body.appendChild(overlay);
    this.overlays.set("global", overlay);
  }

  /**
   * Create error overlay element
   */
  private createErrorOverlay(error: any): HTMLElement {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      z-index: 999999;
      overflow: auto;
      font-family: monospace;
    `;

    const content = document.createElement("div");
    content.style.cssText = `
      max-width: 800px;
      margin: 50px auto;
      background: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
    `;

    const title = document.createElement("h2");
    title.textContent = "Module Federation Error";
    title.style.color = "#f48771";

    const message = document.createElement("pre");
    message.textContent = error.message || error.toString();
    message.style.whiteSpace = "pre-wrap";

    const dismiss = document.createElement("button");
    dismiss.textContent = "Dismiss";
    dismiss.style.cssText = `
      margin-top: 20px;
      padding: 10px 20px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    dismiss.onclick = () => this.removeOverlay();

    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(dismiss);
    overlay.appendChild(content);

    return overlay;
  }

  /**
   * Remove error overlay
   */
  private removeOverlay(): void {
    for (const overlay of this.overlays.values()) {
      overlay.remove();
    }
    this.overlays.clear();
  }

  /**
   * Trigger manual reload for a module
   */
  async reloadModule(moduleId: string): Promise<void> {
    console.log(`Manual reload: ${moduleId}`);

    // Send reload request
    try {
      await fetch(`http://localhost:${this.config.port}/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleId }),
      });
    } catch (error) {
      console.warn("Failed to trigger reload:", error);
    }
  }

  /**
   * Get config
   */
  getConfig(): HMRConfig {
    return { ...this.config };
  }

  /**
   * Is HMR enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Error overlay
 */
interface ErrorOverlay {
  remove: () => void;
}
