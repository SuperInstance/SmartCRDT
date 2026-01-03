/**
 * Configuration types for Aequor CLI
 */

/**
 * Backend configuration
 */
export interface BackendConfig {
  /** Backend type */
  type: "local" | "cloud" | "hybrid";
  /** Local backend URL (for Ollama) */
  localUrl?: string;
  /** Cloud backend config */
  cloud?: {
    /** API key */
    apiKey: string;
    /** Base URL (default: https://api.openai.com/v1) */
    baseURL?: string;
    /** Organization ID */
    organization?: string;
  };
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
  /** Complexity threshold for routing (0-1) */
  complexityThreshold: number;
  /** Prefer local models for simple queries */
  localFirst: boolean;
  /** Maximum retries for failed requests */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeout: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Daily budget in cents */
  daily: number;
  /** Weekly budget in cents */
  weekly: number;
  /** Monthly budget in cents */
  monthly: number;
  /** Alert when budget exceeds percentage */
  alertThreshold: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable semantic cache */
  enabled: boolean;
  /** Maximum cache size in MB */
  maxSize: number;
  /** Cache TTL in seconds */
  ttl: number;
  /** Cache directory path */
  directory: string;
}

/**
 * Display configuration
 */
export interface DisplayConfig {
  /** Use colors in output */
  colorize: boolean;
  /** Show timestamps in logs */
  showTimestamp: boolean;
  /** Output format */
  format: "text" | "json";
  /** Streaming response display */
  streaming: boolean;
}

/**
 * Privacy configuration
 */
export interface PrivacyConfig {
  /** Enable privacy mode */
  enabled: boolean;
  /** Redaction level */
  redactionLevel: "none" | "basic" | "strict";
  /** Local encoding only */
  localOnly: boolean;
}

/**
 * Aequor CLI configuration
 */
export interface AequorConfig {
  /** Version of config format */
  version: string;
  /** Backend configuration */
  backend: BackendConfig;
  /** Routing configuration */
  routing: RoutingConfig;
  /** Budget configuration */
  budget: BudgetConfig;
  /** Cache configuration */
  cache: CacheConfig;
  /** Display configuration */
  display: DisplayConfig;
  /** Privacy configuration */
  privacy: PrivacyConfig;
  /** Current default model */
  defaultModel: string;
  /** Available local models */
  localModels: string[];
  /** Available cloud models */
  cloudModels: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AequorConfig = {
  version: "1.0.0",
  backend: {
    type: "hybrid",
    localUrl: "http://localhost:11434",
    cloud: {
      apiKey: "",
      baseURL: "https://api.openai.com/v1",
    },
  },
  routing: {
    complexityThreshold: 0.7,
    localFirst: true,
    maxRetries: 3,
    timeout: 30000,
  },
  budget: {
    daily: 100, // $1.00
    weekly: 500, // $5.00
    monthly: 2000, // $20.00
    alertThreshold: 80,
  },
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 3600,
    directory: "~/.aequor/cache",
  },
  display: {
    colorize: true,
    showTimestamp: false,
    format: "text",
    streaming: true,
  },
  privacy: {
    enabled: false,
    redactionLevel: "basic",
    localOnly: false,
  },
  defaultModel: "llama2:7b",
  localModels: ["llama2:7b", "llama2:13b", "mistral:7b"],
  cloudModels: ["gpt-3.5-turbo", "gpt-4-turbo-preview"],
};

/**
 * Configuration file locations by platform
 */
export const CONFIG_PATHS = {
  darwin: `${process.env.HOME}/Library/Application Support/Aequor/config.json`,
  linux: `${process.env.HOME}/.config/aequor/config.json`,
  win32: `${process.env.APPDATA}\\Aequor\\config.json`,
} as const;
