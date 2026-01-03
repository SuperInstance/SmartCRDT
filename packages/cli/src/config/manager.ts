/**
 * Configuration manager for Aequor CLI
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { AequorConfig, BudgetConfig, RoutingConfig } from "./types.js";
import { DEFAULT_CONFIG, CONFIG_PATHS } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Configuration manager
 */
export class ConfigManager {
  private configPath: string;
  private config: AequorConfig | null = null;
  private cacheDir: string;

  constructor() {
    const platform = process.platform as keyof typeof CONFIG_PATHS;
    this.configPath = CONFIG_PATHS[platform] || CONFIG_PATHS.linux;
    this.cacheDir = path.join(os.homedir(), ".aequor", "cache");
  }

  /**
   * Get the configuration path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get the cache directory
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<AequorConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const configData = await fs.readFile(this.configPath, "utf-8");
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
      logger.debug(`Loaded config from ${this.configPath}`);
      return this.config!;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug("Config file not found, using defaults");
        this.config = { ...DEFAULT_CONFIG };
        await this.save();
        return this.config;
      }
      logger.error(`Failed to load config: ${(error as Error).message}`);
      this.config = { ...DEFAULT_CONFIG };
      return this.config;
    }
  }

  /**
   * Save configuration to file
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error("No config loaded");
    }

    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
      logger.debug(`Saved config to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save config: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get a configuration value by path
   */
  async get(path: string): Promise<unknown> {
    const config = await this.load();
    const keys = path.split(".");
    let value: unknown = config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration value by path
   */
  async set(path: string, value: unknown): Promise<void> {
    const config = await this.load();
    const keys = path.split(".");
    const lastKey = keys.pop()!;

    if (!lastKey) {
      throw new Error("Invalid config path");
    }

    let target: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (const key of keys) {
      if (!(key in target)) {
        (target as Record<string, unknown>)[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }

    target[lastKey] = value;
    await this.save();
    logger.success(`Set ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * Get all configuration
   */
  async getAll(): Promise<AequorConfig> {
    return this.load();
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
    logger.success("Reset configuration to defaults");
  }

  /**
   * Get backend configuration
   */
  async getBackendConfig() {
    const config = await this.load();
    return config.backend;
  }

  /**
   * Get routing configuration
   */
  async getRoutingConfig(): Promise<RoutingConfig> {
    const config = await this.load();
    return config.routing;
  }

  /**
   * Get budget configuration
   */
  async getBudgetConfig(): Promise<BudgetConfig> {
    const config = await this.load();
    return config.budget;
  }

  /**
   * Get API key for cloud backend
   */
  async getApiKey(): Promise<string> {
    const config = await this.load();
    return config.backend.cloud?.apiKey || "";
  }

  /**
   * Set API key for cloud backend
   */
  async setApiKey(apiKey: string): Promise<void> {
    const config = await this.load();
    if (!config.backend.cloud) {
      config.backend.cloud = {} as any;
    }
    config.backend.cloud!.apiKey = apiKey;
    await this.save();
    logger.success("API key updated");
  }

  /**
   * Get default model
   */
  async getDefaultModel(): Promise<string> {
    const config = await this.load();
    return config.defaultModel;
  }

  /**
   * Set default model
   */
  async setDefaultModel(model: string): Promise<void> {
    await this.set("defaultModel", model);
  }

  /**
   * Check if a config value exists
   */
  async has(path: string): Promise<boolean> {
    return (await this.get(path)) !== undefined;
  }

  /**
   * Delete a configuration value by path
   */
  async delete(path: string): Promise<void> {
    const config = await this.load();
    const keys = path.split(".");
    const lastKey = keys.pop()!;

    if (!lastKey) {
      throw new Error("Invalid config path");
    }

    let target: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (const key of keys) {
      if (key in target && typeof target[key] === "object") {
        target = target[key] as Record<string, unknown>;
      } else {
        logger.warn(`Config path ${path} does not exist`);
        return;
      }
    }

    delete target[lastKey];
    await this.save();
    logger.success(`Deleted ${path}`);
  }

  /**
   * Initialize cache directory
   */
  async initCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.debug(`Cache directory initialized: ${this.cacheDir}`);
    } catch (error) {
      logger.error(
        `Failed to create cache directory: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Clear cache directory
   */
  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await this.initCacheDir();
      logger.success("Cache cleared");
    } catch (error) {
      logger.error(`Failed to clear cache: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * Global config manager instance
 */
export const configManager = new ConfigManager();
