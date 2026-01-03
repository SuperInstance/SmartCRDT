/**
 * @lsi/config - Configuration Management
 *
 * Manages Aequor platform configuration with:
 * - YAML-based configuration files
 * - Hierarchical configuration (global, component, user)
 * - Environment variable overrides
 * - Configuration validation
 * - Hot reloading support
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Aequor global configuration
 */
export interface AequorConfig {
  /** Registry URL for component downloads */
  registry_url: string;
  /** Local cache path */
  cache_path: string;
  /** Component installation path */
  components_path: string;
  /** Configuration files path */
  config_path: string;
  /** Maximum cache size in bytes */
  max_cache_size: number;
  /** Enable automatic updates */
  auto_update: boolean;
  /** Hardware profile for optimizations */
  hardware_profile: 'low' | 'medium' | 'high';
  /** Maximum concurrent downloads */
  concurrent_downloads: number;
  /** Network timeout in milliseconds */
  timeout: number;
  /** Log level */
  log_level: 'debug' | 'info' | 'warn' | 'error';
  /** Enable telemetry */
  telemetry_enabled: boolean;
  /** Proxy configuration */
  proxy?: {
    http_proxy?: string;
    https_proxy?: string;
    no_proxy?: string[];
  };
  /** Authentication configuration */
  auth?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Component-specific configuration
 */
export interface ComponentConfig {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Component-specific settings */
  settings: Record<string, unknown>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Resource limits */
  limits?: {
    max_memory?: number;
    max_cpu?: number;
    max_execution_time?: number;
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Invalid configuration paths */
  invalidPaths: string[];
}

/**
 * Configuration source
 */
export type ConfigSource = 'file' | 'env' | 'cli' | 'default';

/**
 * Configuration value with metadata
 */
export interface ConfigValue<T = unknown> {
  /** The value */
  value: T;
  /** Source of the value */
  source: ConfigSource;
  /** Whether value was overridden */
  overridden: boolean;
  /** Value path (dot notation) */
  path: string;
}

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

/**
 * Manages Aequor platform configuration
 */
export class ConfigManager {
  private configPath: string;
  private config: AequorConfig;
  private componentConfigs: Map<string, ComponentConfig>;
  private envPrefix: string;
  private watchers: fs.FSWatcher[];
  private changeListeners: Map<string, ((config: AequorConfig) => void)[]>;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.getDefaultConfig();
    this.componentConfigs = new Map();
    this.envPrefix = 'AEQUOR_';
    this.watchers = [];
    this.changeListeners = new Map();
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Load configuration from file
   */
  async load(): Promise<AequorConfig> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const content = await fs.readFile(this.configPath, 'utf8');
        const fileConfig = YAML.parse(content) as Partial<AequorConfig>;

        // Merge with defaults
        this.config = this.mergeConfigs(this.getDefaultConfig(), fileConfig);

        // Apply environment variable overrides
        this.applyEnvOverrides();

        // Validate configuration
        const validation = this.validate();
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        return this.config;
      } else {
        // Create default configuration
        await this.save(this.config);
        return this.config;
      }
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save configuration to file
   */
  async save(config: AequorConfig): Promise<void> {
    try {
      // Validate before saving
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.configPath));

      // Write to file
      const content = YAML.stringify(config, {
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
      });

