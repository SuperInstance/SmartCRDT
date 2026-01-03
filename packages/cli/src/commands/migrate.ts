#!/usr/bin/env node
/**
 * Aequor Migration CLI Tool
 * Automated migration scripts for upgrading between versions
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';

const program = new Command();

interface MigrationConfig {
  from: string;
  to: string;
  backupDir: string;
  dryRun: boolean;
  rollbackOnFailure: boolean;
}

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: string;
  engines?: {
    node?: string;
  };
}

// Migration rules for different versions
const MIGRATION_RULES: Record<string, MigrationRule[]> = {
  '0.1.0->1.0.0': [
    {
      type: 'dependency',
      action: 'remove',
      packages: ['lsi-ecosystem']
    },
    {
      type: 'dependency',
      action: 'add',
      packages: [
        '@lsi/protocol',
        '@lsi/cascade',
        '@lsi/superinstance',
        '@lsi/privacy',
        '@lsi/embeddings',
        '@lsi/core'
      ]
    },
    {
      type: 'packageJson',
      action: 'add',
      key: 'type',
      value: 'module'
    },
    {
      type: 'packageJson',
      action: 'update',
      key: 'engines.node',
      value: '>=18.0.0'
    },
    {
      type: 'import',
      from: 'lsi-ecosystem',
      to: '@lsi/superinstance',
      mappings: {
        LSI: 'SuperInstance',
        CascadeRouter: 'CascadeRouter'
      }
    }
  ]
};

interface MigrationRule {
  type: 'dependency' | 'packageJson' | 'import' | 'config';
  action: 'add' | 'remove' | 'update' | 'replace';
  packages?: string[];
  key?: string;
  value?: string;
  from?: string;
  to?: string;
  mappings?: Record<string, string>;
}

/**
 * Main migrate command
 */
program
  .command('migrate')
  .description('Run migration between versions')
  .option('--from <version>', 'Source version')
  .option('--to <version>', 'Target version')
  .option('--dry-run', 'Preview changes without applying')
  .option('--backup-dir <path>', 'Backup directory path', './backups')
  .option('--no-rollback', 'Do not rollback on failure')
  .action(async (options) => {
    const config: MigrationConfig = {
      from: options.from,
      to: options.to,
      backupDir: options.backupDir,
      dryRun: options.dryRun,
      rollbackOnFailure: options.rollback !== false
    };

    await runMigration(config);
  });

/**
 * Generate migration plan
 */
program
  .command('plan')
  .description('Generate migration plan without executing')
  .option('--from <version>', 'Source version')
  .option('--to <version>', 'Target version')
  .option('--output <path>', 'Output file for migration plan', './migration-plan.json')
  .action(async (options) => {
    await generateMigrationPlan(options.from, options.to, options.output);
  });

/**
 * Validate migration readiness
 */
program
  .command('validate')
  .description('Validate current state for migration')
  .option('--from <version>', 'Source version')
  .option('--to <version>', 'Target version')
  .action(async (options) => {
    await validateMigration(options.from, options.to);
  });

/**
 * Rollback migration
 */
program
  .command('rollback')
  .description('Rollback to previous version')
  .option('--to <version>', 'Target version to rollback to')
  .option('--backup-dir <path>', 'Backup directory path', './backups')
  .action(async (options) => {
    await rollbackMigration(options.to, options.backupDir);
  });

/**
 * Apply specific migration rule
 */
program
  .command('apply-rule')
  .description('Apply a specific migration rule')
  .option('--rule <type>', 'Rule type to apply')
  .option('--file <path>', 'File to apply rule to')
  .action(async (options) => {
    await applyMigrationRule(options.rule, options.file);
  });

/**
 * Main migration execution
 */
