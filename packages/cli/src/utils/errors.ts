/**
 * CLI Error Handling Utilities
 *
 * Provides user-friendly error messages, suggestion-based errors,
 * exit codes for scripting, and stack traces in debug mode.
 */

import chalk from 'chalk';
import { RegistryError, RegistryErrorCode } from '@lsi/registry/types';
import os from 'os';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * CLI error severity
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * CLI error code
 */
export enum CliErrorCode {
  // General errors (1-10)
  UNKNOWN_ERROR = 'CLI_001',
  INVALID_ARGUMENT = 'CLI_002',
  MISSING_ARGUMENT = 'CLI_003',
  COMMAND_FAILED = 'CLI_004',

  // Registry errors (11-20)
  REGISTRY_ERROR = 'CLI_011',
  COMPONENT_NOT_FOUND = 'CLI_012',
  VERSION_NOT_FOUND = 'CLI_013',
  DOWNLOAD_FAILED = 'CLI_014',
  INSTALL_FAILED = 'CLI_015',
  UNINSTALL_FAILED = 'CLI_016',

  // Network errors (21-30)
  NETWORK_ERROR = 'CLI_021',
  CONNECTION_TIMEOUT = 'CLI_022',
  DNS_RESOLUTION_FAILED = 'CLI_023',
  SSL_ERROR = 'CLI_024',

  // Filesystem errors (31-40)
  PERMISSION_DENIED = 'CLI_031',
  DISK_FULL = 'CLI_032',
  FILE_NOT_FOUND = 'CLI_033',
  INVALID_CONFIG = 'CLI_034',

  // Dependency errors (41-50)
  DEPENDENCY_CONFLICT = 'CLI_041',
  DEPENDENCY_NOT_FOUND = 'CLI_042',
  CIRCULAR_DEPENDENCY = 'CLI_043',

  // Component errors (51-60)
  COMPONENT_ALREADY_INSTALLED = 'CLI_051',
  COMPONENT_NOT_INSTALLED = 'CLI_052',
  COMPONENT_RUNNING = 'CLI_053',
  COMPONENT_FAILED = 'CLI_054',
}

/**
 * Error suggestion
 */
export interface ErrorSuggestion {
  /** Suggestion text */
  text: string;
  /** Command to run (if applicable) */
  command?: string;
}

/**
 * CLI error details
 */
export interface CliErrorDetails {
  /** Error code */
  code: CliErrorCode | RegistryErrorCode;
  /** Error message */
  message: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Suggestions for fixing the error */
  suggestions: ErrorSuggestion[];
  /** Exit code for scripting */
  exitCode: number;
  /** Whether to show stack trace in debug mode */
  showStackTrace: boolean;
  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================================================
// CLI ERROR CLASS
// ============================================================================

/**
 * CLI Error
 *
 * Custom error class for CLI-specific errors with user-friendly messages
 * and suggestions.
 */
export class CliError extends Error {
  public readonly code: CliErrorCode | RegistryErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly suggestions: ErrorSuggestion[];
  public readonly exitCode: number;
  public readonly showStackTrace: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(details: CliErrorDetails) {
    super(details.message);
    this.name = 'CliError';
    this.code = details.code;
    this.severity = details.severity;
    this.suggestions = details.suggestions;
    this.exitCode = details.exitCode;
    this.showStackTrace = details.showStackTrace;
    this.context = details.context;
  }

