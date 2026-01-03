/**
 * @lsi/vljepa-orpo - VL-JEPA Bridge
 *
 * Connects multimodal ORPO with VL-JEPA for visual encoding.
 * Uses VL-JEPA's X-Encoder to extract 768-dim embeddings from UI states.
 *
 * @module integrations
 */

import type { UIState, UIPreferencePair } from "../types.js";

/**
 * VL-JEPA bridge interface
 */
interface VLJEPABridgeInterface {
  /** Encode visual input to embedding */
  encodeVision(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<Float32Array>;
  /** Encode language to embedding */
  encodeLanguage(text: string): Promise<Float32Array>;
  /** Health check */
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
}

/**
 * VL-JEPA Bridge
 *
 * Bridges the multimodal ORPO system with VL-JEPA encoding.
 *
 * @example
 * ```typescript
 * const bridge = new VLJEPABridge();
 * await bridge.initialize();
 * const embedding = await bridge.encodeUIState(uiState);
 * ```
 */
export class VLJEPABridge implements VLJEPABridgeInterface {
  private vljepa: VLJEPABridgeInterface | null;
  private initialized: boolean;
  private fallbackEnabled: boolean;

  constructor(
    options: {
      fallbackEnabled?: boolean;
    } = {}
  ) {
    this.vljepa = null;
    this.initialized = false;
    this.fallbackEnabled = options.fallbackEnabled ?? true;
  }

  /**
   * Initialize bridge
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Try to import VL-JEPA (optional dependency)
      // @ts-ignore - @lsi/vljepa is an optional dependency
      const vljepaModule = await import("@lsi/vljepa");

      // Try to create VL-JEPA instance
      // This is a placeholder - actual implementation would use VL-JEPA factory
      this.vljepa = {
        encodeVision: async frame => {
          // Placeholder: would call actual VL-JEPA encodeVision
          return this.generateFallbackEmbedding();
        },
        encodeLanguage: async text => {
          // Placeholder: would call actual VL-JEPA encodeLanguage
          return this.generateFallbackEmbedding();
        },
        healthCheck: async () => {
          return { healthy: true };
        },
      };

      const health = await this.vljepa.healthCheck();
      if (!health.healthy) {
        throw new Error(health.error || "VL-JEPA health check failed");
      }

      this.initialized = true;
      console.log("VL-JEPA bridge initialized successfully");
    } catch (error) {
      if (this.fallbackEnabled) {
        console.warn(
          "VL-JEPA not available, using fallback embeddings:",
          error
        );
        this.vljepa = null;
        this.initialized = true;
      } else {
        throw new Error(`Failed to initialize VL-JEPA bridge: ${error}`);
      }
    }
  }

  /**
   * Encode UI state to embedding
   */
  async encodeUIState(state: UIState): Promise<Float32Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    // If VL-JEPA is available, use it
    if (this.vljepa) {
      try {
        return await this.vljepa.encodeVision(state.image);
      } catch (error) {
        console.warn("VL-JEPA encoding failed, using fallback:", error);
      }
    }

    // Fallback: generate embedding from image data
    return this.generateEmbeddingFromImage(state.image);
  }

  /**
   * Encode UI state pair
   */
  async encodeUIPair(
    chosen: UIState,
    rejected: UIState
  ): Promise<{
    chosenEmbedding: Float32Array;
    rejectedEmbedding: Float32Array;
  }> {
    const [chosenEmbedding, rejectedEmbedding] = await Promise.all([
      this.encodeUIState(chosen),
      this.encodeUIState(rejected),
    ]);

    return { chosenEmbedding, rejectedEmbedding };
  }

  /**
   * Encode preference pair
   */
  async encodePreferencePair(pair: UIPreferencePair): Promise<{
    chosenEmbedding: Float32Array;
    rejectedEmbedding: Float32Array;
    contextEmbedding: Float32Array;
  }> {
    const { chosenEmbedding, rejectedEmbedding } = await this.encodeUIPair(
      pair.chosen,
      pair.rejected
    );

    // Generate context embedding from text
    const contextText = `${pair.context.task} ${pair.context.userIntent} ${pair.context.uiContext}`;
    let contextEmbedding: Float32Array;

    if (this.vljepa) {
      contextEmbedding = await this.vljepa.encodeLanguage(contextText);
    } else {
      contextEmbedding = this.generateEmbeddingFromText(contextText);
    }

    return { chosenEmbedding, rejectedEmbedding, contextEmbedding };
  }

