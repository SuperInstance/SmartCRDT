#!/usr/bin/env node

/**
 * Aequor Manifest CLI
 * @version 1.0.0
 *
 * Command-line tool for managing component manifests.
 * Provides init, validate, merge, and export commands.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadManifest,
  loadManifests,
  saveManifest,
  validateManifest,
  mergeManifests,
  createManifestTemplate,
  findManifests,
  validateConfigValue,
  extractComponentName,
  getFlatDependencies,
  hasDependency,
  getComponentTypes,
  getSupportedLanguages,
  ComponentManifest,
  ValidationResult,
  ComponentType,
  Language,
} from '@lsi/manifest';
import * as YAML from 'js-yaml';

const program = new Command();

// CLI configuration
program
  .name('aequor-manifest')
  .description('Aequor Component Manifest CLI - Manage component manifests')
  .version('1.0.0');

/**
 * Initialize a new manifest file
 */
program
  .command('init')
  .description('Create a new manifest file')
  .option('-n, --name <name>', 'Component name (kebab-case)')
  .option('-t, --type <type>', 'Component type')
  .option('-l, --language <language>', 'Implementation language')
  .option('-d, --description <description>', 'Component description')
  .option('-o, --output <path>', 'Output file path', 'manifest.yaml')
  .action(async (options) => {
    try {
      // Prompt for missing options
      const inquirer = await import('inquirer');
      const prompts: any[] = [];

      if (!options.name) {
        prompts.push({
          type: 'input',
          name: 'name',
          message: 'Component name (kebab-case):',
          validate: (input: string) => {
            return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(input) ||
              'Name must be kebab-case (lowercase, numbers, hyphens)';
          },
        });
      }

      if (!options.type) {
        prompts.push({
          type: 'list',
          name: 'type',
          message: 'Component type:',
          choices: getComponentTypes(),
        });
      }

      if (!options.language) {
        prompts.push({
          type: 'list',
          name: 'language',
          message: 'Implementation language:',
          choices: getSupportedLanguages(),
        });
      }

      if (!options.description) {
        prompts.push({
          type: 'input',
          name: 'description',
          message: 'Component description:',
          validate: (input: string) => {
            return input.length >= 10 || 'Description must be at least 10 characters';
          },
        });
      }

      let answers: any = {};
      if (prompts.length > 0) {
        answers = await inquirer.default.prompt(prompts);
      }

      // Merge options with answers
      const name = options.name || answers.name;
      const type = (options.type || answers.type) as ComponentType;
      const language = (options.language || answers.language) as Language;
      const description = options.description || answers.description;

      // Create manifest template
      const manifest = createManifestTemplate({
        name,
        type,
        language,
        description,
      });

      // Save manifest
      saveManifest(manifest, options.output);

      console.log(`✅ Manifest created: ${options.output}`);
      console.log(`   Name: ${name}`);
      console.log(`   Type: ${type}`);
      console.log(`   Language: ${language}`);
    } catch (error) {
      console.error('❌ Error creating manifest:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Validate a manifest file
 */
program
  .command('validate')
  .description('Validate a manifest file')
  .argument('<file>', 'Manifest file path')
  .option('-j, --json', 'Output as JSON')
  .option('-q, --quiet', 'Only show errors')
  .action((file, options) => {
    try {
      const result = loadManifest(file);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.valid) {
        console.log(`✅ Valid manifest: ${file}`);
        if (!options.quiet) {
          const manifest = result.manifest!;
          console.log(`   Name: ${manifest.metadata.name}`);
          console.log(`   Version: ${manifest.metadata.version}`);
          console.log(`   Type: ${manifest.type}`);
          console.log(`   Language: ${manifest.language}`);
        }
        process.exit(0);
      } else {
        console.log(`❌ Invalid manifest: ${file}`);
        console.log(`\nErrors (${result.errors.length}):`);

        for (const error of result.errors) {
          console.log(`\n  [${error.code}] ${error.path}`);
          console.log(`    ${error.message}`);
          if (error.suggestion) {
            console.log(`    💡 ${error.suggestion}`);
          }
        }

        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error validating manifest:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Merge multiple manifest files
 */
program
  .command('merge')
  .description('Merge multiple manifest files')
  .argument('<files...>', 'Manifest file paths to merge')
  .option('-o, --output <path>', 'Output file path', 'manifest-merged.yaml')
  .option('--no-override', 'Don\'t override existing values')
  .option('--merge-arrays', 'Merge arrays instead of replacing')
  .action((files, options) => {
    try {
      if (files.length < 2) {
        console.error('❌ At least 2 manifest files are required for merging');
        process.exit(1);
      }

      // Load all manifests
      const results = loadManifests(files);
      const validManifests = results
        .filter(r => r.valid)
        .map(r => r.manifest!);

      if (validManifests.length < 2) {
        console.error('❌ At least 2 valid manifests are required for merging');
        process.exit(1);
      }

      // Merge manifests
      let merged = validManifests[0];
      for (let i = 1; i < validManifests.length; i++) {
        merged = mergeManifests(merged, validManifests[i], {
          override: options.override,
          mergeArrays: options.mergeArrays,
        });
      }

      // Save merged manifest
      saveManifest(merged, options.output);

      console.log(`✅ Merged ${validManifests.length} manifests → ${options.output}`);
      console.log(`   Base: ${files[0]}`);
      console.log(`   Overrides: ${files.slice(1).join(', ')}`);
    } catch (error) {
      console.error('❌ Error merging manifests:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Export manifest to different formats
 */
program
  .command('export')
  .description('Export manifest to different format')
  .argument('<file>', 'Manifest file path')
  .option('-f, --format <format>', 'Output format (json, yaml)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action((file, options) => {
    try {
      const result = loadManifest(file);

      if (!result.valid) {
        console.error('❌ Invalid manifest');
        for (const error of result.errors) {
          console.error(`  [${error.code}] ${error.path}: ${error.message}`);
        }
        process.exit(1);
      }

      const manifest = result.manifest!;
      let output: string;
      let extension: string;

      switch (options.format.toLowerCase()) {
        case 'json':
          output = JSON.stringify(manifest, null, 2);
          extension = '.json';
          break;
        case 'yaml':
        case 'yml':
          output = YAML.dump(manifest, { indent: 2 });
          extension = '.yaml';
          break;
        default:
          console.error(`❌ Unsupported format: ${options.format}`);
          console.log('   Supported formats: json, yaml');
          process.exit(1);
      }

      const outputPath = options.output ||
        file.replace(/\.(yaml|yml|json)$/, extension);

      fs.writeFileSync(outputPath, output, 'utf-8');

      console.log(`✅ Exported to ${options.format.toUpperCase()}: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error exporting manifest:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Find all manifests in a directory
 */
program
  .command('find')
  .description('Find all manifest files in a directory')
  .argument('[dir]', 'Directory to search', '.')
  .option('-r, --recursive', 'Search recursively', true)
  .option('-j, --json', 'Output as JSON')
  .action((dir, options) => {
    try {
      const manifests = findManifests(dir, options.recursive);

      if (options.json) {
        console.log(JSON.stringify(manifests, null, 2));
      } else {
        console.log(`Found ${manifests.length} manifest(s):\n`);
        for (const manifest of manifests) {
          const name = extractComponentName(manifest);
          console.log(`  • ${name} → ${manifest}`);
        }
      }
    } catch (error) {
      console.error('❌ Error finding manifests:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Validate configuration against manifest
 */
program
  .command('validate-config')
  .description('Validate configuration values against manifest schema')
  .argument('<manifest>', 'Manifest file path')
  .argument('<config>', 'Configuration file path (JSON)')
  .action((manifestPath, configPath) => {
    try {
      const manifestResult = loadManifest(manifestPath);
      if (!manifestResult.valid) {
        console.error('❌ Invalid manifest');
        process.exit(1);
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      const result = validateConfigValue(manifestResult.manifest!, config);

      if (result.valid) {
        console.log('✅ Configuration is valid');
      } else {
        console.log('❌ Configuration validation failed:\n');
        for (const error of result.errors) {
          console.log(`  • ${error}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error validating configuration:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Show manifest information
 */
program
  .command('info')
  .description('Show detailed information about a manifest')
  .argument('<file>', 'Manifest file path')
  .option('-j, --json', 'Output as JSON')
  .action((file, options) => {
    try {
      const result = loadManifest(file);

      if (!result.valid) {
        console.error('❌ Invalid manifest');
        process.exit(1);
      }

      const manifest = result.manifest!;

      if (options.json) {
        console.log(JSON.stringify(manifest, null, 2));
        return;
      }

      // Display information
      console.log(`\n📦 Component: ${manifest.metadata.name}`);
      console.log(`   Version: ${manifest.metadata.version}`);
      console.log(`   Description: ${manifest.metadata.description}`);
      if (manifest.metadata.author) {
        console.log(`   Author: ${manifest.metadata.author}`);
      }
      if (manifest.metadata.license) {
        console.log(`   License: ${manifest.metadata.license}`);
      }
      if (manifest.metadata.tags) {
        console.log(`   Tags: ${manifest.metadata.tags.join(', ')}`);
      }

      console.log(`\n🔧 Type & Language:`);
      console.log(`   Type: ${manifest.type}`);
      console.log(`   Language: ${manifest.language}`);
      if (manifest.runtime) {
        console.log(`   Runtime: ${manifest.runtime}`);
      }

      if (manifest.native) {
        console.log(`\n⚡ Native Module:`);
        console.log(`   Language: ${manifest.native.language}`);
        console.log(`   Bindings: ${manifest.native.bindings.join(', ')}`);
        if (manifest.native.wasm) {
          console.log(`   WASM: Yes`);
        }
        if (manifest.native.simd) {
          console.log(`   SIMD: Yes`);
        }
      }

      if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
        console.log(`\n📦 Dependencies:`);
        if (manifest.dependencies.protocol) {
          console.log(`   protocol: ${manifest.dependencies.protocol}`);
        }
        if (manifest.dependencies.components) {
          for (const [name, version] of Object.entries(manifest.dependencies.components)) {
            console.log(`   ${name}: ${version}`);
          }
        }
      }

      console.log(`\n⚙️  Configuration:`);
      const props = Object.keys(manifest.configuration.properties);
      console.log(`   Properties: ${props.length}`);
      console.log(`   Required: ${manifest.configuration.required?.length || 0}`);

      if (manifest.hardware) {
        console.log(`\n💻 Hardware (Guidance):`);
        if (manifest.hardware.min_memory_mb) {
          console.log(`   Min Memory: ${manifest.hardware.min_memory_mb} MB`);
        }
        if (manifest.hardware.gpu_optional) {
          console.log(`   GPU: Optional`);
        }
      }

      if (manifest.performance) {
        console.log(`\n📊 Performance:`);
        if (manifest.performance.benchmark_qps) {
          console.log(`   QPS: ${manifest.performance.benchmark_qps}`);
        }
        if (manifest.performance.latency_p50_ms) {
          console.log(`   p50 Latency: ${manifest.performance.latency_p50_ms} ms`);
        }
      }

      console.log(`\n🔌 Interface:`);
      console.log(`   Main: ${manifest.interface.main}`);
      console.log(`   Exports: ${manifest.interface.exports.join(', ')}`);
      if (manifest.interface.protocol) {
        console.log(`   Protocol: ${manifest.interface.protocol}`);
      }

      console.log(`\n🧪 Tests:`);
      console.log(`   Framework: ${manifest.tests.framework}`);
      console.log(`   Command: ${manifest.tests.command}`);
      if (manifest.tests.coverage_threshold) {
        console.log(`   Coverage Threshold: ${manifest.tests.coverage_threshold}%`);
      }

      console.log('');
    } catch (error) {
      console.error('❌ Error reading manifest:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Validate all manifests in a directory
 */
program
  .command('validate-all')
  .description('Validate all manifest files in a directory')
  .argument('[dir]', 'Directory to search', '.')
  .option('-r, --recursive', 'Search recursively', true)
  .action((dir, options) => {
    try {
      const manifests = findManifests(dir, options.recursive);

      if (manifests.length === 0) {
        console.log('No manifests found');
        return;
      }

      console.log(`Validating ${manifests.length} manifest(s)...\n`);

      const results = loadManifests(manifests);
      const valid = results.filter(r => r.valid);
      const invalid = results.filter(r => !r.valid);

      for (const result of results) {
        const filePath = (result.manifest as any)?._filePath || 'unknown';
        const name = extractComponentName(filePath);

        if (result.valid) {
          console.log(`✅ ${name}`);
        } else {
          console.log(`❌ ${name} (${result.errors.length} error(s))`);
          for (const error of result.errors) {
            console.log(`    [${error.code}] ${error.path}: ${error.message}`);
          }
        }
      }

      console.log(`\nSummary: ${valid.length} valid, ${invalid.length} invalid`);

      process.exit(invalid.length > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Error validating manifests:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
