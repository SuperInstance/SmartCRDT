/**
 * AdapterFactory - Factory for creating model adapters
 *
 * Provides a unified interface for creating adapters for different LLM providers.
 * Supports OpenAI, Ollama, Claude, Gemini, and Cohere adapters.
 */

import type { RoutingDecision, ProcessResult } from "@lsi/protocol";
import { OpenAIAdapter } from "./OpenAIAdapter.js";
import { OllamaAdapter } from "./OllamaAdapter.js";
import { ClaudeAdapter } from "./ClaudeAdapter.js";
import { GeminiAdapter } from "./GeminiAdapter.js";
import { CohereAdapter } from "./CohereAdapter.js";

/**
 * Supported adapter providers
 */
export type AdapterProvider =
  | "openai"
  | "ollama"
  | "claude"
  | "gemini"
  | "cohere";

/**
 * Unified adapter interface
 */
export interface Adapter {
  execute(decision: RoutingDecision, input: string): Promise<ProcessResult>;
  process(prompt: string, model?: string): Promise<ProcessResult>;
  processStream?(
    prompt: string,
    model?: string,
    onChunk?: (chunk: string, done: boolean) => void
  ): Promise<ProcessResult>;
  checkHealth(): Promise<{
    healthy: boolean;
    models: string[];
    currentModel?: string;
    error?: string;
    status?: string;
  }>;
  getConfig(): any;
  updateConfig(config: any): void;
}

/**
 * Configuration for creating an adapter
 */
export interface AdapterFactoryConfig {
  /** Provider to use */
  provider: AdapterProvider;
  /** API key (for cloud providers) */
  apiKey?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Base URL (optional, for custom endpoints) */
  baseURL?: string;
  /** Additional provider-specific config */
  config?: any;
}

/**
 * Adapter cache to reuse adapter instances
 */
class AdapterCache {
  private cache = new Map<string, Adapter>();

  set(key: string, adapter: Adapter): void {
    this.cache.set(key, adapter);
  }

