#!/usr/bin/env node

/**
 * Comprehensive Benchmark Suite
 *
 * Compares TypeScript and Rust native module performance across key operations.
 *
 * Run with: npm run benchmark
 */

const { execSync } = require('child_process');
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

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log(`\n${colorize('bright', colorize('cyan', '='.repeat(80)))}`);
  console.log(`${colorize('bright', colorize('blue', `  ${title}`))}`);
  console.log(`${colorize('bright', colorize('cyan', '='.repeat(80)))}\n`);
}

function printSubheader(title) {
  console.log(`\n${colorize('bright', colorize('yellow', `${title}`))}`);
  console.log(colorize('cyan', '-'.repeat(title.length)));
}

function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

function formatLatency(us) {
  if (us >= 1000) {
    return `${(us / 1000).toFixed(2)}ms`;
  }
  return `${us.toFixed(0)}μs`;
}

function formatSpeedup(tsTime, rustTime) {
  const speedup = tsTime / rustTime;
  if (speedup > 1) {
    return colorize('green', `${speedup.toFixed(2)}x faster`);
  } else {
    return colorize('red', `${(1 / speedup).toFixed(2)}x slower`);
  }
}

// Benchmark categories
const benchmarks = [
  {
    name: 'Vector Distance Calculations',
    description: 'Cosine similarity and Euclidean distance computations',
    file: 'bench-vector-operations.js',
    category: 'embeddings',
  },
  {
    name: 'HNSW Similarity Search',
    description: 'Approximate nearest neighbor search performance',
    file: 'bench-hnsw-search.js',
    category: 'embeddings',
  },
  {
    name: 'Vector Quantization',
    description: 'Product quantization for memory efficiency',
    file: 'bench-quantization.js',
    category: 'embeddings',
  },
  {
    name: 'CRDT Merge Operations',
    description: 'G-Counter and PN-Counter merge performance',
    file: 'bench-crdt-merge.js',
    category: 'crdt',
  },
  {
    name: 'Hash Functions',
    description: 'BLAKE3 and SHA-256 hashing performance',
    file: 'bench-hash.js',
    category: 'crypto',
  },
  {
    name: 'Pattern Matching',
    description: 'Regex and string matching performance',
    file: 'bench-patterns.js',
    category: 'core',
  },
];

async function runBenchmark(benchmarkFile) {
  const fullPath = path.join(__dirname, '..', 'benchmarks', benchmarkFile);

  if (!fs.existsSync(fullPath)) {
    console.log(colorize('yellow', `  ⚠ Benchmark file not found: ${benchmarkFile}`));
    console.log(colorize('yellow', `  Creating placeholder...`));
    return null;
  }

  try {
    const output = execSync(`node ${fullPath}`, {
      encoding: 'utf-8',
      cwd: path.dirname(fullPath),
    });
    return JSON.parse(output);
  } catch (error) {
    console.error(colorize('red', `  ✗ Error running ${benchmarkFile}: ${error.message}`));
    return null;
  }
}

async function runAllBenchmarks() {
  printHeader('SuperInstance Performance Benchmarks');
  console.log(colorize('bright', 'Comparing TypeScript vs Rust Native Modules\n'));

  const results = {
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: require('os').cpus().length,
      totalMemory: `${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
    },
    benchmarks: {},
  };

  // Check if native module is available
  let nativeAvailable = false;
  try {
    require('@superinstance/native');
    nativeAvailable = true;
    console.log(colorize('green', '✓ Native module loaded successfully\n'));
  } catch (error) {
    console.log(colorize('yellow', '⚠ Native module not available. Building...\n'));
    try {
      execSync('npm run build:native', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });
      nativeAvailable = true;
      console.log(colorize('green', '\n✓ Native module built successfully\n'));
    } catch (buildError) {
      console.log(colorize('red', '✗ Failed to build native module'));
      console.log(colorize('yellow', '  Running TypeScript-only benchmarks...\n'));
    }
  }

  for (const benchmark of benchmarks) {
    printSubheader(benchmark.name);
    console.log(`  ${benchmark.description}\n`);

    const result = await runBenchmark(benchmark.file);

    if (result) {
      results.benchmarks[benchmark.name] = result;

      // Display results
      if (result.typeScript && result.rust) {
        console.log(`  ${colorize('blue', 'TypeScript:')} ${formatLatency(result.typeScript.latency)} (${formatNumber(result.typeScript.throughput)} ops/s)`);
        console.log(`  ${colorize('green', 'Rust:')}      ${formatLatency(result.rust.latency)} (${formatNumber(result.rust.throughput)} ops/s)`);
        console.log(`  ${colorize('bright', 'Speedup:')}   ${formatSpeedup(result.typeScript.latency, result.rust.latency)}`);
      } else if (result.typeScript) {
        console.log(`  ${colorize('blue', 'TypeScript:')} ${formatLatency(result.typeScript.latency)} (${formatNumber(result.typeScript.throughput)} ops/s)`);
        console.log(`  ${colorize('yellow', 'Rust:      Not available')}`);
      }
    } else {
      console.log(colorize('yellow', '  ⚠ Benchmark skipped (not implemented)'));
    }
  }

  // Generate summary
  printHeader('Performance Summary');

  let totalSpeedup = 0;
  let speedupCount = 0;

  for (const [name, result] of Object.entries(results.benchmarks)) {
    if (result.typeScript && result.rust) {
      const speedup = result.typeScript.latency / result.rust.latency;
      totalSpeedup += speedup;
      speedupCount++;

      const improvement = ((1 - result.rust.latency / result.typeScript.latency) * 100).toFixed(0);
      console.log(`  ${name}:`);
      console.log(`    ${colorize('cyan', formatSpeedup(result.typeScript.latency, result.rust.latency))} (${colorize('green', improvement + '% faster')})`);
    }
  }

  if (speedupCount > 0) {
    const avgSpeedup = totalSpeedup / speedupCount;
    console.log(`\n  ${colorize('bright', 'Average Speedup:')} ${colorize('green', avgSpeedup.toFixed(2) + 'x')}`);
  }

  // Save results
  const resultsDir = path.join(__dirname, '..', 'benchmarks', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(
    resultsDir,
    `benchmark-${new Date().toISOString().split('T')[0]}.json`
  );
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n  ${colorize('cyan', 'Results saved to:')} ${resultsFile}`);

  printHeader('Benchmark Complete');
}

// Run benchmarks
runAllBenchmarks().catch((error) => {
  console.error(colorize('red', '\n✗ Benchmark failed:'), error);
  process.exit(1);
});