async function runMigration(config: MigrationConfig) {
  console.log(`=== Migrating from ${config.from} to ${config.to} ===\n`);

  try {
    // Pre-migration checks
    await preMigrationChecks(config);

    // Backup current state
    if (!config.dryRun) {
      await backupCurrentState(config);
    }

    // Get migration rules
    const migrationKey = `${config.from}->${config.to}`;
    const rules = MIGRATION_RULES[migrationKey];

    if (!rules) {
      throw new Error(`No migration rules found for ${migrationKey}`);
    }

    console.log(`Found ${rules.length} migration rules\n`);

    // Apply each rule
    for (const rule of rules) {
      await applyRule(rule, config);
    }

    // Update dependencies
    if (!config.dryRun) {
      await updateDependencies(config);
    }

    // Run tests
    if (!config.dryRun) {
      await runTests();
    }

    console.log('\n✓ Migration successful!');
    console.log('\nNext steps:');
    console.log('1. Review the changes');
    console.log('2. Test in staging environment');
    console.log('3. Deploy to production when ready');

  } catch (error) {
    console.error('\n✗ Migration failed:', (error as Error).message);

    if (config.rollbackOnFailure && !config.dryRun) {
      console.log('\nRolling back...');
      await rollbackMigration(config.from, config.backupDir);
    }

    process.exit(1);
  }
}

/**
 * Pre-migration checks
 */
async function preMigrationChecks(config: MigrationConfig): Promise<void> {
  console.log('Running pre-migration checks...');

  // Check if backup directory exists
  try {
    await fs.mkdir(config.backupDir, { recursive: true });
  } catch (error) {
    throw new Error(`Cannot create backup directory: ${config.backupDir}`);
  }

  // Check package.json exists
  try {
    await fs.access('./package.json');
  } catch {
    throw new Error('package.json not found. Run this command from project root.');
  }

  // Check current version
  const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8')) as PackageJson;
  const currentVersion = pkg.dependencies?.['lsi-ecosystem'] ||
                        pkg.dependencies?.['@lsi/superinstance'];

  if (!currentVersion) {
    throw new Error('Cannot determine current Aequor version');
  }

  console.log(`Current version: ${currentVersion}`);
  console.log('✓ Pre-migration checks passed\n');
}

/**
 * Backup current state
 */
async function backupCurrentState(config: MigrationConfig): Promise<void> {
  console.log('Backing up current state...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(config.backupDir, timestamp);

  await fs.mkdir(backupPath, { recursive: true });

  // Backup package.json
  await fs.copyFile('./package.json', path.join(backupPath, 'package.json'));

  // Backup tsconfig.json
  try {
    await fs.copyFile('./tsconfig.json', path.join(backupPath, 'tsconfig.json'));
  } catch {
    // tsconfig.json might not exist, that's ok
  }

  // Backup aequor.config.js if exists
  try {
    await fs.copyFile('./aequor.config.js', path.join(backupPath, 'aequor.config.js'));
  } catch {
    // Config might not exist, that's ok
  }

  console.log(`✓ Backed up to: ${backupPath}\n`);
}

/**
 * Apply migration rule
 */
async function applyRule(rule: MigrationRule, config: MigrationConfig): Promise<void> {
  console.log(`Applying rule: ${rule.type} - ${rule.action}`);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would apply:`, rule);
    return;
  }

  switch (rule.type) {
    case 'dependency':
      await applyDependencyRule(rule);
      break;
    case 'packageJson':
      await applyPackageJsonRule(rule);
      break;
    case 'import':
      await applyImportRule(rule);
      break;
    default:
      console.log(`  Unknown rule type: ${rule.type}`);
  }

  console.log(`  ✓ Applied\n`);
}

/**
 * Apply dependency rule
 */
async function applyDependencyRule(rule: MigrationRule): Promise<void> {
  const pkgPath = './package.json';
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as PackageJson;

  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }

  if (rule.action === 'remove' && rule.packages) {
    for (const pkgName of rule.packages) {
      delete pkg.dependencies[pkgName];
      console.log(`  Removed: ${pkgName}`);
    }
  } else if (rule.action === 'add' && rule.packages) {
    for (const pkgName of rule.packages) {
      pkg.dependencies[pkgName] = 'workspace:*';
      console.log(`  Added: ${pkgName}`);
    }
  }

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
}

/**
 * Apply package.json rule
 */
async function applyPackageJsonRule(rule: MigrationRule): Promise<void> {
  const pkgPath = './package.json';
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as PackageJson;

  if (rule.action === 'add' && rule.key && rule.value) {
    const keys = rule.key.split('.');
    let current: any = pkg;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = rule.value;
    console.log(`  Added ${rule.key}: ${rule.value}`);
  } else if (rule.action === 'update' && rule.key && rule.value) {
    const keys = rule.key.split('.');
    let current: any = pkg;
    for (const key of keys) {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    current[lastKey] = rule.value;
    console.log(`  Updated ${rule.key}: ${rule.value}`);
  }

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
}

/**
 * Apply import rule (updates source files)
 */
async function applyImportRule(rule: MigrationRule): Promise<void> {
  if (!rule.from || !rule.to) {
    console.log('  Missing from/to for import rule');
    return;
  }

  // Find all TypeScript/JavaScript files
  const files = await findSourceFiles('./src');

  for (const file of files) {
    let content = await fs.readFile(file, 'utf-8');
    let modified = false;

    // Replace import statements
    const importRegex = new RegExp(
      `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${rule.from}['"]`,
      'g'
    );

    content = content.replace(importRegex, (match, imports) => {
      modified = true;

      // Map old imports to new imports
      const oldImports = imports.split(',').map((s: string) => s.trim());
      const newImports = oldImports.map((oldImport: string) => {
        const newName = rule.mappings?.[oldImport] || oldImport;
        return newName;
      }).join(', ');

      return `import { ${newImports} } from '${rule.to}'`;
    });

    if (modified) {
      await fs.writeFile(file, content);
      console.log(`  Updated imports in: ${file}`);
    }
  }
}