  /**
   * Format error for display
   */
  format(debug: boolean = false): string {
    const lines: string[] = [];

    // Error header
    const icon = this.severity === 'fatal' || this.severity === 'error'
      ? chalk.red('✖')
      : this.severity === 'warning'
      ? chalk.yellow('⚠')
      : chalk.blue('ℹ');

    lines.push(`${icon} ${chalk.bold(this.message)}`);
    lines.push('');

    // Error code
    lines.push(chalk.gray(`Error code: ${this.code}`));
    lines.push('');

    // Suggestions
    if (this.suggestions.length > 0) {
      lines.push(chalk.bold('Suggestions:'));
      for (const suggestion of this.suggestions) {
        if (suggestion.command) {
          lines.push(`  • ${suggestion.text}`);
          lines.push(`    ${chalk.cyan('$ ' + suggestion.command)}`);
        } else {
          lines.push(`  • ${suggestion.text}`);
        }
      }
      lines.push('');
    }

    // Stack trace in debug mode
    if (debug && this.showStackTrace && this.stack) {
      lines.push(chalk.bold('Stack trace:'));
      lines.push(chalk.gray(this.stack));
      lines.push('');
    }

    // Context in debug mode
    if (debug && this.context) {
      lines.push(chalk.bold('Context:'));
      for (const [key, value] of Object.entries(this.context)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a "component not found" error
 */
export function createComponentNotFoundError(
  component: string,
  available?: string[]
): CliError {
  const suggestions: ErrorSuggestion[] = [
    {
      text: 'Check the component name for typos',
      command: `aequor list`,
    },
    {
      text: 'Search for similar components',
      command: `aequor search ${component}`,
    },
  ];

  // Add "did you mean?" suggestions
  if (available && available.length > 0) {
    const similar = findSimilar(component, available);
    if (similar.length > 0) {
      suggestions.push({
        text: 'Did you mean one of these?',
        command: `aequor pull ${similar[0]}`,
      });
    }
  }

  return new CliError({
    code: CliErrorCode.COMPONENT_NOT_FOUND,
    message: `Component '${component}' not found`,
    severity: 'error',
    suggestions,
    exitCode: 1,
    showStackTrace: false,
  });
}

/**
 * Create a "component already installed" error
 */
export function createComponentAlreadyInstalledError(
  component: string,
  version: string
): CliError {
  return new CliError({
    code: CliErrorCode.COMPONENT_ALREADY_INSTALLED,
    message: `Component '${component}@${version}' is already installed`,
    severity: 'warning',
    suggestions: [
      {
        text: 'Use --force to reinstall',
        command: `aequor pull ${component} --version ${version} --force`,
      },
      {
        text: 'Update to the latest version',
        command: `aequor update ${component}`,
      },
    ],
    exitCode: 0,
    showStackTrace: false,
  });
}

/**
 * Create a "component not installed" error
 */
export function createComponentNotInstalledError(
  component: string
): CliError {
  return new CliError({
    code: CliErrorCode.COMPONENT_NOT_INSTALLED,
    message: `Component '${component}' is not installed`,
    severity: 'error',
    suggestions: [
      {
        text: 'Install the component',
        command: `aequor pull ${component}`,
      },
    ],
    exitCode: 1,
    showStackTrace: false,
  });
}

/**
 * Create a "download failed" error
 */
export function createDownloadFailedError(
  component: string,
  reason: string
): CliError {
  return new CliError({
    code: CliErrorCode.DOWNLOAD_FAILED,
    message: `Failed to download '${component}': ${reason}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Check your internet connection',
      },
      {
        text: 'Try again later',
        command: `aequor pull ${component}`,
      },
      {
        text: 'Check registry status',
        command: `aequor registry status`,
      },
    ],
    exitCode: 1,
    showStackTrace: true,
    context: { component, reason },
  });
}

/**
 * Create a "permission denied" error
 */
export function createPermissionDeniedError(
  path: string
): CliError {
  return new CliError({
    code: CliErrorCode.PERMISSION_DENIED,
    message: `Permission denied: ${path}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Run with sudo/administrator privileges',
        command: `sudo aequor pull <component>`,
      },
      {
        text: 'Check file permissions',
      },
    ],
    exitCode: 1,
    showStackTrace: false,
    context: { path },
  });
}

/**
 * Create a "disk full" error
 */
export function createDiskFullError(
  path: string
): CliError {
  return new CliError({
    code: CliErrorCode.DISK_FULL,
    message: `Disk full: Cannot write to ${path}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Free up disk space',
      },
      {
        text: 'Clean component cache',
        command: `aequor cache clean`,
      },
      {
        text: 'Change cache directory in config',
      },
    ],
    exitCode: 1,
    showStackTrace: false,
    context: { path },
  });
}

/**
 * Create a "dependency conflict" error
 */
export function createDependencyConflictError(
  component: string,
  conflicts: Array<{ name: string; requested: string; existing: string }>
): CliError {
  const suggestions: ErrorSuggestion[] = [
    {
      text: 'Resolve conflicts manually',
    },
  ];

  if (conflicts.length > 0) {
    const conflictList = conflicts
      .map(c => `${c.name}@${c.requested} (needs) vs ${c.name}@${c.existing} (installed)`)
      .join(', ');

    suggestions.push({
      text: `Conflicts: ${conflictList}`,
    });
  }

  return new CliError({
    code: CliErrorCode.DEPENDENCY_CONFLICT,
    message: `Dependency conflict for '${component}'`,
    severity: 'error',
    suggestions,
    exitCode: 1,
    showStackTrace: false,
    context: { component, conflicts },
  });
}

/**
 * Create a "network error" error
 */
export function createNetworkError(
  url: string,
  reason: string
): CliError {
  return new CliError({
    code: CliErrorCode.NETWORK_ERROR,
    message: `Network error: ${reason}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Check your internet connection',
      },
      {
        text: 'Check if the registry is reachable',
        command: `aequor registry status`,
      },
      {
        text: 'Try again later',
      },
    ],
    exitCode: 1,
    showStackTrace: true,
    context: { url, reason },
  });
}

/**
 * Create a "invalid config" error
 */
export function createInvalidConfigError(
  configPath: string,
  errors: string[]
): CliError {
  return new CliError({
    code: CliErrorCode.INVALID_CONFIG,
    message: `Invalid configuration: ${configPath}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Fix configuration errors',
      },
      {
        text: 'Reset to default configuration',
        command: `aequor config reset`,
      },
      {
        text: 'Validate configuration',
        command: `aequor config validate`,
      },
    ],
    exitCode: 1,
    showStackTrace: false,
    context: { configPath, errors },
  });
}

/**
 * Create a "command failed" error
 */
export function createCommandFailedError(
  command: string,
  reason: string
): CliError {
  return new CliError({
    code: CliErrorCode.COMMAND_FAILED,
    message: `Command '${command}' failed: ${reason}`,
    severity: 'error',
    suggestions: [
      {
        text: 'Check the command syntax',
        command: `aequor ${command} --help`,
      },
      {
        text: 'Run with --debug for more information',
        command: `aequor ${command} --debug`,
      },
    ],
    exitCode: 1,
    showStackTrace: true,
    context: { command, reason },
  });
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

/**
 * Handle CLI errors
 *
 * Formats and displays errors, then exits with appropriate exit code.
 */
export function handleCliError(
  error: unknown,
  debug: boolean = false
): never {
  // Handle CLI errors
  if (error instanceof CliError) {
    console.error(error.format(debug));
    process.exit(error.exitCode);
  }

  // Handle registry errors
  if (error instanceof RegistryError) {
    console.error(formatRegistryError(error, debug));
    process.exit(1);
  }

  // Handle standard errors
  if (error instanceof Error) {
    console.error(formatStandardError(error, debug));
    process.exit(1);
  }

  // Handle unknown errors
  console.error(formatUnknownError(error, debug));
  process.exit(1);
}

/**
 * Format registry error
 */
function formatRegistryError(error: RegistryError, debug: boolean): string {
  const lines: string[] = [];

  lines.push(chalk.red('✖') + ' ' + chalk.bold(error.message));
  lines.push('');
  lines.push(chalk.gray(`Error code: ${error.code}`));

  if (debug && error.details) {
    lines.push('');
    lines.push(chalk.bold('Details:'));
    for (const [key, value] of Object.entries(error.details)) {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format standard error
 */
function formatStandardError(error: Error, debug: boolean): string {
  const lines: string[] = [];

  lines.push(chalk.red('✖') + ' ' + chalk.bold(error.message));
  lines.push('');

  if (debug && error.stack) {
    lines.push(chalk.bold('Stack trace:'));
    lines.push(chalk.gray(error.stack));
  }

  return lines.join('\n');
}

/**
 * Format unknown error
 */
function formatUnknownError(error: unknown, debug: boolean): string {
  const lines: string[] = [];

  lines.push(chalk.red('✖') + ' ' + chalk.bold('An unknown error occurred'));
  lines.push('');

  if (debug) {
    lines.push(chalk.bold('Error:'));
    lines.push(chalk.gray(JSON.stringify(error)));
  }

  return lines.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find similar component names (for "did you mean?" suggestions)
 */
function findSimilar(target: string, available: string[]): string[] {
  const threshold = 3; // Maximum edit distance

  const similar = available.filter(name => {
    const distance = levenshteinDistance(target, name);
    return distance <= threshold;
  });

  // Sort by edit distance
  similar.sort((a, b) =>
    levenshteinDistance(target, a) - levenshteinDistance(target, b)
  );

  return similar.slice(0, 3); // Return top 3 matches
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Wrap error handling for async commands
 */
export function wrapAsyncCommand(
  fn: (...args: unknown[]) => Promise<void>,
  debug: boolean = false
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (error) {
      handleCliError(error, debug);
    }
  };
}

/**
 * Get system information for error context
 */
export function getSystemInfo(): Record<string, string> {
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    osRelease: os.release(),
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    cpuCount: os.cpus().length.toString(),
  };
}