  get(key: string): Adapter | undefined {
    return this.cache.get(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const adapterCache = new AdapterCache();

/**
 * Create a cache key for the adapter configuration
 */
function buildCacheKey(config: AdapterFactoryConfig): string {
  return JSON.stringify({
    provider: config.provider,
    apiKey: config.apiKey ? "***REDACTED***" : undefined,
    defaultModel: config.defaultModel,
    baseURL: config.baseURL,
  });
}

/**
 * AdapterFactory - Create adapters for different LLM providers
 *
 * @example
 * ```typescript
 * // Create an OpenAI adapter
 * const openai = AdapterFactory.create({
 *   provider: 'openai',
 *   apiKey: 'sk-...',
 *   defaultModel: 'gpt-4'
 * });
 *
 * // Create a Claude adapter
 * const claude = AdapterFactory.create({
 *   provider: 'claude',
 *   apiKey: 'sk-ant-...',
 *   defaultModel: 'claude-3-5-sonnet-20241022'
 * });
 *
 * // Create from environment variables
 * const gemini = AdapterFactory.fromEnv('gemini');
 *
 * // Auto-detect provider from model name
 * const adapter = AdapterFactory.fromModel('claude-3-opus-20240229');
 * ```
 */
export class AdapterFactory {
  /**
   * Create an adapter for the specified provider
   *
   * @param config - Adapter configuration
   * @param useCache - Whether to cache and reuse adapter instances (default: true)
   * @returns Adapter instance
   */
  static create(
    config: AdapterFactoryConfig,
    useCache: boolean = true
  ): Adapter {
    const cacheKey = useCache ? buildCacheKey(config) : null;

    // Return cached adapter if available
    if (cacheKey && adapterCache.get(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }

    let adapter: Adapter;

    switch (config.provider) {
      case "openai":
        adapter = new OpenAIAdapter(
          config.apiKey,
          config.defaultModel,
          config.config
        );
        break;

      case "ollama":
        adapter = new OllamaAdapter(
          config.baseURL,
          config.defaultModel,
          config.config
        );
        break;

      case "claude":
        adapter = new ClaudeAdapter(
          config.apiKey,
          config.defaultModel,
          config.config
        );
        break;

      case "gemini":
        adapter = new GeminiAdapter(
          config.apiKey,
          config.defaultModel,
          config.config
        );
        break;

      case "cohere":
        adapter = new CohereAdapter(
          config.apiKey,
          config.defaultModel,
          config.config
        );
        break;

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    // Cache the adapter if requested
    if (cacheKey) {
      adapterCache.set(cacheKey, adapter);
    }

    return adapter;
  }

  /**
   * Create an adapter from environment variables
   *
   * Environment variables:
   * - OpenAI: OPENAI_API_KEY, OPENAI_MODEL (default: gpt-3.5-turbo)
   * - Ollama: OLLAMA_BASE_URL (default: http://localhost:11434), OLLAMA_MODEL (default: llama2)
   * - Claude: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default: claude-3-5-sonnet-20241022)
   * - Gemini: GOOGLE_API_KEY, GOOGLE_MODEL (default: gemini-1.5-pro)
   * - Cohere: COHERE_API_KEY, COHERE_MODEL (default: command-r-plus)
   *
   * @param provider - Provider to create adapter for
   * @param useCache - Whether to cache and reuse adapter instances (default: true)
   * @returns Adapter instance
   * @throws Error if required environment variables are not set
   */
  static fromEnv(
    provider: AdapterProvider,
    useCache: boolean = true
  ): Adapter {
    return AdapterFactory.create({ provider }, useCache);
  }

  /**
   * Auto-detect provider and create adapter from model name
   *
   * Model name patterns:
   * - OpenAI: starts with "gpt-"
   * - Claude: starts with "claude-"
   * - Gemini: starts with "gemini-"
   * - Cohere: starts with "command-"
   * - Ollama: anything else (assumes local model)
   *
   * @param model - Model name to detect provider from
   * @param useCache - Whether to cache and reuse adapter instances (default: true)
   * @returns Adapter instance
   * @throws Error if provider cannot be detected
   */
  static fromModel(model: string, useCache: boolean = true): Adapter {
    let provider: AdapterProvider;

    if (model.startsWith("gpt-")) {
      provider = "openai";
    } else if (model.startsWith("claude-")) {
      provider = "claude";
    } else if (model.startsWith("gemini-")) {
      provider = "gemini";
    } else if (model.startsWith("command-")) {
      provider = "cohere";
    } else {
      // Default to Ollama for unknown models (local inference)
      provider = "ollama";
    }

    return AdapterFactory.create({ provider, defaultModel: model }, useCache);
  }

  /**
   * Create multiple adapters at once
   *
   * @param configs - Array of adapter configurations
   * @param useCache - Whether to cache and reuse adapter instances (default: true)
   * @returns Map of provider to adapter instance
   */
  static createMany(
    configs: AdapterFactoryConfig[],
    useCache: boolean = true
  ): Map<AdapterProvider, Adapter> {
    const adapters = new Map<AdapterProvider, Adapter>();

    for (const config of configs) {
      const adapter = AdapterFactory.create(config, useCache);
      adapters.set(config.provider, adapter);
    }

    return adapters;
  }

  /**
   * Clear the adapter cache
   *
   * This forces new adapter instances to be created on next call to create().
   */
  static clearCache(): void {
    adapterCache.clear();
  }

  /**
   * Get list of supported providers
   *
   * @returns Array of supported provider names
   */
  static getSupportedProviders(): AdapterProvider[] {
    return ["openai", "ollama", "claude", "gemini", "cohere"];
  }

  /**
   * Check if a provider is supported
   *
   * @param provider - Provider name to check
   * @returns True if provider is supported
   */
  static isSupportedProvider(provider: string): provider is AdapterProvider {
    return this.getSupportedProviders().includes(provider as AdapterProvider);
  }

  /**
   * Get default model for a provider
   *
   * @param provider - Provider to get default model for
   * @returns Default model name
   */
  static getDefaultModel(provider: AdapterProvider): string {
    switch (provider) {
      case "openai":
        return "gpt-3.5-turbo";
      case "ollama":
        return "llama2";
      case "claude":
        return "claude-3-5-sonnet-20241022";
      case "gemini":
        return "gemini-1.5-pro";
      case "cohere":
        return "command-r-plus";
    }
  }

  /**
   * Get available models for a provider
   *
   * @param provider - Provider to get models for
   * @returns Array of available model names
   */
  static getAvailableModels(provider: AdapterProvider): string[] {
    switch (provider) {
      case "openai":
        return [
          "gpt-4",
          "gpt-4-turbo",
          "gpt-3.5-turbo",
          "gpt-3.5-turbo-16k",
        ];
      case "ollama":
        return [
          "llama2",
          "llama2:13b",
          "llama2:70b",
          "mistral",
          "mixtral",
          "qwen2.5:3b",
          "phi3",
        ];
      case "claude":
        return [
          "claude-3-5-sonnet-20241022",
          "claude-3-5-sonnet-latest",
          "claude-3-5-haiku-20241022",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307",
        ];
      case "gemini":
        return [
          "gemini-2.0-flash-expert",
          "gemini-1.5-pro",
          "gemini-1.5-flash",
          "gemini-1.0-pro",
          "gemini-pro",
          "gemini-flash",
        ];
      case "cohere":
        return [
          "command-r-plus",
          "command-r",
          "command",
          "command-light",
          "command-text",
        ];
    }
  }
}

/**
 * Convenience function to create an adapter
 *
 * @param config - Adapter configuration
 * @returns Adapter instance
 */
export function createAdapter(config: AdapterFactoryConfig): Adapter {
  return AdapterFactory.create(config);
}

/**
 * Convenience function to create an adapter from environment
 *
 * @param provider - Provider to create adapter for
 * @returns Adapter instance
 */
export function createAdapterFromEnv(provider: AdapterProvider): Adapter {
  return AdapterFactory.fromEnv(provider);
}

/**
 * Convenience function to create an adapter from model name
 *
 * @param model - Model name to detect provider from
 * @returns Adapter instance
 */
export function createAdapterFromModel(model: string): Adapter {
  return AdapterFactory.fromModel(model);
}

export default AdapterFactory;