/**
 * Update dependencies (npm install)
 */
async function updateDependencies(config: MigrationConfig): Promise<void> {
  console.log('Updating dependencies...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run: npm install');
    return;
  }

  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ Dependencies updated\n');
  } catch (error) {
    throw new Error('Failed to update dependencies');
  }
}

/**
 * Run tests
 */
async function runTests(): Promise<void> {
  console.log('Running tests...');

  try {
    // Check if tests exist
    await fs.access('./test');
    await fs.access('./test');

    execSync('npm test', { stdio: 'inherit' });
    console.log('✓ Tests passed\n');
  } catch {
    console.log('⚠ No tests found or tests failed. Please run tests manually.\n');
  }
}

/**
 * Generate migration plan
 */
async function generateMigrationPlan(from: string, to: string, outputPath: string): Promise<void> {
  console.log(`Generating migration plan: ${from} -> ${to}\n`);

  const migrationKey = `${from}->${to}`;
  const rules = MIGRATION_RULES[migrationKey];

  if (!rules) {
    throw new Error(`No migration rules found for ${migrationKey}`);
  }

  const plan = {
    from,
    to,
    generatedAt: new Date().toISOString(),
    rules: rules.map(rule => ({
      ...rule,
      description: describeRule(rule)
    })),
    estimatedTime: estimateTime(rules),
    breakingChanges: identifyBreakingChanges(rules)
  };

  await fs.writeFile(outputPath, JSON.stringify(plan, null, 2));
  console.log(`✓ Migration plan saved to: ${outputPath}\n`);
}

/**
 * Validate migration readiness
 */
