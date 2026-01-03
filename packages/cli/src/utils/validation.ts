/**
 * CLI Input Validation
 */

import chalk from "chalk";

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Parsed value (if applicable) */
  parsedValue?: any;
}

/**
 * Validate a query string
 */
export function validateQuery(query: string): ValidationResult {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: "Query cannot be empty" };
  }

  if (query.length > 10000) {
    return { valid: false, error: "Query too long (max 10000 characters)" };
  }

  return { valid: true };
}

/**
 * Validate a config key-value pair
 */
export function validateConfig(key: string, value: string): ValidationResult {
  // Boolean values
  if (["true", "false", "1", "0"].includes(value.toLowerCase())) {
    return {
      valid: true,
      parsedValue: value.toLowerCase() === "true" || value === "1",
    };
  }

  // Numeric values
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = parseFloat(value);
    return { valid: true, parsedValue: num };
  }

  // Specific config keys with validation
  switch (key) {
    case "cache.enabled":
    case "privacy.enabled":
    case "logging.shadowEnabled":
      const boolVal = value.toLowerCase();
      if (boolVal === "true" || boolVal === "1") {
        return { valid: true, parsedValue: true };
      } else if (boolVal === "false" || boolVal === "0") {
        return { valid: true, parsedValue: false };
      }
      return {
        valid: false,
        error: `Invalid value for ${key}. Must be true or false`,
      };

    case "privacy.epsilon":
      const epsilon = parseFloat(value);
      if (isNaN(epsilon)) {
        return { valid: false, error: "Epsilon must be a number" };
      }
      if (epsilon < 0.1 || epsilon > 10) {
        return {
          valid: false,
          error: "Epsilon must be between 0.1 and 10",
        };
      }
      return { valid: true, parsedValue: epsilon };

    case "router.complexityThreshold":
      const threshold = parseFloat(value);
      if (isNaN(threshold)) {
        return { valid: false, error: "Threshold must be a number" };
      }
      if (threshold < 0 || threshold > 1) {
        return {
          valid: false,
          error: "Threshold must be between 0 and 1",
        };
      }
      return { valid: true, parsedValue: threshold };

    case "cache.maxSize":
      const size = parseInt(value, 10);
      if (isNaN(size) || size < 0) {
        return {
          valid: false,
          error: "Cache size must be a positive number",
        };
      }
      return { valid: true, parsedValue: size };

    case "cache.ttl":
      const ttl = parseInt(value, 10);
      if (isNaN(ttl) || ttl < 0) {
        return {
          valid: false,
          error: "TTL must be a positive number (milliseconds)",
        };
      }
      return { valid: true, parsedValue: ttl };

    default:
      // Unknown config key, pass through as string
      return { valid: true, parsedValue: value };
  }
}

/**
 * Validate a file path
 */
export function validateFilePath(
  path: string
): ValidationResult {
  if (!path || path.trim().length === 0) {
    return { valid: false, error: "File path cannot be empty" };
  }

  // Check for invalid characters (basic check)
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(path)) {
    return {
      valid: false,
      error: "File path contains invalid characters",
    };
  }

  // Check file extension
  const validExtensions = [".json", ".jsonl", ".txt", ".md"];
  const ext = path.substring(path.lastIndexOf("."));
  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Must be one of: ${validExtensions.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate a quality threshold (0-1)
 */
export function validateQuality(value: string): ValidationResult {
  const quality = parseFloat(value);

  if (isNaN(quality)) {
    return { valid: false, error: "Quality must be a number" };
  }

  if (quality < 0 || quality > 1) {
    return {
      valid: false,
      error: "Quality must be between 0 and 1",
    };
  }

  return { valid: true, parsedValue: quality };
}

/**
 * Validate an epsilon value for differential privacy
 */
export function validateEpsilon(value: string): ValidationResult {
  const epsilon = parseFloat(value);

  if (isNaN(epsilon)) {
    return { valid: false, error: "Epsilon must be a number" };
  }

  if (epsilon < 0.1 || epsilon > 10) {
    return {
      valid: false,
      error: "Epsilon must be between 0.1 and 10",
    };
  }

  return { valid: true, parsedValue: epsilon };
}

/**
 * Validate a backend name
 */
export function validateBackend(backend: string): ValidationResult {
  const validBackends = ["local", "cloud", "auto"];

  if (!validBackends.includes(backend.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid backend. Must be one of: ${validBackends.join(", ")}`,
    };
  }

  return { valid: true, parsedValue: backend.toLowerCase() };
}

/**
 * Validate a model name
 */
export function validateModel(model: string): ValidationResult {
  if (!model || model.trim().length === 0) {
    return { valid: false, error: "Model name cannot be empty" };
  }

  // Check for common model name patterns
  const validPatterns = [
    /^gpt-4/,
    /^gpt-3\.5/,
    /^llama/,
    /^mistral/,
    /^codellama/,
    /^phi/,
    /^qwen/,
  ];

  const isValid = validPatterns.some(pattern =>
    pattern.test(model.toLowerCase())
  );

  if (!isValid) {
    return {
      valid: false,
      error: `Unknown model: ${model}. Common patterns: gpt-4, gpt-3.5, llama, mistral`,
    };
  }

  return { valid: true };
}

/**
 * Format a validation error for display
 */
export function formatValidationError(error: string): string {
  return `${(chalk.red as any)("✗")} Validation Error: ${error}`;
}

/**
 * Format a validation success for display
 */
export function formatValidationSuccess(message: string): string {
  return `${(chalk.green as any)("✓")} ${message}`;
}
