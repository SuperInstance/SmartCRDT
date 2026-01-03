#!/usr/bin/env node

/**
 * Aequor Compatibility CLI
 *
 * Command-line interface for version compatibility checking and migration.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import * as YAML from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  CompatibilityChecker,
  type ComponentConstraint,
  type CompatibilityReport,
  type MigrationPath,
} from '@lsi/compatibility';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MATRIX_DIR = '/mnt/c/users/casey/smartCRDT/demo/docs/compatibility/matrix';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse component:version string into constraint
 */
function parseComponentVersion(input: string): ComponentConstraint {
  const match = input.match(/^(@lsi\/[\w-]+):([\d.]+|[\^~<>]?\d+\.\d+\.\d+)$/);
  if (!match) {
    throw new Error(`Invalid component:version format: ${input}`);
  }
  return {
    component: match[1],
    version: match[2],
  };
}

/**
 * Parse multiple component:version strings
 */
function parseComponentVersions(inputs: string[]): ComponentConstraint[] {
  return inputs.map(parseComponentVersion);
}

/**
 * Format compatibility report for console output
 */
function formatReport(report: CompatibilityReport): void {
  console.log();
  console.log(chalk.bold('Compatibility Report'));
  console.log(chalk.gray('='.repeat(60)));

  // Overall status
  const statusIcon = report.compatible ? '✓' : '✗';
  const statusColor = report.compatible ? chalk.green : chalk.red;
  const statusText = report.compatible ? 'Compatible' : 'Incompatible';

  console.log();
  console.log(`${statusIcon} ${statusColor.bold(statusText)}`);
  console.log(chalk.gray(`Component: ${report.component}@${report.version}`));

  // Checked against
  if (report.with.length > 0) {
    console.log(chalk.gray('Checked against:'));
    for (const constraint of report.with) {
      console.log(chalk.gray(`  - ${constraint.component}@${constraint.version}`));
    }
  }

  // Issues
  if (report.issues.length > 0) {
    console.log();
    console.log(chalk.bold.red('Issues:'));
    for (const issue of report.issues) {
      const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      const color = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;

      console.log(`  ${color(icon)} ${color.bold(issue.type)}: ${issue.message}`);

      if (issue.suggestion) {
        console.log(chalk.gray(`    → ${issue.suggestion}`));
      }

      if (issue.documentation) {
        console.log(chalk.gray(`    📚 ${issue.documentation}`));
      }
    }
  }

  // Warnings
  if (report.warnings.length > 0) {
    console.log();
    console.log(chalk.bold.yellow('Warnings:'));
    for (const warning of report.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }
  }

  // Info
  if (report.info.length > 0) {
    console.log();
    console.log(chalk.bold.blue('Info:'));
    for (const info of report.info) {
      console.log(chalk.blue(`  ℹ ${info}`));
    }
  }

  // Suggestions
  if (report.suggestions && report.suggestions.length > 0) {
    console.log();
    console.log(chalk.bold.green('Compatible versions:'));
    for (const suggestion of report.suggestions) {
      console.log(chalk.green(`  ✓ ${suggestion}`));
    }
  }

  // Migration path
  if (report.migration_path) {
    console.log();
    console.log(chalk.bold.cyan('Migration path available:'));
    console.log(chalk.cyan(`  From: ${report.migration_path.from}`));
    console.log(chalk.cyan(`  To: ${report.migration_path.to}`));
    console.log(chalk.cyan(`  Difficulty: ${report.migration_path.difficulty}`));
    console.log(chalk.cyan(`  Estimated time: ${report.migration_path.estimated_time}`));
    console.log(chalk.cyan(`  Breaking changes: ${report.migration_path.breaking_changes.length}`));

    if (report.migration_path.guide) {
      console.log(chalk.cyan(`  Guide: ${report.migration_path.guide}`));
    }
  }

  console.log();
}

/**
 * Format migration path for console output
 */
