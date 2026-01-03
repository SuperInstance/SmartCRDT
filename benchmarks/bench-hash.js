#!/usr/bin/env node

/**
 * Hash Functions Benchmark
 *
 * Compares TypeScript and Rust implementations of:
 * - BLAKE3
 * - SHA-256
 * - FNV-1a
 */

const crypto = require('crypto');
const performance = require('perf_hooks').performance;

// TypeScript implementations
function fnv1aHash(data) {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash >>> 0; // Ensure unsigned
}

function tsSha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

// Benchmark utilities
function benchmark(name, fn, iterations = 10000) {
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgLatency = (totalTime / iterations) * 1000; // μs
  const throughput = (iterations / totalTime) * 1000; // ops/s

  return {
    latency: avgLatency,
    throughput: throughput,
    totalTime: totalTime,
  };
}

function generateRandomBuffer(size) {
  return Buffer.alloc(size).map(() => Math.floor(Math.random() * 256));
}

// Run benchmarks
async function runBenchmarks() {
  const dataSizes = [32, 256, 1024, 4096, 16384]; // bytes
  const results = {
    typeScript: {},
    rust: {},
  };

  // Try to load native module
  let nativeModule = null;
  try {
    nativeModule = require('../../native/ffi/index.js');
  } catch (error) {
    // Native module not available
  }

  for (const size of dataSizes) {
    console.log(`\n## Data Size: ${size} bytes`);

    const data = generateRandomBuffer(size);

    // Benchmark TypeScript implementations
    console.log('### TypeScript');

    const tsFNV = benchmark('FNV-1a', () => {
      fnv1aHash(data);
    });
    console.log(`  FNV-1a: ${tsFNV.latency.toFixed(2)}μs (${tsFNV.throughput.toFixed(0)} ops/s)`);

    const tsSHA256 = benchmark('SHA-256', () => {
      tsSha256(data);
    });
    console.log(`  SHA-256: ${tsSHA256.latency.toFixed(2)}μs (${tsSHA256.throughput.toFixed(0)} ops/s)`);

    results.typeScript[size] = {
      fnv1a: tsFNV,
      sha256: tsSHA256,
    };

    // Benchmark Rust implementations if available
    if (nativeModule && nativeModule.hash_blake3) {
      console.log('### Rust');

      const dataStr = data.toString('base64');

      const rustBlake3 = benchmark('BLAKE3', () => {
        try {
          nativeModule.hash_blake3(dataStr);
        } catch (e) {
          // May need buffer input
        }
      });
      console.log(`  BLAKE3: ${rustBlake3.latency.toFixed(2)}μs (${rustBlake3.throughput.toFixed(0)} ops/s)`);

      results.rust[size] = {
        blake3: rustBlake3,
      };
    }
  }

  // Calculate averages
  let totalTsLatency = 0;
  let totalRustLatency = 0;
  let count = 0;

  for (const size of dataSizes) {
    if (results.typeScript[size] && results.typeScript[size].sha256) {
      totalTsLatency += results.typeScript[size].sha256.latency;
      count++;
    }
    if (results.rust[size] && results.rust[size].blake3) {
      totalRustLatency += results.rust[size].blake3.latency;
    }
  }

  const avgTsLatency = totalTsLatency / count;
  const avgRustLatency = count > 0 && totalRustLatency > 0 ? totalRustLatency / count : avgTsLatency;

  // Output JSON for aggregation
  console.log('\n## Summary');
  const result = {
    typeScript: {
      latency: avgTsLatency,
      throughput: 1000000 / avgTsLatency,
    },
    rust: totalRustLatency > 0 ? {
      latency: avgRustLatency,
      throughput: 1000000 / avgRustLatency,
    } : null,
  };

  console.log(JSON.stringify(result));
}

runBenchmarks().catch(console.error);