      await fs.writeFile(this.configPath, content, 'utf8');

      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get configuration value by path (dot notation)
   */
  get<T = unknown>(path: string): T | undefined {
    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set configuration value by path (dot notation)
   */
  set<T = unknown>(path: string, value: T): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Merge configuration with existing
   */
  merge(config: Partial<AequorConfig>): void {
    this.config = this.mergeConfigs(this.config, config);
  }

  /**
   * Get complete configuration
   */
  getAll(): AequorConfig {
    return { ...this.config };
  }

  /**
   * Validate current configuration
   */
  validate(): ValidationResult {
    return this.validateConfig(this.config);
  }

  /**
   * Reset to default configuration
   */
  async reset(): Promise<void> {
    this.config = this.getDefaultConfig();
    await this.save(this.config);
  }

  // ============================================================================
  // COMPONENT CONFIGURATION
  // ============================================================================

  /**
   * Load component configuration
   */
  async loadComponentConfig(componentName: string): Promise<ComponentConfig | undefined> {
    const componentConfigPath = path.join(
      this.config.components_path,
      componentName,
      'config.yaml'
    );

    if (await fs.pathExists(componentConfigPath)) {
      const content = await fs.readFile(componentConfigPath, 'utf8');
      const config = YAML.parse(content) as ComponentConfig;
      this.componentConfigs.set(componentName, config);
      return config;
    }

    return undefined;
  }

  /**
   * Save component configuration
   */
  async saveComponentConfig(componentName: string, config: ComponentConfig): Promise<void> {
    const componentConfigPath = path.join(
      this.config.components_path,
      componentName,
      'config.yaml'
    );

    await fs.ensureDir(path.dirname(componentConfigPath));

    const content = YAML.stringify(config, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    });

    await fs.writeFile(componentConfigPath, content, 'utf8');

    this.componentConfigs.set(componentName, config);
  }

  /**
   * Get component configuration
   */
  getComponentConfig(componentName: string): ComponentConfig | undefined {
    return this.componentConfigs.get(componentName);
  }

  // ============================================================================
  // HOT RELOADING
  // ============================================================================

