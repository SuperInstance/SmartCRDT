#!/usr/bin/env node
/**
 * Automated API Documentation Generator
 *
 * Generates TypeDoc HTML documentation from TypeScript source.
 * This script is run via npm run docs:generate
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log('✓ ' + message, 'green');
}

function error(message) {
  log('✗ ' + message, 'red');
}

function info(message) {
  log('→ ' + message, 'cyan');
}

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'inherit' });
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function generateDocs() {
  log('\n🚀 LSI SuperInstance API Documentation Generator', 'bright');
  log('================================================\n', 'bright');

  // Check if typedoc is installed
  info('Checking TypeDoc installation...');
  const typedocExists = fs.existsSync('./node_modules/.bin/typedoc');

  if (!typedocExists) {
    info('TypeDoc not found. Installing dependencies...');
    try {
      await runCommand('npm', ['install']);
      success('Dependencies installed');
    } catch (err) {
      error('Failed to install dependencies');
      process.exit(1);
    }
  }

  // Clean output directory
  info('Cleaning output directory...');
  const outDir = './docs/api';
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  success('Output directory cleaned');

  // Generate TypeDoc documentation
  info('Generating TypeDoc HTML documentation...');
  try {
    await runCommand('npx', ['typedoc', '--config', 'typedoc.json']);
    success('TypeDoc documentation generated');
  } catch (err) {
    error('Failed to generate TypeDoc documentation');
    console.error(err);
    process.exit(1);
  }

  // Generate JSON documentation
  info('Generating JSON documentation...');
  try {
    await runCommand('npx', [
      'typedoc',
      '--config', 'typedoc.json',
      '--json', 'docs/api/documentation.json',
      '--output', 'none'
    ]);
    success('JSON documentation generated');
  } catch (err) {
    error('Failed to generate JSON documentation');
    console.error(err);
    // Don't exit, this is optional
  }

  // Copy additional docs
  info('Copying additional documentation files...');
  const filesToCopy = [
    'docs/api/API_OVERVIEW.md',
    'docs/api/CORE_API_EXAMPLES.md',
    'docs/api/CASCADE_API_EXAMPLES.md',
    'docs/api/PARAMETER_RETURN_TYPES.md',
  ];

  for (const file of filesToCopy) {
    if (fs.existsSync(file)) {
      const dest = path.join(outDir, path.basename(file));
      fs.copyFileSync(file, dest);
    }
  }
  success('Documentation files copied');

  // Generate statistics
  info('Generating documentation statistics...');
  const stats = await generateStats();

  console.log('\n📊 Documentation Statistics:', 'bright');
  console.log('─────────────────────────────────────');
  console.log(`Total APIs documented: ${stats.totalApis}`);
  console.log(`  - @lsi/core: ${stats.coreApis}`);
  console.log(`  - @lsi/cascade: ${stats.cascadeApis}`);
  console.log(`  - @lsi/superinstance: ${stats.superinstanceApis}`);
  console.log(`  - @lsi/protocol: ${stats.protocolApis}`);
  console.log(`Examples written: ${stats.examples}`);
  console.log(`Code snippets: ${stats.snippets}`);
  console.log(`\nDocumentation size: ${stats.sizeInMB} MB`);
  console.log('─────────────────────────────────────\n');

  success('Documentation generation complete!\n');

  log('📖 Documentation available at:', 'bright');
  log('  → HTML: docs/api/index.html', 'cyan');
  log('  → JSON: docs/api/documentation.json', 'cyan');
  log('  → Overview: docs/api/API_OVERVIEW.md', 'cyan');
}

async function generateStats() {
  const packages = [
    { name: '@lsi/core', path: 'packages/core/src' },
    { name: '@lsi/cascade', path: 'packages/cascade/src' },
    { name: '@lsi/superinstance', path: 'packages/superinstance/src' },
    { name: '@lsi/protocol', path: 'packages/protocol/src' },
  ];

  let totalApis = 0;
  const apiCounts = {};
  let examples = 0;
  let snippets = 0;

  for (const pkg of packages) {
    const count = await countAPIs(pkg.path);
    apiCounts[pkg.name] = count;
    totalApis += count;
  }

  // Count examples and snippets
  const docFiles = [
    'docs/api/CORE_API_EXAMPLES.md',
    'docs/api/CASCADE_API_EXAMPLES.md',
    'docs/api/PARAMETER_RETURN_TYPES.md',
  ];

  for (const file of docFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      examples += (content.match(/```typescript/g) || []).length;
      snippets += (content.match(/```/g) || []).length / 2;
    }
  }

  // Calculate size
  const getSize = (dir) => {
    let size = 0;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        size += getSize(filePath);
      } else {
        size += fs.statSync(filePath).size;
      }
    }
    return size;
  };

  let sizeInMB = 0;
  if (fs.existsSync('docs/api')) {
    const bytes = getSize('docs/api');
    sizeInMB = (bytes / (1024 * 1024)).toFixed(2);
  }

  return {
    totalApis,
    coreApis: apiCounts['@lsi/core'],
    cascadeApis: apiCounts['@lsi/cascade'],
    superinstanceApis: apiCounts['@lsi/superinstance'],
    protocolApis: apiCounts['@lsi/protocol'],
    examples,
    snippets,
    sizeInMB,
  };
}

async function countAPIs(dir) {
  let count = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      count += await countAPIs(filePath);
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.test.ts') && !file.name.endsWith('.d.ts')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      count += (content.match(/export (class|interface|type|function|enum)/g) || []).length;
    }
  }

  return count;
}

// Run the generator
generateDocs().catch(err => {
  error('Documentation generation failed');
  console.error(err);
  process.exit(1);
});