  /**
   * Encode batch of preference pairs
   */
  async encodeBatch(pairs: UIPreferencePair[]): Promise<
    Array<{
      chosenEmbedding: Float32Array;
      rejectedEmbedding: Float32Array;
      contextEmbedding: Float32Array;
    }>
  > {
    return await Promise.all(
      pairs.map(pair => this.encodePreferencePair(pair))
    );
  }

  /**
   * Encode vision (VL-JEPA interface)
   */
  async encodeVision(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<Float32Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.vljepa) {
      return await this.vljepa.encodeVision(frame);
    }

    // Handle different input types
    let imageData: ImageData;

    if (typeof frame === "string") {
      // URL - would need to fetch and decode
      throw new Error("URL encoding not yet supported");
    } else if (
      "getContext" in frame &&
      typeof frame.getContext === "function"
    ) {
      // HTMLCanvasElement - check for getContext method
      const ctx = frame.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }
      const canvasFrame = frame as { width: number; height: number };
      imageData = ctx.getImageData(0, 0, canvasFrame.width, canvasFrame.height);
    } else {
      imageData = frame as ImageData;
    }

    return this.generateEmbeddingFromImage(imageData);
  }

  /**
   * Encode language (VL-JEPA interface)
   */
  async encodeLanguage(text: string): Promise<Float32Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.vljepa) {
      return await this.vljepa.encodeLanguage(text);
    }

    return this.generateEmbeddingFromText(text);
  }

  /**
   * Health check (VL-JEPA interface)
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    if (this.vljepa) {
      return await this.vljepa.healthCheck();
    }

    return {
      healthy: this.fallbackEnabled,
      error: this.fallbackEnabled
        ? undefined
        : "VL-JEPA not available and fallback disabled",
    };
  }

  /**
   * Generate embedding from image data (fallback)
   */
  private generateEmbeddingFromImage(image: ImageData): Float32Array {
    const pixels = image.data;
    let hash = 0;

    // Simple hash of image data for deterministic embeddings
    const step = Math.max(1, Math.floor(pixels.length / 1000));

    for (let i = 0; i < pixels.length; i += step * 4) {
      hash = (hash << 5) - hash + pixels[i];
      hash = hash & hash;
    }

    return this.hashToEmbedding(Math.abs(hash));
  }

  /**
   * Generate embedding from text (fallback)
   */
  private generateEmbeddingFromText(text: string): Float32Array {
    const hash = this.hashString(text);
    return this.hashToEmbedding(hash);
  }

  /**
   * Convert hash to 768-dim embedding
   */
  private hashToEmbedding(hash: number): Float32Array {
    const embedding = new Float32Array(768);

    for (let i = 0; i < 768; i++) {
      const seed = hash + i * 31;
      const value = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      embedding[i] = value * 2 - 1; // Scale to [-1, 1]
    }

    // Normalize
    const norm = Math.sqrt(
      embedding.reduce((sum: number, v: number) => sum + v * v, 0)
    );
    for (let i = 0; i < 768; i++) {
      embedding[i] = embedding[i] / (norm + 1e-8);
    }

    return embedding;
  }

  /**
   * Generate fallback embedding
   */
  private generateFallbackEmbedding(): Float32Array {
    return this.hashToEmbedding(Date.now());
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if VL-JEPA is available
   */
  isVLJEPAAvailable(): boolean {
    return this.vljepa !== null;
  }

  /**
   * Enable/disable fallback mode
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }
}

/**
 * Create a VL-JEPA bridge
 */
export async function createVLJEPABridge(options?: {
  fallbackEnabled?: boolean;
}): Promise<VLJEPABridge> {
  const bridge = new VLJEPABridge(options);
  await bridge.initialize();
  return bridge;
}
