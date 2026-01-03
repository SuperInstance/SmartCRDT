#!/usr/bin/env node

/**
 * Performance Report Generator
 *
 * Generates a formatted performance comparison report from benchmark results.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
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

function generateReport() {
  const resultsDir = path.join(__dirname, '..', 'benchmarks', 'results');

  // Find the latest benchmark result
  if (!fs.existsSync(resultsDir)) {
    console.error(colorize('yellow', 'No benchmark results found. Run benchmarks first: npm run bench'));
    process.exit(1);
  }

  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('benchmark-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error(colorize('yellow', 'No benchmark results found. Run benchmarks first: npm run bench'));
    process.exit(1);
  }

  const latestFile = files[0];
  const resultsPath = path.join(resultsDir, latestFile);
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Load template
  const templatePath = path.join(__dirname, '..', 'docs', 'PERFORMANCE_REPORT.md');
  let report;

  if (fs.existsSync(templatePath)) {
    report = fs.readFileSync(templatePath, 'utf-8');
  } else {
    report = generateDefaultReport();
  }

  // Replace placeholders
  const now = new Date();
  report = report.replace(/\{\{DATE\}\}/g, now.toISOString().split('T')[0]);
  report = report.replace(/\{\{TIMESTAMP\}\}/g, now.toISOString());
  report = report.replace(/\{\{PLATFORM\}\}/g, results.system.platform);
  report = report.replace(/\{\{NODE_VERSION\}\}/g, results.system.nodeVersion);
  report = report.replace(/\{\{CPU_COUNT\}\}/g, results.system.cpuCount);
  report = report.replace(/\{\{TOTAL_MEMORY\}\}/g, results.system.totalMemory);
  report = report.replace(/\{\{CPU_INFO\}\}/g, `${os.cpus()[0].model} @ ${os.cpus()[0].speed}MHz`);
  report = report.replace(/\{\{MEMORY_INFO\}\}/g, `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
  report = report.replace(/\{\{NEXT_RUN\}\}/g, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Generate benchmark tables
  let benchmarkTables = '';

  for (const [name, result] of Object.entries(results.benchmarks)) {
    if (result.typeScript && result.rust) {
      const speedup = result.typeScript.latency / result.rust.latency;
      const improvement = ((1 - result.rust.latency / result.typeScript.latency) * 100).toFixed(0);

      benchmarkTables += `
### ${name}

| Metric | TypeScript | Rust | Speedup |
|--------|-----------|------|---------|
| Latency | ${formatLatency(result.typeScript.latency)} | ${formatLatency(result.rust.latency)} | ${speedup.toFixed(2)}x |
| Throughput | ${formatNumber(result.typeScript.throughput)} ops/s | ${formatNumber(result.rust.throughput)} ops/s | - |
| Improvement | - | - | **${improvement}% faster** |

`;
    } else if (result.typeScript) {
      benchmarkTables += `
### ${name}

| Metric | TypeScript | Rust | Speedup |
|--------|-----------|------|---------|
| Latency | ${formatLatency(result.typeScript.latency)} | Not available | - |
| Throughput | ${formatNumber(result.typeScript.throughput)} ops/s | - | - |

`;
    }
  }

  // Replace benchmark tables section if it exists
  report = report.replace(
    /## Detailed Benchmarks[\s\S]*?(?=##|$)/,
    `## Detailed Benchmarks${benchmarkTables}`
  );

  // Write report
  const outputPath = path.join(__dirname, '..', 'docs', 'PERFORMANCE_REPORT.md');
  fs.writeFileSync(outputPath, report);

  console.log(colorize('green', '\n✓ Performance report generated successfully!'));
  console.log(colorize('cyan', `\n  Report saved to: ${outputPath}\n`));

  // Print summary
  console.log(colorize('bright', colorize('cyan', 'Performance Summary:')));
  console.log('');

  let totalSpeedup = 0;
  let speedupCount = 0;

  for (const [name, result] of Object.entries(results.benchmarks)) {
    if (result.typeScript && result.rust) {
      const speedup = result.typeScript.latency / result.rust.latency;
      totalSpeedup += speedup;
      speedupCount++;

      const improvement = ((1 - result.rust.latency / result.typeScript.latency) * 100).toFixed(0);
      console.log(`  ${name}:`);
      console.log(`    ${colorize('cyan', formatLatency(result.typeScript.latency))} → ${colorize('green', formatLatency(result.rust.latency))} (${colorize('bright', speedup.toFixed(2) + 'x')}, ${colorize('green', improvement + '% faster')})`);
    }
  }

  if (speedupCount > 0) {
    const avgSpeedup = totalSpeedup / speedupCount;
    console.log(`\n  ${colorize('bright', 'Average Speedup:')} ${colorize('green', avgSpeedup.toFixed(2) + 'x')}\n`);
  }
}

function generateDefaultReport() {
  return `# Performance Comparison Report

**Generated:** {{DATE}}
**Platform:** {{PLATFORM}}
**Node Version:** {{NODE_VERSION}}
**CPU Cores:** {{CPU_COUNT}}
**Total Memory:** {{TOTAL_MEMORY}}

---

## Executive Summary

This report compares the performance of TypeScript and Rust native modules.

{{BENCHMARK_TABLES}}

---

**Report Generated:** {{TIMESTAMP}}
**Next Benchmark Run:** {{NEXT_RUN}}
`;
}

// Run
generateReport().catch((error) => {
  console.error('Error generating report:', error);
  process.exit(1);
});
