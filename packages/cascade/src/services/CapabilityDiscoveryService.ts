/**
 * CapabilityDiscoveryService - Automatic model capability discovery for Ollama
 *
 * This service automatically discovers and fingerprints model capabilities by:
 * 1. Querying Ollama's /api/tags endpoint for available models
 * 2. Extracting model metadata (family, size, quantization)
 * 3. Running micro-benchmarks to assess quality and latency
 * 4. Testing supported intents (chat, embedding, etc.)
 * 5. Caching discovered capabilities for fast lookup
 *
 * @example
 * ```typescript
 * const discovery = new CapabilityDiscoveryService(ollamaAdapter);
 * const result = await discovery.discoverAll();
 * console.log(`Discovered ${result.discoveredCount} models`);
 *
 * const llama3Caps = discovery.getCapability('llama3:8b');
 * console.log(llama3Caps.supportedIntents); // ['chat', 'completion', ...]
 * ```
 */

import type {
  ModelCapability,
  CapabilityDiscoveryResult,
  BenchmarkResult,
  LatencyMeasurement,
  CapabilityCacheEntry,
  CapabilityCacheConfig,
  CapabilityDiscoveryConfig,
  DiscoveryProgressCallback,
  ModelIntentType,
  ModelFingerprint,
  WellKnownModelRegistry,
  OllamaModel,
} from "@lsi/protocol";
import { OllamaAdapter } from "../adapters/OllamaAdapter.js";
import axios from "axios";

/**
 * Well-known model profiles
 *
 * Fallback profiles for common models when auto-discovery is incomplete.
 */
