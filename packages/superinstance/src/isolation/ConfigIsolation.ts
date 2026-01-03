/**
 * @fileoverview Config Isolation - Multi-Tenant Configuration Isolation
 *
 * Manages per-tenant configuration isolation:
 * - Per-tenant model preferences
 * - Per-tenant routing rules
 * - Per-tenant privacy settings
 * - Per-tenant hardware preferences
 *
 * @module @lsi/superinstance/isolation/ConfigIsolation
 */

import type {
  TenantId,
  TenantConfig,
  ModelPreferences,
  RoutingRules,
  PrivacySettings,
  HardwarePreferences,
  CacheConfiguration,
} from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ConfigIsolationError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "ConfigIsolationError";
  }
}

// ============================================================================
// CONFIG ISOLATION MANAGER
// ============================================================================

export interface ConfigIsolationManagerConfig {
  enableConfigValidation?: boolean;
  enableConfigCaching?: boolean;
}

export class ConfigIsolationManager {
  private config: ConfigIsolationManagerConfig;
  private configs: Map<TenantId, TenantConfig> = new Map();
  private modelPreferences: Map<TenantId, ModelPreferences> = new Map();
  private routingRules: Map<TenantId, RoutingRules> = new Map();
  private privacySettings: Map<TenantId, PrivacySettings> = new Map();
  private hardwarePreferences: Map<TenantId, HardwarePreferences> = new Map();
  private cacheConfigurations: Map<TenantId, CacheConfiguration> = new Map();

  constructor(config?: ConfigIsolationManagerConfig) {
    this.config = {
      enableConfigValidation: true,
      enableConfigCaching: true,
      ...config,
    };
  }

  // ========================================================================
  // TENANT CONFIG
  // ========================================================================

  /**
   * Get tenant config
   */
  getTenantConfig(tenantId: TenantId): TenantConfig | undefined {
    return this.configs.get(tenantId);
  }

  /**
   * Set tenant config
   */
  setTenantConfig(tenantId: TenantId, config: TenantConfig): void {
    if (this.config.enableConfigValidation) {
      this.validateTenantConfig(config);
    }
    this.configs.set(tenantId, config);
  }

  /**
   * Update tenant config
   */
  updateTenantConfig(
    tenantId: TenantId,
    updates: Partial<TenantConfig>
  ): TenantConfig {
    const existing = this.configs.get(tenantId);
    if (!existing) {
      throw new ConfigIsolationError(
        `Tenant config not found: ${tenantId}`,
        "CONFIG_NOT_FOUND",
        tenantId
      );
    }

    const updated: TenantConfig = {
      ...existing,
      ...updates,
      tenantId, // Ensure ID doesn't change
      updatedAt: Date.now(),
    };

    if (this.config.enableConfigValidation) {
      this.validateTenantConfig(updated);
    }

    this.configs.set(tenantId, updated);
    return updated;
  }

  // ========================================================================
  // MODEL PREFERENCES
  // ========================================================================

  /**
   * Get model preferences for tenant
   */
  getModelPreferences(tenantId: TenantId): ModelPreferences | undefined {
    return this.modelPreferences.get(tenantId);
  }

  /**
   * Set model preferences for tenant
   */
  setModelPreferences(tenantId: TenantId, preferences: ModelPreferences): void {
    this.modelPreferences.set(tenantId, preferences);
  }

  /**
   * Get default model for tenant
   */
  getDefaultModel(tenantId: TenantId): string | undefined {
    const preferences = this.modelPreferences.get(tenantId);
    return preferences?.defaultModel;
  }

  /**
   * Check if model is allowed for tenant
   */
  isModelAllowed(tenantId: TenantId, model: string): boolean {
    const preferences = this.modelPreferences.get(tenantId);
    if (!preferences) {
      return true; // No restrictions
    }

    // Check blocklist
    if (preferences.blockedModels?.includes(model)) {
      return false;
    }

    // Check allowlist
    if (preferences.allowedModels.length > 0) {
      return preferences.allowedModels.includes(model);
    }

    return true;
  }

  // ========================================================================
  // ROUTING RULES
  // ========================================================================

  /**
   * Get routing rules for tenant
   */
  getRoutingRules(tenantId: TenantId): RoutingRules | undefined {
    return this.routingRules.get(tenantId);
  }

  /**
   * Set routing rules for tenant
   */
  setRoutingRules(tenantId: TenantId, rules: RoutingRules): void {
    this.routingRules.set(tenantId, rules);
  }

  /**
   * Get complexity threshold for tenant
   */
  getComplexityThreshold(tenantId: TenantId): number {
    const rules = this.routingRules.get(tenantId);
    return rules?.complexityThreshold ?? 0.7;
  }

