/**
 * @lsi/core/tuning - ParameterController for Aequor Cognitive Orchestration Platform
 *
 * Parameter control API with:
 * - Register tunable parameters
 * - Get and set parameter values
 * - Apply parameters to actual system
 * - Validation and constraints
 * - Category-based dispatch
 */

import { TunableParameter, ParameterCategory } from "./AutoTuner.js";

/**
 * Parameter application callback
 */
type ParameterApplicator = (
  name: string,
  value: number
) => Promise<void> | void;

/**
 * ParameterController - Controls tunable parameters
 *
 * The ParameterController manages the lifecycle of tunable parameters,
 * including registration, validation, and application to the actual system.
 */
export class ParameterController {
  private parameters: Map<string, TunableParameter>;
  private applicators: Map<ParameterCategory, ParameterApplicator[]>;
  private systemValues: Map<string, any>;

  constructor() {
    this.parameters = new Map();
    this.applicators = new Map();
    this.systemValues = new Map();

    // Initialize applicators for each category
    for (const category of [
      "cache",
      "routing",
      "thermal",
      "memory",
      "network",
    ] as ParameterCategory[]) {
      this.applicators.set(category, []);
    }
  }

  /**
   * Register tunable parameter
   */
  register(parameter: TunableParameter): void {
    this.parameters.set(parameter.name, { ...parameter });
    console.log(
      `[ParameterController] Registered parameter: ${parameter.name}`
    );
  }

  /**
   * Register multiple parameters
   */
  registerAll(parameters: TunableParameter[]): void {
    for (const param of parameters) {
      this.register(param);
    }
  }

  /**
   * Unregister parameter
   */
  unregister(name: string): void {
    this.parameters.delete(name);
  }

  /**
   * Get all parameters
   */
  async getAll(): Promise<TunableParameter[]> {
    return Array.from(this.parameters.values()).map(p => ({ ...p }));
  }

  /**
   * Get parameters by category
   */
  async getByCategory(
    category: ParameterCategory
  ): Promise<TunableParameter[]> {
    return Array.from(this.parameters.values())
      .filter(p => p.category === category)
      .map(p => ({ ...p }));
  }

  /**
   * Get single parameter
   */
  async get(name: string): Promise<TunableParameter | null> {
    const param = this.parameters.get(name);
    return param ? { ...param } : null;
  }

  /**
   * Get parameter value
   */
  async getValue(name: string): Promise<number | null> {
    const param = this.parameters.get(name);
    return param ? param.currentValue : null;
  }

  /**
   * Set parameter value
   */
  async set(name: string, value: number): Promise<void> {
    const param = this.parameters.get(name);
    if (!param) {
      throw new Error(`Parameter ${name} not found`);
    }

    // Validate value
    if (!this.validateParameterValue(param, value)) {
      throw new Error(
        `Invalid value ${value} for parameter ${name}. ` +
          `Must be between ${param.minValue} and ${param.maxValue}`
      );
    }

    const oldValue = param.currentValue;

    // Apply value
    await this.applyParameterValue(param, value);

    // Update current value
    param.currentValue = value;

    console.log(
      `[ParameterController] Set ${name} = ${value} (was ${oldValue})`
    );
  }

  /**
   * Set multiple parameters
   */
  async setMany(values: Map<string, number>): Promise<void> {
    for (const [name, value] of values.entries()) {
      await this.set(name, value);
    }
  }

  /**
   * Reset parameter to default
   */
  async reset(name: string): Promise<void> {
    const param = this.parameters.get(name);
    if (!param) {
      throw new Error(`Parameter ${name} not found`);
    }

    // Use mid-point of range as default
    const defaultValue = (param.minValue + param.maxValue) / 2;
    await this.set(name, defaultValue);
  }

  /**
   * Reset all parameters
   */
  async resetAll(): Promise<void> {
    for (const name of this.parameters.keys()) {
      await this.reset(name);
    }
  }

  /**
   * Validate parameter value
   */
  private validateParameterValue(
    param: TunableParameter,
    value: number
  ): boolean {
    // Check range
    if (value < param.minValue || value > param.maxValue) {
      return false;
    }

    // Check custom validation
    if (param.validate && !param.validate(value)) {
      return false;
    }

    return true;
  }