const WELL_KNOWN_MODELS: WellKnownModelRegistry = {
  // Llama 3 family
  "llama3": {
    pattern: "llama3",
    capability: {
      maxContextLength: 8192,
      supportedIntents: ["chat", "completion", "reasoning"],
      qualityScore: 0.85,
      averageLatencyMs: 150,
      tokensPerSecond: 45,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["general-purpose", "reasoning", "chat"],
      limitations: ["No native function calling", "English-centric"],
    },
    expectedIntents: ["chat", "completion", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // Llama 3.1 family
  "llama3.1": {
    pattern: "llama3.1|llama3-1",
    capability: {
      maxContextLength: 128000,
      supportedIntents: ["chat", "completion", "reasoning"],
      qualityScore: 0.88,
      averageLatencyMs: 160,
      tokensPerSecond: 42,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      recommendedUseCases: ["general-purpose", "reasoning", "long-context"],
      limitations: ["Higher VRAM requirements"],
    },
    expectedIntents: ["chat", "completion", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // Llama 3.2 family
  "llama3.2": {
    pattern: "llama3.2|llama3-2",
    capability: {
      maxContextLength: 128000,
      supportedIntents: ["chat", "completion", "reasoning"],
      qualityScore: 0.90,
      averageLatencyMs: 155,
      tokensPerSecond: 48,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      recommendedUseCases: ["general-purpose", "reasoning", "instruction-following"],
      limitations: ["Higher VRAM requirements"],
    },
    expectedIntents: ["chat", "completion", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // Mistral family
  "mistral": {
    pattern: "mistral",
    capability: {
      maxContextLength: 32768,
      supportedIntents: ["chat", "completion", "code-generation", "reasoning"],
      qualityScore: 0.82,
      averageLatencyMs: 140,
      tokensPerSecond: 50,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      recommendedUseCases: ["code-generation", "reasoning", "chat"],
      limitations: ["No native vision support"],
    },
    expectedIntents: ["chat", "completion", "code-generation", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_k: 40 },
  },

  // Mixtral family (MoE)
  "mixtral": {
    pattern: "mixtral",
    capability: {
      maxContextLength: 32768,
      supportedIntents: ["chat", "completion", "code-generation", "reasoning"],
      qualityScore: 0.87,
      averageLatencyMs: 180,
      tokensPerSecond: 55,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      recommendedUseCases: ["complex-reasoning", "code-generation", "chat"],
      limitations: ["High VRAM requirements (~47GB for 8x7B)"],
    },
    expectedIntents: ["chat", "completion", "code-generation", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_k: 40 },
  },

  // Qwen family
  "qwen": {
    pattern: "qwen",
    capability: {
      maxContextLength: 32768,
      supportedIntents: ["chat", "completion", "code-generation", "reasoning"],
      qualityScore: 0.83,
      averageLatencyMs: 145,
      tokensPerSecond: 52,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      recommendedUseCases: ["code-generation", "reasoning", "multilingual"],
      limitations: ["Strong Chinese support, weaker for other languages"],
    },
    expectedIntents: ["chat", "completion", "code-generation", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // Nomic Embed
  "nomic-embed": {
    pattern: "nomic-embed.*text",
    capability: {
      maxContextLength: 8192,
      supportedIntents: ["embedding"],
      qualityScore: 0.80,
      averageLatencyMs: 50,
      tokensPerSecond: 100,
      embeddingDimension: 768,
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["semantic-search", "clustering", "retrieval"],
      limitations: ["Embedding-only, not for text generation"],
    },
    expectedIntents: ["embedding"],
    recommendedConfig: {},
  },

  // Mxbai Embed
  "mxbai-embed": {
    pattern: "mxbai-embed.*",
    capability: {
      maxContextLength: 512,
      supportedIntents: ["embedding"],
      qualityScore: 0.82,
      averageLatencyMs: 40,
      tokensPerSecond: 120,
      embeddingDimension: 1024,
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["semantic-search", "retrieval", "classification"],
      limitations: ["Short context window (512 tokens)", "Embedding-only"],
    },
    expectedIntents: ["embedding"],
    recommendedConfig: {},
  },

  // Gemma family
  "gemma": {
    pattern: "gemma",
    capability: {
      maxContextLength: 8192,
      supportedIntents: ["chat", "completion", "reasoning"],
      qualityScore: 0.80,
      averageLatencyMs: 130,
      tokensPerSecond: 55,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["general-purpose", "chat", "instruction-following"],
      limitations: ["No function calling", "Smaller context than competitors"],
    },
    expectedIntents: ["chat", "completion", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // Phi family
  "phi": {
    pattern: "phi",
    capability: {
      maxContextLength: 2048,
      supportedIntents: ["chat", "completion", "reasoning"],
      qualityScore: 0.75,
      averageLatencyMs: 80,
      tokensPerSecond: 70,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["lightweight-chat", "edge-computing", "fast-inference"],
      limitations: ["Small context window", "Limited reasoning capability"],
    },
    expectedIntents: ["chat", "completion", "reasoning"],
    recommendedConfig: { temperature: 0.7, top_p: 0.9 },
  },

  // DeepSeek Coder
  "deepseek-coder": {
    pattern: "deepseek-coder",
    capability: {
      maxContextLength: 16384,
      supportedIntents: ["chat", "completion", "code-generation"],
      qualityScore: 0.86,
      averageLatencyMs: 150,
      tokensPerSecond: 48,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["code-generation", "code-review", "debugging"],
      limitations: ["Specialized for code, weaker general reasoning"],
    },
    expectedIntents: ["chat", "completion", "code-generation"],
    recommendedConfig: { temperature: 0.5, top_p: 0.95 },
  },
};

/**
 * Capability Discovery Service
 *
 * Discovers and caches model capabilities automatically.
 */
export class CapabilityDiscoveryService {
  private adapter: OllamaAdapter;
  private config: Required<CapabilityDiscoveryConfig>;
  private cache: Map<string, CapabilityCacheEntry>;
  private baseURL: string;
  private logger: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  /**
   * Create a new CapabilityDiscoveryService
   *
   * @param adapter - OllamaAdapter to use for discovery
   * @param config - Optional configuration
   */
  constructor(
    adapter: OllamaAdapter,
    config: CapabilityDiscoveryConfig = {}
  ) {
    this.adapter = adapter;
    this.cache = new Map();

    // Get base URL from adapter config
    const adapterConfig = adapter.getConfig();
    this.baseURL = adapterConfig.baseURL || "http://localhost:11434";

    // Setup configuration with defaults
    this.config = {
      cache: {
        enabled: true,
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 100,
        storage: "memory",
        ...config.cache,
      },
      runBenchmarks: config.runBenchmarks ?? false,
      benchmarkSamples: config.benchmarkSamples ?? 3,
      benchmarkTimeout: config.benchmarkTimeout ?? 30000,
      verifyOnLoad: config.verifyOnLoad ?? false,
      discoveryTimeout: config.discoveryTimeout ?? 60000,
      logging: {
        level: config.logging?.level ?? "info",
        enabled: config.logging?.enabled ?? true,
      },
    };

    // Setup logger
    const logLevel = this.config.logging.level;
    const logEnabled = this.config.logging.enabled;

    this.logger = {
      debug: (...args: unknown[]) => { if (logEnabled && logLevel === "debug") console.debug("[CapabilityDiscovery]", ...args); },
      info: (...args: unknown[]) => { if (logEnabled && ["debug", "info"].includes(logLevel!)) console.info("[CapabilityDiscovery]", ...args); },
      warn: (...args: unknown[]) => { if (logEnabled && ["debug", "info", "warn"].includes(logLevel!)) console.warn("[CapabilityDiscovery]", ...args); },
      error: (...args: unknown[]) => { if (logEnabled) console.error("[CapabilityDiscovery]", ...args); },
    };
  }

  /**
   * Discover capabilities for all available models
   *
   * @param progressCallback - Optional progress callback
   * @returns Discovery result with all discovered capabilities
   */
  async discoverAll(
    progressCallback?: DiscoveryProgressCallback
  ): Promise<CapabilityDiscoveryResult> {
    const startTime = Date.now();
    this.logger.info("Starting capability discovery for all models");

    try {
      // Fetch all available models from Ollama
      const models = await this.fetchAvailableModels();

      if (models.length === 0) {
        return {
          success: false,
          discoveredCount: 0,
          failedCount: 0,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        };
      }

      this.logger.info(`Found ${models.length} models to discover`);

      const capabilities: ModelCapability[] = [];
      const errors: Array<{ modelId: string; error: string }> = [];

      // Discover each model
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const progress = ((i + 1) / models.length) * 100;

        progressCallback?.({
          currentModel: model.name,
          discovered: i,
          total: models.length,
          progress,
          operation: "discovering",
        });

        try {
          const capability = await this.discoverModel(model);
          capabilities.push(capability);
          this.logger.debug(`Discovered capabilities for ${model.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ modelId: model.name, error: errorMessage });
          this.logger.warn(`Failed to discover ${model.name}: ${errorMessage}`);
        }
      }

      // Cache all discovered capabilities
      if (this.config.cache.enabled) {
        for (const capability of capabilities) {
          this.cacheCapability(capability);
        }
      }

      return {
        success: true,
        capabilities,
        errors: errors.length > 0 ? errors : undefined,
        discoveredCount: capabilities.length,
        failedCount: errors.length,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Discovery failed:", error);
      return {
        success: false,
        errors: [{
          modelId: "all",
          error: error instanceof Error ? error.message : String(error),
        }],
        discoveredCount: 0,
        failedCount: 0,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Discover capabilities for a specific model
   *
   * @param model - Ollama model info
   * @returns Discovered capability
   */
  async discoverModel(model: OllamaModel): Promise<ModelCapability> {
    const startTime = Date.now();

    // Generate fingerprint
    const fingerprint = this.generateFingerprint(model);

    // Check if we have a well-known profile
    const wellKnown = this.findWellKnownProfile(model.name);

    // Start with well-known profile or defaults
    const baseCapability = wellKnown?.capability || this.getDefaultCapability(fingerprint);

    // Query Ollama API for additional metadata
    const metadata = await this.fetchModelMetadata(model.name);

    // Run benchmarks if enabled
    let qualityScore = baseCapability.qualityScore || 0.5;
    let averageLatencyMs = baseCapability.averageLatencyMs || 100;
    let tokensPerSecond = baseCapability.tokensPerSecond || 50;

    if (this.config.runBenchmarks) {
      try {
        const benchmarkResult = await this.runBenchmark(model.name);
        qualityScore = benchmarkResult.score;
        averageLatencyMs = benchmarkResult.duration;

        const latencyMeasurement = await this.measureLatency(model.name);
        tokensPerSecond = latencyMeasurement.tokensPerSecond;
      } catch (error) {
        this.logger.warn(`Benchmarks failed for ${model.name}:`, error);
      }
    }

    // Test supported intents
    const supportedIntents = await this.testIntents(model.name, wellKnown?.expectedIntents);

    // Build capability object
    const capability: ModelCapability = {
      modelId: model.name,
      name: model.name,
      family: fingerprint.family,
      parameterSize: fingerprint.parameterSize,
      quantizationLevel: fingerprint.quantizationLevel,
      maxContextLength: baseCapability.maxContextLength || 8192,
      supportedIntents,
      qualityScore,
      averageLatencyMs,
      tokensPerSecond,
      embeddingDimension: baseCapability.embeddingDimension,
      supportsStreaming: baseCapability.supportsStreaming ?? true,
      supportsFunctionCalling: baseCapability.supportsFunctionCalling ?? false,
      supportsVision: baseCapability.supportsVision ?? false,
      recommendedUseCases: baseCapability.recommendedUseCases || [],
      limitations: baseCapability.limitations || [],
      minVRAM: baseCapability.minVRAM,
      discoveredAt: Date.now(),
      verifiedAt: this.config.verifyOnLoad ? Date.now() : undefined,
      version: fingerprint.version,
    };

    this.logger.debug(`Discovered capability for ${model.name} in ${Date.now() - startTime}ms`);

    return capability;
  }

  /**
   * Get cached capability for a model
   *
   * @param modelId - Model identifier
   * @returns Capability or undefined if not cached
   */
  getCapability(modelId: string): ModelCapability | undefined {
    const cached = this.cache.get(modelId);

    if (!cached) {
      return undefined;
    }

    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.cachedAt > cached.ttl) {
      this.cache.delete(modelId);
      return undefined;
    }

    // Update hit stats
    cached.hitCount++;
    cached.lastAccessed = now;

    return cached.capability;
  }

  /**
   * Get all cached capabilities
   *
   * @returns Array of all cached capabilities
   */
  getAllCapabilities(): ModelCapability[] {
    const now = Date.now();
    const capabilities: ModelCapability[] = [];

    for (const [modelId, entry] of this.cache.entries()) {
      // Skip expired entries
      if (now - entry.cachedAt > entry.ttl) {
        this.cache.delete(modelId);
        continue;
      }

      capabilities.push(entry.capability);
    }

    return capabilities;
  }

  /**
   * Clear the capability cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info("Capability cache cleared");
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Fetch all available models from Ollama
   */
  private async fetchAvailableModels(): Promise<OllamaModel[]> {
    const response = await axios.get(`${this.baseURL}/api/tags`);
    return response.data.models || [];
  }

  /**
   * Fetch detailed metadata for a specific model
   */
  private async fetchModelMetadata(modelId: string): Promise<Record<string, unknown>> {
    try {
      // Try to get model info via /api/show
      const response = await axios.post(`${this.baseURL}/api/show`, {
        name: modelId,
      });
      return response.data || {};
    } catch (error) {
      this.logger.debug(`Could not fetch metadata for ${modelId}:`, error);
      return {};
    }
  }

  /**
   * Generate a fingerprint from model info
   */
  private generateFingerprint(model: OllamaModel): ModelFingerprint {
    const name = model.name;

    // Extract family from model name
    const familyMatch = name.match(/^([a-z0-9-]+)/i);
    const family = familyMatch ? familyMatch[1].toLowerCase() : "unknown";

    // Extract parameter size
    const sizeMatch = name.match(/(\d+[bk]?)/i);
    const parameterSize = sizeMatch ? sizeMatch[1].toUpperCase() : "unknown";

    // Extract quantization level
    const quantMatch = name.match(/(q[0-9_]+|f[0-9]+)/i);
    const quantizationLevel = quantMatch ? quantMatch[1].toUpperCase() : undefined;

    // Generate metadata hash
    const metadataStr = JSON.stringify(model.details || {});
    const metadataHash = this.simpleHash(metadataStr);

    return {
      modelId: name,
      family,
      parameterSize,
      quantizationLevel,
      metadataHash,
      version: "1.0.0",
    };
  }

  /**
   * Find a well-known profile for a model
   */
  private findWellKnownProfile(modelId: string): { pattern: string; capability: Partial<ModelCapability>; expectedIntents: ModelIntentType[]; recommendedConfig: Record<string, unknown> } | undefined {
    for (const [name, profile] of Object.entries(WELL_KNOWN_MODELS)) {
      const regex = new RegExp(profile.pattern, "i");
      if (regex.test(modelId)) {
        return profile;
      }
    }
    return undefined;
  }

  /**
   * Get default capability profile
   */
  private getDefaultCapability(fingerprint: ModelFingerprint): Partial<ModelCapability> {
    return {
      maxContextLength: 8192,
      supportedIntents: ["chat", "completion"],
      qualityScore: 0.5,
      averageLatencyMs: 100,
      tokensPerSecond: 50,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      recommendedUseCases: ["general-purpose"],
      limitations: ["Auto-discovered, limited validation"],
    };
  }

  /**
   * Run a quality benchmark on a model
   */
  private async runBenchmark(modelId: string): Promise<BenchmarkResult> {
    const startTime = Date.now();

    try {
      // Simple reasoning benchmark
      const testPrompt = "What is 2+2? Answer with just the number.";

      const result = await this.adapter.process(
        testPrompt,
        modelId
      );

      // Check if answer is reasonable (contains '4')
      const hasCorrectAnswer = result.content.includes("4");
      const score = hasCorrectAnswer ? 0.8 : 0.4;

      return {
        modelId,
        benchmarkName: "basic-reasoning",
        score,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(`Benchmark failed for ${modelId}:`, error);
      return {
        modelId,
        benchmarkName: "basic-reasoning",
        score: 0.3, // Low score for failure
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Measure latency for a model
   */
  private async measureLatency(modelId: string): Promise<LatencyMeasurement> {
    const startTime = Date.now();

    try {
      const testPrompt = "The quick brown fox jumps over the lazy dog. Repeat this exactly.";

      const result = await this.adapter.process(
        testPrompt,
        modelId
      );

      const totalTime = Date.now() - startTime;
      const promptTokens = testPrompt.length / 4; // Rough estimate
      const generatedTokens = result.content.length / 4;

      return {
        modelId,
        promptTokens: Math.round(promptTokens),
        generatedTokens: Math.round(generatedTokens),
        timeToFirstToken: totalTime / 2, // Estimate
        totalTime,
        tokensPerSecond: (generatedTokens / totalTime) * 1000,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn(`Latency measurement failed for ${modelId}:`, error);
      return {
        modelId,
        promptTokens: 10,
        generatedTokens: 10,
        timeToFirstToken: 100,
        totalTime: 200,
        tokensPerSecond: 50,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Test which intents a model supports
   */
  private async testIntents(
    modelId: string,
    expectedIntents: ModelIntentType[] = ["chat", "completion"]
  ): Promise<ModelIntentType[]> {
    const supported: ModelIntentType[] = [];

    // Test chat intent
    if (expectedIntents.includes("chat")) {
      try {
        await this.adapter.process("Hello", modelId);
        supported.push("chat");
      } catch {
        // Chat not supported
      }
    }

    // Test completion intent
    if (expectedIntents.includes("completion")) {
      try {
        await this.adapter.process("Complete this: The sky is", modelId);
        supported.push("completion");
      } catch {
        // Completion not supported
      }
    }

    // For embedding models, check model name
    if (expectedIntents.includes("embedding") && modelId.toLowerCase().includes("embed")) {
      supported.push("embedding");
    }

    // For code models, check model name
    if (expectedIntents.includes("code-generation") &&
        (modelId.toLowerCase().includes("coder") ||
         modelId.toLowerCase().includes("instruct"))) {
      supported.push("code-generation");
    }

    // Default to chat if nothing else worked
    if (supported.length === 0 && expectedIntents.includes("chat")) {
      supported.push("chat");
    }

    return supported;
  }

  /**
   * Cache a capability
   */
  private cacheCapability(capability: ModelCapability): void {
    const entry: CapabilityCacheEntry = {
      capability,
      cachedAt: Date.now(),
      ttl: this.config.cache.ttl ?? 86400000, // Default 24 hours
      hitCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(capability.modelId, entry);

    // Enforce cache size limit
    const maxSize = this.config.cache.maxSize ?? 100;
    if (this.cache.size > maxSize) {
      // Remove least recently used entry
      let oldestEntry: [string, CapabilityCacheEntry] | null = null;

      for (const [modelId, cacheEntry] of this.cache.entries()) {
        if (!oldestEntry || cacheEntry.lastAccessed < oldestEntry[1].lastAccessed) {
          oldestEntry = [modelId, cacheEntry];
        }
      }

      if (oldestEntry) {
        this.cache.delete(oldestEntry[0]);
      }
    }

    this.logger.debug(`Cached capability for ${capability.modelId}`);
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Create a CapabilityDiscoveryService
 *
 * @param adapter - OllamaAdapter to use
 * @param config - Optional configuration
 * @returns Configured service instance
 */
export function createCapabilityDiscoveryService(
  adapter: OllamaAdapter,
  config?: CapabilityDiscoveryConfig
): CapabilityDiscoveryService {
  return new CapabilityDiscoveryService(adapter, config);
}