  /**
   * Watch configuration file for changes
   */
  async watch(callback: (config: AequorConfig) => void): Promise<void> {
    if (!this.changeListeners.has('change')) {
      this.changeListeners.set('change', []);
    }
    this.changeListeners.get('change')!.push(callback);

    if (this.watchers.length === 0) {
      const watcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            await this.load();
            const listeners = this.changeListeners.get('change') || [];
            for (const listener of listeners) {
              listener(this.config);
            }
          } catch (error) {
            console.error('Failed to reload configuration:', error);
          }
        }
      });

      this.watchers.push(watcher);
    }
  }

  /**
   * Stop watching configuration file
   */
  async unwatch(): Promise<void> {
    for (const watcher of this.watchers) {
      await watcher.close();
    }
    this.watchers = [];
    this.changeListeners.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get default configuration path
   */
  private getDefaultConfigPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.aequor', 'config', 'config.yaml');
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AequorConfig {
    const homeDir = os.homedir();
    return {
      registry_url: 'https://registry.aequor.dev',
      cache_path: path.join(homeDir, '.aequor', 'cache'),
      components_path: path.join(homeDir, '.aequor', 'components'),
      config_path: path.join(homeDir, '.aequor', 'config'),
      max_cache_size: 5 * 1024 * 1024 * 1024, // 5GB
      auto_update: false,
      hardware_profile: 'medium',
      concurrent_downloads: 3,
      timeout: 30000,
      log_level: 'info',
      telemetry_enabled: false,
    };
  }

  /**
   * Merge configurations
   */
  private mergeConfigs(base: AequorConfig, override: Partial<AequorConfig>): AequorConfig {
    return {
      ...base,
      ...override,
      proxy: override.proxy ? { ...base.proxy, ...override.proxy } : base.proxy,
      auth: override.auth ? { ...base.auth, ...override.auth } : base.auth,
    };
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvOverrides(): void {
    // Registry URL
    if (process.env.AEQUOR_REGISTRY_URL) {
      this.config.registry_url = process.env.AEQUOR_REGISTRY_URL;
    }

    // Cache path
    if (process.env.AEQUOR_CACHE_PATH) {
      this.config.cache_path = process.env.AEQUOR_CACHE_PATH;
    }

    // Components path
    if (process.env.AEQUOR_COMPONENTS_PATH) {
      this.config.components_path = process.env.AEQUOR_COMPONENTS_PATH;
    }

    // Max cache size
    if (process.env.AEQUOR_MAX_CACHE_SIZE) {
      const size = parseInt(process.env.AEQUOR_MAX_CACHE_SIZE, 10);
      if (!isNaN(size)) {
        this.config.max_cache_size = size;
      }
    }

    // Auto update
    if (process.env.AEQUOR_AUTO_UPDATE) {
      this.config.auto_update = process.env.AEQUOR_AUTO_UPDATE === 'true';
    }

    // Hardware profile
    if (process.env.AEQUOR_HARDWARE_PROFILE) {
      const profile = process.env.AEQUOR_HARDWARE_PROFILE;
      if (profile === 'low' || profile === 'medium' || profile === 'high') {
        this.config.hardware_profile = profile;
      }
    }

    // Concurrent downloads
    if (process.env.AEQUOR_CONCURRENT_DOWNLOADS) {
      const count = parseInt(process.env.AEQUOR_CONCURRENT_DOWNLOADS, 10);
      if (!isNaN(count)) {
        this.config.concurrent_downloads = count;
      }
    }

    // Timeout
    if (process.env.AEQUOR_TIMEOUT) {
      const timeout = parseInt(process.env.AEQUOR_TIMEOUT, 10);
      if (!isNaN(timeout)) {
        this.config.timeout = timeout;
      }
    }

    // Log level
    if (process.env.AEQUOR_LOG_LEVEL) {
      const level = process.env.AEQUOR_LOG_LEVEL;
      if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
        this.config.log_level = level;
      }
    }

    // Telemetry
    if (process.env.AEQUOR_TELEMETRY_ENABLED) {
      this.config.telemetry_enabled = process.env.AEQUOR_TELEMETRY_ENABLED === 'true';
    }

    // Proxy settings
    if (process.env.HTTP_PROXY || process.env.http_proxy) {
      if (!this.config.proxy) {
        this.config.proxy = {};
      }
      this.config.proxy.http_proxy = process.env.HTTP_PROXY || process.env.http_proxy;
    }

    if (process.env.HTTPS_PROXY || process.env.https_proxy) {
      if (!this.config.proxy) {
        this.config.proxy = {};
      }
      this.config.proxy.https_proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    }

    if (process.env.NO_PROXY || process.env.no_proxy) {
      if (!this.config.proxy) {
        this.config.proxy = {};
      }
      const noProxy = process.env.NO_PROXY || process.env.no_proxy;
      this.config.proxy.no_proxy = noProxy.split(',').map(s => s.trim());
    }

    // Auth settings
    if (process.env.AEQUOR_AUTH_TOKEN) {
      if (!this.config.auth) {
        this.config.auth = {};
      }
      this.config.auth.token = process.env.AEQUOR_AUTH_TOKEN;
    }

    if (process.env.AEQUOR_AUTH_USERNAME) {
      if (!this.config.auth) {
        this.config.auth = {};
      }
      this.config.auth.username = process.env.AEQUOR_AUTH_USERNAME;
    }

    if (process.env.AEQUOR_AUTH_PASSWORD) {
      if (!this.config.auth) {
        this.config.auth = {};
      }
      this.config.auth.password = process.env.AEQUOR_AUTH_PASSWORD;
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: AequorConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const invalidPaths: string[] = [];

    // Validate registry URL
    try {
      new URL(config.registry_url);
    } catch {
      errors.push('Invalid registry_url');
      invalidPaths.push('registry_url');
    }

    // Validate paths
    if (!path.isAbsolute(config.cache_path)) {
      errors.push('cache_path must be an absolute path');
      invalidPaths.push('cache_path');
    }

    if (!path.isAbsolute(config.components_path)) {
      errors.push('components_path must be an absolute path');
      invalidPaths.push('components_path');
    }

    if (!path.isAbsolute(config.config_path)) {
      errors.push('config_path must be an absolute path');
      invalidPaths.push('config_path');
    }

    // Validate numeric values
    if (config.max_cache_size <= 0) {
      errors.push('max_cache_size must be positive');
      invalidPaths.push('max_cache_size');
    }

    if (config.concurrent_downloads < 1 || config.concurrent_downloads > 10) {
      warnings.push('concurrent_downloads should be between 1 and 10');
    }

    if (config.timeout <= 0) {
      errors.push('timeout must be positive');
      invalidPaths.push('timeout');
    }

    // Validate enum values
    if (!['low', 'medium', 'high'].includes(config.hardware_profile)) {
      errors.push('hardware_profile must be low, medium, or high');
      invalidPaths.push('hardware_profile');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(config.log_level)) {
      errors.push('log_level must be debug, info, warn, or error');
      invalidPaths.push('log_level');
    }

    // Validate proxy URLs if provided
    if (config.proxy) {
      if (config.proxy.http_proxy) {
        try {
          new URL(config.proxy.http_proxy);
        } catch {
          errors.push('Invalid proxy.http_proxy');
          invalidPaths.push('proxy.http_proxy');
        }
      }

      if (config.proxy.https_proxy) {
        try {
          new URL(config.proxy.https_proxy);
        } catch {
          errors.push('Invalid proxy.https_proxy');
          invalidPaths.push('proxy.https_proxy');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      invalidPaths,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create configuration manager with default path
 */
export async function createConfigManager(configPath?: string): Promise<ConfigManager> {
  const manager = new ConfigManager(configPath);
  await manager.load();
  return manager;
}

/**
 * Detect hardware profile
 */
export function detectHardwareProfile(): 'low' | 'medium' | 'high' {
  const totalMemory = os.totalmem();
  const cpuCount = os.cpus().length;

  // High: >16GB RAM, >8 cores
  if (totalMemory > 16 * 1024 * 1024 * 1024 && cpuCount > 8) {
    return 'high';
  }

  // Medium: >8GB RAM, >4 cores
  if (totalMemory > 8 * 1024 * 1024 * 1024 && cpuCount > 4) {
    return 'medium';
  }

  // Low: Everything else
  return 'low';
}

/**
 * Format configuration for display
 */
export function formatConfig(config: AequorConfig): string {
  const lines: string[] = [];

  lines.push('Aequor Configuration:');
  lines.push('=======================');
  lines.push(`Registry URL: ${config.registry_url}`);
  lines.push(`Cache Path: ${config.cache_path}`);
  lines.push(`Components Path: ${config.components_path}`);
  lines.push(`Config Path: ${config.config_path}`);
  lines.push(`Max Cache Size: ${formatBytes(config.max_cache_size)}`);
  lines.push(`Auto Update: ${config.auto_update}`);
  lines.push(`Hardware Profile: ${config.hardware_profile}`);
  lines.push(`Concurrent Downloads: ${config.concurrent_downloads}`);
  lines.push(`Timeout: ${config.timeout}ms`);
  lines.push(`Log Level: ${config.log_level}`);
  lines.push(`Telemetry Enabled: ${config.telemetry_enabled}`);

  if (config.proxy) {
    lines.push('\nProxy:');
    if (config.proxy.http_proxy) {
      lines.push(`  HTTP Proxy: ${config.proxy.http_proxy}`);
    }
    if (config.proxy.https_proxy) {
      lines.push(`  HTTPS Proxy: ${config.proxy.https_proxy}`);
    }
    if (config.proxy.no_proxy && config.proxy.no_proxy.length > 0) {
      lines.push(`  No Proxy: ${config.proxy.no_proxy.join(', ')}`);
    }
  }

  if (config.auth) {
    lines.push('\nAuthentication:');
    if (config.auth.token) {
      lines.push(`  Token: ${config.auth.token.substring(0, 10)}...`);
    }
    if (config.auth.username) {
      lines.push(`  Username: ${config.auth.username}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