function formatMigration(migration: MigrationPath): void {
  console.log();
  console.log(chalk.bold('Migration Path'));
  console.log(chalk.gray('='.repeat(60)));

  console.log();
  console.log(chalk.bold(`From: ${migration.from}`));
  console.log(chalk.bold(`To: ${migration.to}`));
  console.log();

  // Summary
  console.log(chalk.bold('Summary:'));
  console.log(`  Difficulty: ${chalk.bold(migration.difficulty)}`);
  console.log(`  Estimated time: ${chalk.bold(migration.estimated_time)}`);
  console.log(`  Breaking changes: ${chalk.bold(String(migration.breaking_changes.length))}`);

  if (migration.guide) {
    console.log(`  Migration guide: ${chalk.blue(migration.guide)}`);
  }

  // Breaking changes
  if (migration.breaking_changes.length > 0) {
    console.log();
    console.log(chalk.bold.red('Breaking Changes:'));
    for (const bc of migration.breaking_changes) {
      console.log();
      console.log(chalk.red.bold(`  ${bc.id}: ${bc.description}`));
      console.log(chalk.gray(`    Type: ${bc.type} (${bc.severity})`));

      if (bc.affected_api) {
        if (bc.affected_api.interface) {
          console.log(chalk.gray(`    API: ${bc.affected_api.interface}`));
        }
        if (bc.affected_api.method) {
          console.log(chalk.gray(`    Method: ${bc.affected_api.method}`));
        }
      }

      if (bc.examples) {
        console.log(chalk.gray('    Before:'));
        console.log(chalk.gray(`      ${bc.examples.before}`));
        console.log(chalk.gray('    After:'));
        console.log(chalk.gray(`      ${bc.examples.after}`));
      }
    }
  }

  // Steps
  if (migration.steps.length > 0) {
    console.log();
    console.log(chalk.bold.cyan('Migration Steps:'));
    for (const step of migration.steps) {
      console.log();
      console.log(chalk.cyan.bold(`  ${step.step}. ${step.description}`));

      if (step.estimated_time) {
        console.log(chalk.gray(`    Time: ${step.estimated_time}`));
      }

      if (step.code_example) {
        console.log(chalk.gray('    Before:'));
        console.log(chalk.gray(`      ${step.code_example.before}`));
        console.log(chalk.gray('    After:'));
        console.log(chalk.gray(`      ${step.code_example.after}`));
      }

      if (step.automated_tool) {
        console.log(chalk.green(`    Automated: ${step.automated_tool}`));
      }
    }
  }

  console.log();
}

/**
 * Format compatibility matrix as table
 */
