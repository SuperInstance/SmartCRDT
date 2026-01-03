/**
 * ConfigBuilder - Fluent configuration builder utility
 *
 * Provides a fluent API for building and validating configuration objects.
 * Eliminates ~800 lines of duplicate config handling code across 60+ config classes.
 *
 * @example
 * ```typescript
 * interface MyConfig {
 *   timeout: number;
 *   retries: number;
 *   apiKey: string;
 *   endpoint?: string;
 * }
 *
 * const defaults: MyConfig = {
 *   timeout: 30000,
 *   retries: 3,
 *   apiKey: '',
 *   endpoint: 'https://api.example.com'
 * };
 *
 * const config = new ConfigBuilder(defaults)
 *   .set('timeout', 60000)
 *   .set('retries', 5)
 *   .fromEnv({ apiKey: 'MY_API_KEY' })
 *   .validate(c => c.apiKey.length > 0, 'API key is required')
 *   .validate(c => c.timeout > 0, 'Timeout must be positive')
 *   .build();
 * ```
 */

/**
 * Config validator function type
 */
export type ConfigValidator<T> = (config: T) => boolean;

/**
 * Config validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public errors: string[] = []
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * Environment variable value parser
 */
function parseEnvValue(value: string | undefined): unknown {
  if (!value) return "";

  // Try parsing as JSON first
  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, return as string
    }
  }

  // Try parsing as number
  if (/^-?\d+\.?\d*$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Try parsing as boolean
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  // Return as string
  return value;
}

/**
 * ConfigBuilder - Fluent configuration builder
 */
export class ConfigBuilder<T extends Record<string, unknown>> {
  private defaults: Required<T>;
  private config: Partial<T> = {};
  private validationErrors: string[] = [];
  private validators: ConfigValidator<T>[] = [];

  constructor(defaults: T) {
    this.defaults = defaults as Required<T>;
  }

  /**
   * Set a single configuration value
   */
  set<K extends keyof T>(key: K, value: T[K]): this {
    this.config[key] = value;
    return this;
  }

  /**
   * Merge partial configuration
   */
  merge(partial: Partial<T>): this {
    this.config = this.deepMerge(this.config, partial);
    return this;
  }

  /**
   * Load values from environment variables
   *
   * @example
   * ```typescript
   * .fromEnv({
   *   apiKey: 'MY_API_KEY',
   *   timeout: 'MY_TIMEOUT',
   *   endpoint: 'MY_ENDPOINT'
   * })
   * ```
   */
  fromEnv(mapping: Partial<Record<keyof T, string>>): this {
    for (const [key, envVar] of Object.entries(mapping)) {
      if (typeof globalThis !== "undefined" && "process" in globalThis) {
        const proc = globalThis as {
          process?: { env?: Record<string, string | undefined> };
        };
        const envValue = proc.process?.env?.[envVar as string];
        if (envValue !== undefined) {
          this.config[key as keyof T] = parseEnvValue(envValue) as T[keyof T];
        }
      }
    }
    return this;
  }

  /**
   * Load all config values from environment with prefix
   *
   * @example
   * ```typescript
   * // If MY_APP_TIMEOUT=30000, MY_APP_RETRIES=3
   * .fromEnvPrefix('MY_APP_')
   * ```
   */
  fromEnvPrefix(prefix: string): this {
    if (typeof globalThis !== "undefined" && "process" in globalThis) {
      const proc = globalThis as {
        process?: { env?: Record<string, string | undefined> };
      };
      if (proc.process?.env) {
        for (const [envKey, envValue] of Object.entries(proc.process.env)) {
          if (envKey.startsWith(prefix) && envValue !== undefined) {
            const configKey = envKey.substring(prefix.length);
            // Convert to camelCase
            const camelKey = configKey.replace(/_([a-z])/g, (_, letter) =>
              letter.toUpperCase()
            );
            if (camelKey in this.defaults) {
              this.config[camelKey as keyof T] = parseEnvValue(
                envValue
              ) as T[keyof T];
            }
          }
        }
      }
    }
    return this;
  }

  /**
   * Add a validation rule
   */
  validate(validator: ConfigValidator<T>, errorMessage: string): this {
    this.validators.push(validator);
    if (!validator(this.build())) {
      this.validationErrors.push(errorMessage);
    }
    return this;
  }