  /**
   * Apply parameter value to system
   */
  private async applyParameterValue(
    parameter: TunableParameter,
    value: number
  ): Promise<void> {
    // Call registered applicators for this category
    const applicators = this.applicators.get(parameter.category) || [];

    for (const applicator of applicators) {
      try {
        await applicator(parameter.name, value);
      } catch (error) {
        console.error(
          `[ParameterController] Error applying ${parameter.name}:`,
          error
        );
      }
    }

    // Apply to internal system values
    await this.applyToSystemValue(parameter, value);
  }

  /**
   * Apply to internal system value
   */
  private async applyToSystemValue(
    parameter: TunableParameter,
    value: number
  ): Promise<void> {
    // Store in system values map for retrieval
    this.systemValues.set(parameter.name, value);

    // Apply based on parameter name
    switch (parameter.name) {
      case "cache.maxSize":
        await this.applyCacheMaxSize(value);
        break;
      case "cache.ttl":
        await this.applyCacheTTL(value);
        break;
      case "cache.similarityThreshold":
        await this.applyCacheSimilarityThreshold(value);
        break;
      case "routing.complexityThreshold":
        await this.applyRoutingComplexityThreshold(value);
        break;
      case "routing.confidenceThreshold":
        await this.applyRoutingConfidenceThreshold(value);
        break;
      case "thermal.throttleThreshold":
        await this.applyThermalThrottleThreshold(value);
        break;
      case "thermal.targetTemperature":
        await this.applyThermalTargetTemperature(value);
        break;
      case "memory.maxCacheSize":
        await this.applyMemoryMaxCacheSize(value);
        break;
      case "memory.vectorCacheSize":
        await this.applyMemoryVectorCacheSize(value);
        break;
    }
  }

  /**
   * Apply cache max size
   */
  private async applyCacheMaxSize(value: number): Promise<void> {
    // In a real implementation, this would configure the actual cache
    console.log(`[ParameterController] Applying cache.maxSize = ${value}`);
  }

  /**
   * Apply cache TTL
   */
  private async applyCacheTTL(value: number): Promise<void> {
    console.log(`[ParameterController] Applying cache.ttl = ${value}`);
  }

  /**
   * Apply cache similarity threshold
   */
  private async applyCacheSimilarityThreshold(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying cache.similarityThreshold = ${value}`
    );
  }

  /**
   * Apply routing complexity threshold
   */
  private async applyRoutingComplexityThreshold(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying routing.complexityThreshold = ${value}`
    );
  }

  /**
   * Apply routing confidence threshold
   */
  private async applyRoutingConfidenceThreshold(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying routing.confidenceThreshold = ${value}`
    );
  }

  /**
   * Apply thermal throttle threshold
   */
  private async applyThermalThrottleThreshold(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying thermal.throttleThreshold = ${value}`
    );
  }

  /**
   * Apply thermal target temperature
   */
  private async applyThermalTargetTemperature(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying thermal.targetTemperature = ${value}`
    );
  }

  /**
   * Apply memory max cache size
   */
  private async applyMemoryMaxCacheSize(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying memory.maxCacheSize = ${value}`
    );
  }

  /**
   * Apply memory vector cache size
   */
  private async applyMemoryVectorCacheSize(value: number): Promise<void> {
    console.log(
      `[ParameterController] Applying memory.vectorCacheSize = ${value}`
    );
  }

  /**
   * Register applicator for parameter category
   */
  registerApplicator(
    category: ParameterCategory,
    applicator: ParameterApplicator
  ): void {
    const applicators = this.applicators.get(category) || [];
    applicators.push(applicator);
    this.applicators.set(category, applicators);
  }

  /**
   * Get system value
   */
  getSystemValue(name: string): any {
    return this.systemValues.get(name);
  }

  /**
   * Get all system values
   */
  getAllSystemValues(): Map<string, any> {
    return new Map(this.systemValues);
  }

  /**
   * Check if parameter exists
   */
  has(name: string): boolean {
    return this.parameters.has(name);
  }

  /**
   * Get parameter count
   */
  count(): number {
    return this.parameters.size;
  }

  /**
   * Get parameter names
   */
  getNames(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * Get categories
   */
  getCategories(): ParameterCategory[] {
    return Array.from(this.applicators.keys());
  }
}

/**
 * Create a ParameterController
 */
export function createParameterController(): ParameterController {
  return new ParameterController();
}