async function validateMigration(from: string | undefined, to: string | undefined): Promise<void> {
  console.log('Validating migration readiness...\n');

  const issues: string[] = [];
  const warnings: string[] = [];

  // Check Node.js version
  const nodeVersion = process.version;
  if (!semver.satisfies(nodeVersion, '>=18.0.0')) {
    issues.push(`Node.js version ${nodeVersion} is incompatible. Requires >=18.0.0`);
  }

  // Check TypeScript version
  try {
    const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8')) as PackageJson;
    const tsVersion = pkg.devDependencies?.['typescript'];
    if (tsVersion && !semver.satisfies(tsVersion, '>=5.3.0')) {
      issues.push(`TypeScript version ${tsVersion} is incompatible. Requires >=5.3.0`);
    }
  } catch {
    warnings.push('Cannot determine TypeScript version');
  }

  // Check for ESM compatibility
  try {
    const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8')) as PackageJson;
    if (pkg.type !== 'module') {
      warnings.push('package.json does not have "type": "module"');
    }
  } catch {
    warnings.push('Cannot check ESM compatibility');
  }

  // Check for old imports
  try {
    const files = await findSourceFiles('./src');
    let oldImports = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      if (content.includes("from 'lsi-ecosystem'") ||
          content.includes('from "lsi-ecosystem"')) {
        oldImports++;
      }
    }

    if (oldImports > 0) {
      warnings.push(`Found ${oldImports} files with old imports that need updating`);
    }
  } catch {
    // Source directory might not exist
  }

  // Report results
  if (issues.length > 0) {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`  - ${warning}`));
    console.log();
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('✓ All checks passed. Ready for migration!\n');
  } else if (issues.length > 0) {
    console.log('✗ Migration blocked by issues. Please fix them before migrating.\n');
    process.exit(1);
  } else {
    console.log('⚠️  Migration possible but warnings detected. Proceed with caution.\n');
  }
}

/**
 * Rollback migration
 */
async function rollbackMigration(to: string | undefined, backupDir: string): Promise<void> {
  console.log(`Rolling back to version: ${to}\n`);

  try {
    // Find latest backup
    const backups = await fs.readdir(backupDir);
    const latestBackup = backups.sort().pop();

    if (!latestBackup) {
      throw new Error('No backup found');
    }

    const backupPath = path.join(backupDir, latestBackup);
    console.log(`Restoring from: ${backupPath}\n`);

    // Restore package.json
    await fs.copyFile(
      path.join(backupPath, 'package.json'),
      './package.json'
    );
    console.log('✓ Restored package.json');

    // Restore tsconfig.json if exists
    try {
      await fs.copyFile(
        path.join(backupPath, 'tsconfig.json'),
        './tsconfig.json'
      );
      console.log('✓ Restored tsconfig.json');
    } catch {
      // tsconfig.json might not be in backup
    }

    // Restore aequor.config.js if exists
    try {
      await fs.copyFile(
        path.join(backupPath, 'aequor.config.js'),
        './aequor.config.js'
      );
      console.log('✓ Restored aequor.config.js');
    } catch {
      // Config might not be in backup
    }

    // Reinstall dependencies
    console.log('\nReinstalling dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    console.log('\n✓ Rollback complete!\n');

  } catch (error) {
    console.error('✗ Rollback failed:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Helper functions
 */

async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findSourceFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist
  }

  return files;
}

function describeRule(rule: MigrationRule): string {
  switch (rule.type) {
    case 'dependency':
      return rule.action === 'remove'
        ? `Remove packages: ${rule.packages?.join(', ')}`
        : `Add packages: ${rule.packages?.join(', ')}`;
    case 'packageJson':
      return `${rule.action} ${rule.key} = ${rule.value}`;
    case 'import':
      return `Replace imports from '${rule.from}' to '${rule.to}'`;
    default:
      return 'Unknown rule';
  }
}

function estimateTime(rules: MigrationRule[]): string {
  // Rough estimation: 5 minutes per rule
  const minutes = rules.length * 5;
  if (minutes < 60) {
    return `~${minutes} minutes`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `~${hours}h ${remainingMinutes}m`;
  }
}

function identifyBreakingChanges(rules: MigrationRule[]): string[] {
  const breaking: string[] = [];

  for (const rule of rules) {
    if (rule.type === 'import') {
      breaking.push(`Import path changes: ${rule.from} -> ${rule.to}`);
    }
    if (rule.type === 'packageJson' && rule.key === 'type') {
      breaking.push('Module system change: CommonJS -> ESM');
    }
  }

  return breaking;
}

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
