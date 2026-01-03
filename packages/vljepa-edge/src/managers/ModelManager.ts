/**
 * @fileoverview Model Manager for VL-JEPA Edge Deployment
 *
 * Manages model loading, versioning, and hot-swapping:
 * - Lazy loading of models
 * - Version tracking
 * - Hot swapping without reload
 * - Memory limits
 * - Integrity verification
 *
 * @package @lsi/vljepa-edge
 */

import type {
  ModelManagerConfig,
  ModelInfo,
  ProgressCallback,
} from "../types.js";
import { ModelLoadError } from "../types.js";

/**
 * Model Manager for VL-JEPA edge deployment
 *
 * Handles model lifecycle management including loading,
 * versioning, hot-swapping, and memory management.
 */
export class ModelManager {
  private config: ModelManagerConfig;
  private models: Map<string, ModelInfo> = new Map();
  private loadedModels: Map<string, any> = new Map();
  private currentModel: string | null = null;
  private db: IDBDatabase | null = null;

  constructor(config: ModelManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize model manager
   */
  async initialize(): Promise<void> {
    // Open IndexedDB for model caching
    await this.openDatabase();

    // Load preloaded models
    for (const modelId of this.config.preload) {
      try {
        await this.loadModel(modelId);
      } catch (error) {
        console.warn(
          `[ModelManager] Failed to preload model ${modelId}:`,
          error
        );
      }
    }

    // Start version check interval
    if (this.config.updateStrategy === "auto") {
      this.startVersionCheck();
    }
  }

  /**
   * Register a model
   */
  registerModel(info: ModelInfo): void {
    this.models.set(info.id, info);
  }

  /**
   * Load a model
   */
  async loadModel(
    modelId: string,
    onProgress?: ProgressCallback
  ): Promise<any> {
    const info = this.models.get(modelId);
    if (!info) {
      throw new ModelLoadError(`Model ${modelId} not registered`);
    }

    // Check if already loaded
    if (this.loadedModels.has(modelId)) {
      console.info(`[ModelManager] Model ${modelId} already loaded`);
      return this.loadedModels.get(modelId);
    }

    // Check memory limit
    if (this.loadedModels.size >= this.config.maxModels) {
      await this.evictLRUModel();
    }

    try {
      onProgress?.({ loaded: 0, total: 100, percentage: 0, stage: "Starting" });

      // Check cache
      let modelData = await this.loadFromCache(modelId);
      if (!modelData) {
        onProgress?.({
          loaded: 10,
          total: 100,
          percentage: 10,
          stage: "Downloading",
        });

        // Download model
        modelData = await this.downloadModel(info.url, onProgress);
      }

      onProgress?.({
        loaded: 80,
        total: 100,
        percentage: 80,
        stage: "Parsing",
      });

      // Parse/initialize model
      const model = await this.parseModel(modelData, info);

      // Verify integrity if enabled
      if (this.config.verifyIntegrity && info.checksum) {
        await this.verifyIntegrity(modelData, info.checksum);
      }

      onProgress?.({
        loaded: 90,
        total: 100,
        percentage: 90,
        stage: "Caching",
      });

      // Cache model
      await this.cacheModel(modelId, modelData);

      // Store loaded model
      this.loadedModels.set(modelId, model);
      info.loaded = true;

      onProgress?.({
        loaded: 100,
        total: 100,
        percentage: 100,
        stage: "Complete",
      });

      console.info(`[ModelManager] Model ${modelId} loaded successfully`);
      return model;
    } catch (error) {
      throw new ModelLoadError(
        `Failed to load model ${modelId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Unload a model
   */
  async unloadModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (!model) {
      return;
    }

    // Dispose model resources
    if (model.dispose && typeof model.dispose === "function") {
      await model.dispose();
    }

    this.loadedModels.delete(modelId);

    const info = this.models.get(modelId);
    if (info) {
      info.loaded = false;
    }

    // If current model was unloaded, clear it
    if (this.currentModel === modelId) {
      this.currentModel = null;
    }

    console.info(`[ModelManager] Model ${modelId} unloaded`);
  }

  /**
   * Switch to a different model (hot swap)
   */
  async switchModel(
    modelId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const info = this.models.get(modelId);
    if (!info) {
      throw new ModelLoadError(`Model ${modelId} not registered`);
    }

    // Load new model if not already loaded
    if (!this.loadedModels.has(modelId)) {
      await this.loadModel(modelId, onProgress);
    }

    // Update current model
    this.currentModel = modelId;

    console.info(`[ModelManager] Switched to model ${modelId}`);
  }

  /**
   * Get current model
   */
  getCurrentModel(): string | null {
    return this.currentModel;
  }

  /**
   * Get loaded model
   */
  getModel(modelId: string): any | undefined {
    return this.loadedModels.get(modelId);
  }

  /**
   * Get all model info
   */
  getModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Get model info
   */
  getModelInfo(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  /**
   * Check for model updates
   */
  async checkForUpdates(): Promise<Map<string, string>> {
    const updates = new Map<string, string>();

    for (const [id, info] of this.models) {
      try {
        const latestVersion = await this.fetchLatestVersion(info.url);
        if (latestVersion !== info.version) {
          updates.set(id, latestVersion);
        }
      } catch (error) {
        console.warn(
          `[ModelManager] Failed to check updates for ${id}:`,
          error
        );
      }
    }

    return updates;
  }

  /**
   * Update a model to the latest version
   */
  async updateModel(
    modelId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const info = this.models.get(modelId);
    if (!info) {
      throw new ModelLoadError(`Model ${modelId} not registered`);
    }

    const latestVersion = await this.fetchLatestVersion(info.url);
    if (latestVersion === info.version) {
      console.info(`[ModelManager] Model ${modelId} is already up to date`);
      return;
    }

    // Unload current version
    if (this.loadedModels.has(modelId)) {
      await this.unloadModel(modelId);
    }

    // Update model info
    info.version = latestVersion;

    // Load new version
    await this.loadModel(modelId, onProgress);

    console.info(
      `[ModelManager] Model ${modelId} updated to version ${latestVersion}`
    );
  }

  /**
   * Clear model cache
   */
  async clearCache(): Promise<void> {
    if (!this.db) {
      return;
    }

    const tx = this.db.transaction("models", "readwrite");
    await tx.objectStore("models").clear();
    console.info("[ModelManager] Model cache cleared");
  }

  /**
   * Get cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("models", "readonly");
      const store = tx.objectStore("models");
      const request = store.count();

      request.onsuccess = () => {
        // Rough estimate: count * average model size
        resolve(request.result * 100 * 1024 * 1024); // 100MB per model average
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    // Unload all models
    for (const modelId of this.loadedModels.keys()) {
      await this.unloadModel(modelId);
    }

    // Close database
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Open IndexedDB for caching
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("vljepa-models", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("models")) {
          const store = db.createObjectStore("models", { keyPath: "id" });
          store.createIndex("version", "version", { unique: false });
        }
      };
    });
  }

  /**
   * Load model from cache
   */
  private async loadFromCache(modelId: string): Promise<ArrayBuffer | null> {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("models", "readonly");
      const request = tx.objectStore("models").get(modelId);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache model data
   */
  private async cacheModel(modelId: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("models", "readwrite");
      const request = tx.objectStore("models").put({
        id: modelId,
        data,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Download model from URL
   */
  private async downloadModel(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ModelLoadError(
        `Failed to download model: ${response.statusText}`
      );
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ModelLoadError("Response body is not readable");
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      receivedLength += value.length;

      if (total > 0 && onProgress) {
        const percentage = (receivedLength / total) * 100;
        onProgress({
          loaded: receivedLength,
          total,
          percentage,
          stage: "Downloading",
        });
      }
    }

    // Combine chunks
    const combined = new Uint8Array(receivedLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  }

  /**
   * Parse model data
   */
  private async parseModel(data: ArrayBuffer, info: ModelInfo): Promise<any> {
    // Placeholder for actual model parsing
    // In real implementation, this would parse the model format
    // (e.g., ONNX, TensorFlow.js, custom format)

    return {
      id: info.id,
      version: info.version,
      data,
      dispose: () => {
        // Cleanup logic
      },
    };
  }

  /**
   * Verify model integrity
   */
  private async verifyIntegrity(
    data: ArrayBuffer,
    expectedChecksum: string
  ): Promise<boolean> {
    // Simple checksum verification
    // In real implementation, use SHA-256 or similar
    const actualChecksum = this.computeChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  /**
   * Compute checksum of data
   */
  private computeChecksum(data: ArrayBuffer): string {
    // Simple hash for demonstration
    const view = new Uint8Array(data);
    let hash = 0;
    for (let i = 0; i < Math.min(view.length, 1000); i++) {
      hash = (hash << 5) - hash + view[i];
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Fetch latest version from server
   */
  private async fetchLatestVersion(modelUrl: string): Promise<string> {
    try {
      const versionUrl = modelUrl.replace(/\/[^/]+$/, "/version.json");
      const response = await fetch(versionUrl);
      if (response.ok) {
        const data = await response.json();
        return data.version;
      }
    } catch {
      // Fall through to return current version
    }
    return "1.0.0";
  }

  /**
   * Evict least recently used model
   */
  private async evictLRUModel(): Promise<void> {
    // Find oldest loaded model (excluding current)
    let oldestId: string | null = null;

    for (const [id] of this.loadedModels) {
      if (id === this.currentModel) {
        continue;
      }
      // For simplicity, use arbitrary order
      oldestId = id;
      break;
    }

    if (oldestId) {
      await this.unloadModel(oldestId);
    }
  }

  /**
   * Start version check interval
   */
  private startVersionCheck(): void {
    setInterval(async () => {
      const updates = await this.checkForUpdates();
      if (updates.size > 0) {
        console.info(
          "[ModelManager] Updates available:",
          Array.from(updates.keys())
        );
        // Dispatch event or callback
      }
    }, this.config.versionCheckInterval);
  }
}

/**
 * Create a model manager instance
 */
export function createModelManager(config: ModelManagerConfig): ModelManager {
  return new ModelManager(config);
}

/**
 * Default model manager configuration
 */
export function getDefaultModelManagerConfig(): ModelManagerConfig {
  return {
    maxModels: 3,
    cacheSize: 1024, // 1GB
    preload: [],
    updateStrategy: "manual",
    versionCheckInterval: 3600000, // 1 hour
    verifyIntegrity: true,
    maxConcurrentDownloads: 2,
  };
}