  /**
   * Validate a specific field
   */
  validateField<K extends keyof T>(
    key: K,
    validator: (value: T[K]) => boolean,
    errorMessage: string
  ): this {
    this.validators.push(config => validator(config[key]));
    const currentValue = this.build()[key];
    if (!validator(currentValue)) {
      this.validationErrors.push(`${String(key)}: ${errorMessage}`);
    }
    return this;
  }

  /**
   * Validate required fields
   */
  validateRequired<K extends keyof T>(...keys: K[]): this {
    for (const key of keys) {
      this.validateField(
        key,
        value => value !== undefined && value !== null && value !== "",
        `${String(key)} is required`
      );
    }
    return this;
  }

  /**
   * Validate number ranges
   */
  validateRange<K extends keyof T>(
    key: K,
    min?: number,
    max?: number,
    errorMessage?: string
  ): this {
    this.validateField(
      key,
      value => {
        if (typeof value !== "number") return false;
        if (min !== undefined && value < min) return false;
        if (max !== undefined && value > max) return false;
        return true;
      },
      errorMessage ??
        `${String(key)} must be a number${min !== undefined ? ` >= ${min}` : ""}${max !== undefined ? ` <= ${max}` : ""}`
    );
    return this;
  }

  /**
   * Validate choices
   */
  validateChoices<K extends keyof T>(
    key: K,
    choices: T[K][],
    errorMessage?: string
  ): this {
    this.validateField(
      key,
      value => choices.includes(value),
      errorMessage ?? `${String(key)} must be one of: ${choices.join(", ")}`
    );
    return this;
  }

  /**
   * Build the final configuration object
   *
   * @throws {ConfigValidationError} If validation fails
   */
  build(): T {
    if (this.validationErrors.length > 0) {
      throw new ConfigValidationError(
        `Configuration validation failed:\n${this.validationErrors.map(e => `  - ${e}`).join("\n")}`,
        this.validationErrors
      );
    }

    return { ...this.defaults, ...this.config } as T;
  }

  /**
   * Build without throwing errors (returns null if invalid)
   */
  buildSafe(): T | null {
    try {
      return this.build();
    } catch {
      return null;
    }
  }

  /**
   * Get current validation errors without building
   */
  getErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Check if current configuration is valid
   */
  isValid(): boolean {
    return this.validationErrors.length === 0;
  }

  /**
   * Reset to defaults
   */
  reset(): this {
    this.config = {};
    this.validationErrors = [];
    this.validators = [];
    return this;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, unknown>>(
    target: Partial<T>,
    source: Partial<T>
  ): Partial<T> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          sourceValue &&
          typeof sourceValue === "object" &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === "object" &&
          !Array.isArray(targetValue)
        ) {
          (result as Record<string, unknown>)[key] = this.deepMerge(
            targetValue as Partial<Record<string, unknown>>,
            sourceValue as Partial<Record<string, unknown>>
          );
        } else {
          (result as Record<string, unknown>)[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Create a snapshot of current builder state
   */
  snapshot(): {
    defaults: Required<T>;
    config: Partial<T>;
    validationErrors: string[];
  } {
    return {
      defaults: { ...this.defaults },
      config: { ...this.config },
      validationErrors: [...this.validationErrors],
    };
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: ReturnType<ConfigBuilder<T>["snapshot"]>): this {
    this.defaults = snapshot.defaults;
    this.config = snapshot.config;
    this.validationErrors = snapshot.validationErrors;
    return this;
  }

  /**
   * Clone the builder
   */
  clone(): ConfigBuilder<T> {
    const cloned = new ConfigBuilder({ ...this.defaults } as T);
    cloned.config = { ...this.config };
    cloned.validationErrors = [...this.validationErrors];
    cloned.validators = [...this.validators];
    return cloned;
  }
}

/**
 * Convenience function to create a ConfigBuilder
 */
export function buildConfig<T extends Record<string, unknown>>(
  defaults: T
): ConfigBuilder<T> {
  return new ConfigBuilder(defaults);
}

/**
 * Merge two configs without builder
 */
export function mergeConfig<T extends Record<string, unknown>>(
  defaults: T,
  partial?: Partial<T>
): T {
  const builder = new ConfigBuilder(defaults);
  if (partial) {
    builder.merge(partial);
  }
  return builder.build();
}