  /**
   * Get confidence threshold for tenant
   */
  getConfidenceThreshold(tenantId: TenantId): number {
    const rules = this.routingRules.get(tenantId);
    return rules?.confidenceThreshold ?? 0.6;
  }

  // ========================================================================
  // PRIVACY SETTINGS
  // ========================================================================

  /**
   * Get privacy settings for tenant
   */
  getPrivacySettings(tenantId: TenantId): PrivacySettings | undefined {
    return this.privacySettings.get(tenantId);
  }

  /**
   * Set privacy settings for tenant
   */
  setPrivacySettings(tenantId: TenantId, settings: PrivacySettings): void {
    this.privacySettings.set(tenantId, settings);
  }

  /**
   * Check if redaction is enabled for tenant
   */
  isRedactionEnabled(tenantId: TenantId): boolean {
    const settings = this.privacySettings.get(tenantId);
    return settings?.enableRedaction ?? false;
  }

  /**
   * Get epsilon for tenant
   */
  getEpsilon(tenantId: TenantId): number {
    const settings = this.privacySettings.get(tenantId);
    return settings?.epsilon ?? 1.0;
  }

  // ========================================================================
  // HARDWARE PREFERENCES
  // ========================================================================

  /**
   * Get hardware preferences for tenant
   */
  getHardwarePreferences(tenantId: TenantId): HardwarePreferences | undefined {
    return this.hardwarePreferences.get(tenantId);
  }

  /**
   * Set hardware preferences for tenant
   */
  setHardwarePreferences(tenantId: TenantId, preferences: HardwarePreferences): void {
    this.hardwarePreferences.set(tenantId, preferences);
  }

  /**
   * Check if GPU is preferred for tenant
   */
  isGPUPreferred(tenantId: TenantId): boolean {
    const preferences = this.hardwarePreferences.get(tenantId);
    return preferences?.preferGPU ?? false;
  }

  /**
   * Get maximum temperature for tenant
   */
  getMaxTemperature(tenantId: TenantId): number | undefined {
    const preferences = this.hardwarePreferences.get(tenantId);
    return preferences?.maxTemperature;
  }

  // ========================================================================
  // CACHE CONFIGURATION
  // ========================================================================

  /**
   * Get cache configuration for tenant
   */
  getCacheConfiguration(tenantId: TenantId): CacheConfiguration | undefined {
    return this.cacheConfigurations.get(tenantId);
  }

  /**
   * Set cache configuration for tenant
   */
  setCacheConfiguration(tenantId: TenantId, config: CacheConfiguration): void {
    this.cacheConfigurations.set(tenantId, config);
  }

  /**
   * Check if cache is enabled for tenant
   */
  isCacheEnabled(tenantId: TenantId): boolean {
    const config = this.cacheConfigurations.get(tenantId);
    return config?.enabled ?? true;
  }

  /**
   * Get cache partition for tenant
   */
  getCachePartition(tenantId: TenantId): string {
    const config = this.cacheConfigurations.get(tenantId);
    return config?.partition ?? `tenant_${tenantId}`;
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate tenant config
   */
  private validateTenantConfig(config: TenantConfig): void {
    // Validate quotas
    if (config.quotas.rateLimit.requestsPerSecond < 0) {
      throw new ConfigIsolationError(
        "Invalid rate limit",
        "INVALID_RATE_LIMIT",
        config.tenantId
      );
    }

    if (config.quotas.tokenQuota.tokensPerDay < 0) {
      throw new ConfigIsolationError(
        "Invalid token quota",
        "INVALID_TOKEN_QUOTA",
        config.tenantId
      );
    }

    if (config.quotas.storageQuota.maxStorageBytes < 0) {
      throw new ConfigIsolationError(
        "Invalid storage quota",
        "INVALID_STORAGE_QUOTA",
        config.tenantId
      );
    }

    if (config.quotas.inferenceQuota.maxConcurrentRequests < 0) {
      throw new ConfigIsolationError(
        "Invalid inference quota",
        "INVALID_INFERENCE_QUOTA",
        config.tenantId
      );
    }
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Remove all config for tenant
   */
  removeTenant(tenantId: TenantId): void {
    this.configs.delete(tenantId);
    this.modelPreferences.delete(tenantId);
    this.routingRules.delete(tenantId);
    this.privacySettings.delete(tenantId);
    this.hardwarePreferences.delete(tenantId);
    this.cacheConfigurations.delete(tenantId);
  }

  /**
   * Clear all configs
   */
  clearAll(): void {
    this.configs.clear();
    this.modelPreferences.clear();
    this.routingRules.clear();
    this.privacySettings.clear();
    this.hardwarePreferences.clear();
    this.cacheConfigurations.clear();
  }
}
