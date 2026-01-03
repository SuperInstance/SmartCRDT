#!/usr/bin/env node

/**
 * Benchmark Setup Verification Script
 *
 * Verifies that all benchmark files and dependencies are properly configured.
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function checkExists(filepath, description) {
  const exists = fs.existsSync(filepath);
  const status = exists ? colorize('green', '✓') : colorize('red', '✗');
  const statusText = exists ? colorize('green', 'Found') : colorize('red', 'Missing');

  console.log(`  ${status} ${description}: ${statusText}`);
  return exists;
}

function checkFileContains(filepath, pattern, description) {
  if (!fs.existsSync(filepath)) {
    console.log(`  ${colorize('red', '✗')} ${description}: ${colorize('red', 'File missing')}`);
    return false;
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const matches = content.includes(pattern) || new RegExp(pattern).test(content);
  const status = matches ? colorize('green', '✓') : colorize('yellow', '⚠');
  const statusText = matches ? colorize('green', 'Present') : colorize('yellow', 'Not found');

  console.log(`  ${status} ${description}: ${statusText}`);
  return matches;
}

console.log(colorize('bright', colorize('cyan', '\n========================================')));
console.log(colorize('bright', colorize('cyan', '  BENCHMARK SETUP VERIFICATION')));
console.log(colorize('bright', colorize('cyan', '========================================\n')));

const root = path.join(__dirname, '..');
let allChecksPassed = true;

// Check benchmark scripts
console.log(colorize('bright', 'Benchmark Scripts:'));
console.log(colorize('cyan', '-------------------'));

const scripts = [
  { path: 'scripts/benchmark-all.js', desc: 'Main benchmark runner' },
  { path: 'scripts/generate-performance-report.js', desc: 'Report generator' },
];

for (const script of scripts) {
  const exists = checkExists(path.join(root, script.path), script.desc);
  if (!exists) allChecksPassed = false;
}

// Check benchmark implementations
console.log(colorize('bright', '\nBenchmark Implementations:'));
console.log(colorize('cyan', '----------------------------'));

const benchmarks = [
  { path: 'benchmarks/bench-vector-operations.js', desc: 'Vector operations' },
  { path: 'benchmarks/bench-hash.js', desc: 'Hash functions' },
  { path: 'benchmarks/bench-crdt-merge.js', desc: 'CRDT merges' },
  { path: 'benchmarks/README.md', desc: 'Benchmark documentation' },
];

for (const bench of benchmarks) {
  const exists = checkExists(path.join(root, bench.path), bench.desc);
  if (!exists) allChecksPassed = false;
}

// Check documentation
console.log(colorize('bright', '\nDocumentation:'));
console.log(colorize('cyan', '--------------'));

const docs = [
  { path: 'docs/PERFORMANCE_REPORT.md', desc: 'Performance report template' },
  { path: 'docs/BUILD_SYSTEM_INTEGRATION.md', desc: 'Implementation summary' },
  { path: 'BENCHMARKS_QUICK_START.md', desc: 'Quick start guide' },
];

for (const doc of docs) {
  const exists = checkExists(path.join(root, doc.path), doc.desc);
  if (!exists) allChecksPassed = false;
}

// Check package.json scripts
console.log(colorize('bright', '\nNPM Scripts:'));
console.log(colorize('cyan', '------------'));

const packageJsonPath = path.join(root, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const scripts = packageJson.scripts || {};

  const requiredScripts = [
    { name: 'build:native:release', desc: 'Native release build' },
    { name: 'test:native', desc: 'Native tests' },
    { name: 'bench', desc: 'Run benchmarks' },
    { name: 'bench:report', desc: 'Generate report' },
  ];

  for (const script of requiredScripts) {
    const present = scripts[script.name] !== undefined;
    const status = present ? colorize('green', '✓') : colorize('red', '✗');
    const statusText = present ? colorize('green', 'Present') : colorize('red', 'Missing');

    console.log(`  ${status} ${script.desc} (${script.name}): ${statusText}`);
    if (!present) allChecksPassed = false;
  }
} else {
  console.log(`  ${colorize('red', '✗')} package.json: ${colorize('red', 'Missing')}`);
  allChecksPassed = false;
}

// Check CI/CD workflow
console.log(colorize('bright', '\nCI/CD Workflow:'));
console.log(colorize('cyan', '---------------'));

const workflowPath = path.join(root, '.github/workflows/benchmark.yml');
if (checkExists(workflowPath, 'Benchmark workflow')) {
  checkFileContains(workflowPath, 'build:native:release', 'Native build step');
  checkFileContains(workflowPath, 'npm run bench', 'Benchmark execution');
  checkFileContains(workflowPath, 'bench:report', 'Report generation');
}

// Check native module structure
console.log(colorize('bright', '\nNative Modules:'));
console.log(colorize('cyan', '---------------'));

const nativePath = path.join(root, 'native');
const nativeDirs = ['core', 'embeddings', 'crypto', 'crdt', 'ffi'];

for (const dir of nativeDirs) {
  const exists = checkExists(path.join(nativePath, dir), `native/${dir}`);
  if (!exists) allChecksPassed = false;
}

// Final summary
console.log(colorize('bright', '\n========================================'));
if (allChecksPassed) {
  console.log(colorize('bright', colorize('green', '  ✓ ALL CHECKS PASSED')));
  console.log(colorize('bright', colorize('cyan', '========================================\n')));
  console.log(colorize('green', 'Benchmark setup is complete!'));
  console.log('\nNext steps:');
  console.log('  1. Build the project: npm run build');
  console.log('  2. Run benchmarks: npm run bench');
  console.log('  3. Generate report: npm run bench:report');
} else {
  console.log(colorize('bright', colorize('red', '  ✗ SOME CHECKS FAILED')));
  console.log(colorize('bright', colorize('cyan', '========================================\n')));
  console.log(colorize('yellow', 'Please review the failed checks above.'));
}

process.exit(allChecksPassed ? 0 : 1);
