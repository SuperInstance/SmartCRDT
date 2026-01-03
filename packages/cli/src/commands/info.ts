/**
 * Info Command
 *
 * Show detailed information about a component.
 * Supports JSON output and verbosity levels.
 */

import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import {
  createComponentNotFoundError,
  createComponentNotInstalledError,
} from '../utils/errors.js';
import chalk from 'chalk';
import { formatBytes } from '../utils/progress.js';

// ============================================================================
// INFO OPTIONS
// ============================================================================

/**
 * Info command options
 */
export interface InfoOptions {
  /** Show installed version only (if installed) */
  installed?: boolean;
  /** Show all available versions */
  allVersions?: boolean;
  /** Output format (pretty, json) */
  format?: 'pretty' | 'json';
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// INFO COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Show component information
 */
export async function infoCommand(
  componentName: string,
  options: InfoOptions = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  try {
    // Get component info
    const info = await registry.info(componentName);

    // Get manifest for detailed info
    const manifest = await registry.get(componentName);

    // Check if installed
    const installed = await registry.listInstalled();
    const installedComponent = installed.find(i => i.name === componentName);

    // Format output
    switch (options.format) {
      case 'json':
        formatJson(info, manifest, installedComponent);
        break;
      case 'pretty':
      default:
        formatPretty(info, manifest, installedComponent, options);
        break;
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createComponentNotFoundError(
        componentName,
        (await registry.list()).map(c => c.name)
      );
    }
    throw error;
  }
}

/**
 * Format as pretty output
 */
function formatPretty(
  info: any,
  manifest: any,
  installed: any,
  options: InfoOptions
): void {
  console.log('');

  // Header
  console.log(chalk.bold.white(info.name));
  if (info.description) {
    console.log(chalk.gray(info.description));
  }
  console.log('');

  // Basic info table
  const basicInfo = [
    [chalk.bold('Version:'), info.latest_version],
    [chalk.bold('Type:'), info.type],
    [chalk.bold('Language:'), manifest.language || '-'],
    [chalk.bold('Stability:'), formatStability(info.stability)],
    [chalk.bold('Category:'), info.category || '-'],
  ];

  if (installed) {
    basicInfo.push([chalk.bold('Status:'), chalk.green('Installed')]);
    basicInfo.push([chalk.bold('Installed Version:'), installed.version]);

    if (info.update_available) {
      basicInfo.push([
        chalk.bold('Update Available:'),
        chalk.yellow(`${info.latest_version} (installed: ${installed.version})`)
      ]);
    }
  } else {
    basicInfo.push([chalk.bold('Status:'), chalk.gray('Not installed')]);
  }

  // Print basic info
  for (const [key, value] of basicInfo) {
    console.log(`${key} ${value}`);
  }

  console.log('');

  // Versions
  if (options.allVersions && info.versions && info.versions.length > 0) {
    console.log(chalk.bold('Available Versions:'));
    for (const version of info.versions) {
      const isInstalled = installed && installed.version === version;
      const isLatest = version === info.latest_version;

      let versionStr = `  ${version}`;

      if (isInstalled) {
        versionStr += chalk.green(' (installed)');
      }
      if (isLatest && !isInstalled) {
        versionStr += chalk.yellow(' (latest)');
      }

      console.log(versionStr);
    }
    console.log('');
  }

  // Dependencies
  if (manifest.dependencies && manifest.dependencies.length > 0) {
    console.log(chalk.bold('Dependencies:'));
    for (const dep of manifest.dependencies) {
      const required = dep.required ? '' : chalk.gray(' (optional)');
      console.log(`  ${chalk.cyan(dep.name)}${chalk.gray('@')}${chalk.yellow(dep.version)}${required}`);
    }
    console.log('');
  }

  // Keywords
  if (info.keywords && info.keywords.length > 0) {
    console.log(chalk.bold('Keywords:'));
    console.log(`  ${info.keywords.map((k: string) => chalk.cyan(k)).join(', ')}`);
    console.log('');
  }

  // Performance
  if (manifest.performance && Object.keys(manifest.performance).length > 0) {
    console.log(chalk.bold('Performance:'));
    const perf = manifest.performance;

    if (perf.latency_p50_ms) {
      console.log(`  Latency (p50): ${perf.latency_p50_ms}ms`);
    }
    if (perf.latency_p95_ms) {
      console.log(`  Latency (p95): ${perf.latency_p95_ms}ms`);
    }
    if (perf.memory_mb) {
      console.log(`  Memory: ${formatBytes(perf.memory_mb * 1024 * 1024)}`);
    }
    if (perf.benchmark_qps) {
      console.log(`  Throughput: ${perf.benchmark_qps} QPS`);
    }

    console.log('');
  }

  // Download info
  if (manifest.download?.archive) {
    console.log(chalk.bold('Download Info:'));
    console.log(`  Size: ${formatBytes(manifest.download.archive.size_mb * 1024 * 1024)}`);
    console.log(`  SHA256: ${manifest.download.archive.sha256.substring(0, 16)}...`);
    console.log('');
  }

  // Compatibility
  if (manifest.compatibility) {
    console.log(chalk.bold('Compatibility:'));

    if (manifest.compatibility.platforms) {
      console.log(`  Platforms: ${manifest.compatibility.platforms.join(', ')}`);
    }
    if (manifest.compatibility.arch) {
      console.log(`  Architectures: ${manifest.compatibility.arch.join(', ')}`);
    }
    if (manifest.compatibility.node) {
      console.log(`  Node.js: ${manifest.compatibility.node}`);
    }

    console.log('');
  }

  // Repository
  if (manifest.repository) {
    console.log(chalk.bold('Repository:'));
    console.log(`  ${chalk.blue.underline(manifest.repository.url)}`);

    if (manifest.repository.issues) {
      console.log(`  Issues: ${chalk.blue.underline(manifest.repository.issues)}`);
    }

    console.log('');
  }

  // License
  if (manifest.license) {
    console.log(chalk.bold('License:'), manifest.license.spdx);
    console.log('');
  }

  // Authors
  if (manifest.authors && manifest.authors.length > 0) {
    console.log(chalk.bold('Authors:'));
    for (const author of manifest.authors) {
      if (author.url) {
        console.log(`  ${chalk.blue.underline(author.name)} ${chalk.gray(`<${author.url}>`)}`);
      } else {
        console.log(`  ${author.name}`);
      }
    }
    console.log('');
  }

  // Verbose: installation paths
  if (options.verbose && installed) {
    console.log(chalk.bold('Installation:'));
    console.log(`  Path: ${installed.path}`);
    console.log(`  Installed: ${new Date(installed.installed_at).toLocaleString()}`);
    console.log(`  Active: ${installed.active ? chalk.green('Yes') : chalk.gray('No')}`);
    console.log('');
  }
}

/**
 * Format stability level with color
 */
function formatStability(stability: string): string {
  switch (stability) {
    case 'stable':
      return chalk.green(stability);
    case 'beta':
      return chalk.yellow(stability);
    case 'alpha':
      return chalk.orange(stability);
    case 'experimental':
      return chalk.red(stability);
    case 'deprecated':
      return chalk.gray(stability);
    default:
      return stability;
  }
}

/**
 * Format as JSON
 */
function formatJson(info: any, manifest: any, installed: any): void {
  const output = {
    info,
    manifest,
    installed: installed || null,
  };

  console.log(JSON.stringify(output, null, 2));
}

// ============================================================================
// INFO VERIFICATION
// ============================================================================

/**
 * Verify component and show verification results
 */
export async function infoVerifyCommand(
  componentName: string
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.load();

  const registry = new ComponentRegistry({
    local_path: config.components_path,
  });
  await registry.initialize();

  try {
    const manifest = await registry.get(componentName);
    const verification = await registry.verify(manifest);

    console.log('');
    console.log(chalk.bold(`Verification results for ${componentName}:`));
    console.log('');

    if (verification.verified) {
      console.log(chalk.green('✔') + ' Component verified successfully');
    } else {
      console.log(chalk.red('✖') + ' Component verification failed');
    }

    console.log('');

    // Show details
    if (verification.manifest) {
      console.log(chalk.bold('Manifest:'));
      console.log(`  ${verification.manifest.passed ? chalk.green('✔') : chalk.red('✖')} Manifest structure`);

      if (verification.manifest.errors && verification.manifest.errors.length > 0) {
        for (const error of verification.manifest.errors) {
          console.log(`    ${chalk.red('•')} ${error}`);
        }
      }
    }

    if (verification.checksum) {
      console.log(chalk.bold('Checksum:'));
      console.log(`  ${verification.checksum.passed ? chalk.green('✔') : chalk.red('✖')} SHA256`);

      if (!verification.checksum.passed) {
        console.log(`    Expected: ${verification.checksum.expected}`);
        console.log(`    Actual: ${verification.checksum.actual}`);
      }
    }

    if (verification.signature) {
      console.log(chalk.bold('Signature:'));
      console.log(`  ${verification.signature.passed ? chalk.green('✔') : chalk.red('✖')} ${verification.signature.key_id}`);

      if (verification.signature.signer) {
        console.log(`    Signer: ${verification.signature.signer}`);
      }
    }

    if (verification.errors && verification.errors.length > 0) {
      console.log('');
      console.log(chalk.bold('Errors:'));
      for (const error of verification.errors) {
        console.log(`  ${chalk.red('•')} ${error}`);
      }
    }

    console.log('');

  } catch (error) {
    throw createComponentNotFoundError(
      componentName,
      (await registry.list()).map(c => c.name)
    );
  }
}
