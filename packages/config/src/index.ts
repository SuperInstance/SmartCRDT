/**
 * @lsi/config - Configuration Management
 *
 * Manages Aequor platform configuration with:
 * - YAML-based configuration files
 * - Environment variable overrides
 * - Configuration validation
 * - Hot reloading support
 */

// Core exports
export {
  ConfigManager,
  createConfigManager,
  detectHardwareProfile,
  formatConfig,
} from './ConfigManager.js';

// Type exports
export type {
  AequorConfig,
  ComponentConfig,
  ValidationResult,
  ConfigSource,
  ConfigValue,
} from './ConfigManager.js';