function formatMatrix(component: string, versions: string[]): void {
  console.log();
  console.log(chalk.bold(`Compatibility Matrix: ${component}`));
  console.log(chalk.gray('='.repeat(60)));

  const data = [
    ['Version', 'Status'],
  ];

  for (const version of versions) {
    const status = version.includes('beta') || version.includes('alpha')
      ? 'Beta'
      : 'Stable';
    data.push([version, status]);
  }

  const output = table(data);
  console.log(output);
  console.log();
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

const program = new Command();

program
  .name('aequor-compat')
  .description('Aequor Version Compatibility CLI')
  .version('1.0.0');

/**
 * Check compatibility between component versions
 */
program
  .command('check')
  .description('Check compatibility between component versions')
  .argument('<component:version>', 'Component and version to check (e.g., @lsi/cascade:2.0.0)')
  .option('-w, --with <components...>', 'Components to check against (e.g., @lsi/protocol:2.0.0)')
  .option('-m, --matrix-dir <path>', 'Path to compatibility matrix directory', DEFAULT_MATRIX_DIR)
  .action(async (componentVersion, options) => {
    const spinner = ora('Checking compatibility...').start();

    try {
      const checker = new CompatibilityChecker(options.matrixDir);
      const constraint = parseComponentVersion(componentVersion);
      const withConstraints = options.with
        ? parseComponentVersions(options.with)
        : [];

      const report = await checker.checkCompatibility(
        constraint.component,
        constraint.version,
        withConstraints
      );

      spinner.stop();
      formatReport(report);

      process.exit(report.compatible ? 0 : 1);
    } catch (error) {
      spinner.fail('Failed to check compatibility');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Show compatibility matrix for a component
 */
program
  .command('matrix')
  .description('Show compatibility matrix for a component')
  .argument('<component>', 'Component name (e.g., @lsi/cascade)')
  .option('-m, --matrix-dir <path>', 'Path to compatibility matrix directory', DEFAULT_MATRIX_DIR)
  .action(async (component, options) => {
    const spinner = ora('Loading matrix...').start();

    try {
      const filename = component.replace('@lsi/', '').replace('/', '-') + '.yaml';
      const filepath = resolve(options.matrixDir, filename);

      if (!existsSync(filepath)) {
        spinner.fail('Matrix not found');
        console.error(chalk.red(`No matrix found for ${component}`));
        process.exit(1);
      }

      const content = readFileSync(filepath, 'utf-8');
      const matrix = YAML.parse(content);

      spinner.stop();

      const versions = Object.keys(matrix.versions || {}).sort();
      formatMatrix(component, versions);
    } catch (error) {
      spinner.fail('Failed to load matrix');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Generate migration guide between versions
 */
program
  .command('migrate')
  .description('Generate migration guide between versions')
  .argument('<component>', 'Component name (e.g., @lsi/cascade)')
  .argument('<from>', 'Source version (e.g., 1.0.0)')
  .argument('<to>', 'Target version (e.g., 2.0.0)')
  .option('-m, --matrix-dir <path>', 'Path to compatibility matrix directory', DEFAULT_MATRIX_DIR)
  .action(async (component, from, to, options) => {
    const spinner = ora('Generating migration guide...').start();

    try {
      const checker = new CompatibilityChecker(options.matrixDir);
      const migration = await checker.generateMigration(component, from, to);

      spinner.stop();
      formatMigration(migration);
    } catch (error) {
      spinner.fail('Failed to generate migration guide');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Find compatible versions for a component
 */
program
  .command('find')
  .description('Find compatible versions for a component')
  .argument('<component>', 'Component name (e.g., @lsi/cascade)')
  .requiredOption('-w, --with <components...>', 'Components to check against (e.g., @lsi/protocol:2.0.0)')
  .option('-m, --matrix-dir <path>', 'Path to compatibility matrix directory', DEFAULT_MATRIX_DIR)
  .action(async (component, options) => {
    const spinner = ora('Finding compatible versions...').start();

    try {
      const checker = new CompatibilityChecker(options.matrixDir);
      const constraints = parseComponentVersions(options.with);
      const versions = await checker.findCompatibleVersions(component, constraints);

      spinner.stop();

      if (versions.length === 0) {
        console.log();
        console.log(chalk.yellow('No compatible versions found'));
        console.log();
      } else {
        console.log();
        console.log(chalk.bold(`Compatible versions for ${component}:`));
        console.log();

        for (const version of versions) {
          console.log(chalk.green(`  ✓ ${version}`));
        }

        console.log();
        console.log(chalk.gray(`Total: ${versions.length} version(s)`));
        console.log();
      }
    } catch (error) {
      spinner.fail('Failed to find compatible versions');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Validate a manifest file
 */
program
  .command('validate')
  .description('Validate a component manifest file')
  .argument('<manifest>', 'Path to manifest file (e.g., components/cascade-router/manifest.yaml)')
  .action(async (manifestPath) => {
    const spinner = ora('Validating manifest...').start();

    try {
      const filepath = resolve(manifestPath);

      if (!existsSync(filepath)) {
        spinner.fail('Manifest not found');
        console.error(chalk.red(`File not found: ${manifestPath}`));
        process.exit(1);
      }

      const content = readFileSync(filepath, 'utf-8');
      const manifest = YAML.parse(content);

      // Basic validation
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!manifest.name) {
        errors.push('Missing required field: name');
      }

      if (!manifest.version) {
        errors.push('Missing required field: version');
      }

      if (!manifest.type) {
        warnings.push('Missing recommended field: type');
      }

      if (!manifest.language) {
        warnings.push('Missing recommended field: language');
      }

      if (!manifest.dependencies) {
        warnings.push('No dependencies specified');
      }

      spinner.stop();

      if (errors.length > 0) {
        console.log();
        console.log(chalk.bold.red('Validation Errors:'));
        for (const error of errors) {
          console.log(chalk.red(`  ✗ ${error}`));
        }
        console.log();
      }

      if (warnings.length > 0) {
        console.log();
        console.log(chalk.bold.yellow('Warnings:'));
        for (const warning of warnings) {
          console.log(chalk.yellow(`  ⚠ ${warning}`));
        }
        console.log();
      }

      if (errors.length === 0 && warnings.length === 0) {
        console.log();
        console.log(chalk.green('✓ Manifest is valid'));
        console.log();
      }

      process.exit(errors.length > 0 ? 1 : 0);
    } catch (error) {
      spinner.fail('Failed to validate manifest');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Check for breaking changes between versions
 */
program
  .command('breaking')
  .description('Check for breaking changes between versions')
  .argument('<component>', 'Component name (e.g., @lsi/cascade)')
  .argument('<from>', 'Source version (e.g., 1.0.0)')
  .argument('<to>', 'Target version (e.g., 2.0.0)')
  .option('-m, --matrix-dir <path>', 'Path to compatibility matrix directory', DEFAULT_MATRIX_DIR)
  .action(async (component, from, to, options) => {
    const spinner = ora('Checking for breaking changes...').start();

    try {
      const checker = new CompatibilityChecker(options.matrixDir);
      const hasBreaking = await checker.hasBreakingChanges(component, from, to);

      spinner.stop();

      if (hasBreaking) {
        console.log();
        console.log(chalk.red.bold('Breaking changes detected'));
        console.log(chalk.gray(`between ${component}@${from} and ${component}@${to}`));
        console.log();

        console.log(chalk.yellow('Run "aequor-compat migrate" for detailed migration guide'));
        console.log();
        process.exit(1);
      } else {
        console.log();
        console.log(chalk.green.bold('No breaking changes'));
        console.log(chalk.gray(`between ${component}@${from} and ${component}@${to}`));
        console.log();
        process.exit(0);
      }
    } catch (error) {
      spinner.fail('Failed to check for breaking changes');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// MAIN
// ============================================================================

program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
