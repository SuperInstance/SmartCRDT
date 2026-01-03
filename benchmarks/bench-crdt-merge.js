#!/usr/bin/env node

/**
 * CRDT Merge Operations Benchmark
 *
 * Compares TypeScript and Rust implementations of:
 * - G-Counter merge
 * - PN-Counter merge
 * - LWW Register merge
 */

const performance = require('perf_hooks').performance;

// TypeScript implementations
class GCounter {
  constructor() {
    this.counters = {};
  }

  increment(nodeId, amount = 1) {
    this.counters[nodeId] = (this.counters[nodeId] || 0) + amount;
  }

  value() {
    return Object.values(this.counters).reduce((sum, val) => sum + val, 0);
  }

  merge(other) {
    for (const [node, count] of Object.entries(other.counters)) {
      this.counters[node] = Math.max(this.counters[node] || 0, count);
    }
  }
}

class PNCounter {
  constructor() {
    this.p = new GCounter();
    this.n = new GCounter();
  }

  increment(nodeId, amount = 1) {
    this.p.increment(nodeId, amount);
  }

  decrement(nodeId, amount = 1) {
    this.n.increment(nodeId, amount);
  }

  value() {
    return this.p.value() - this.n.value();
  }

  merge(other) {
    this.p.merge(other.p);
    this.n.merge(other.n);
  }
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

// Run benchmarks
async function runBenchmarks() {
  const nodeCounts = [2, 5, 10, 50, 100];
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

  for (const nodeCount of nodeCounts) {
    console.log(`\n## Node Count: ${nodeCount}`);

    // Create counters with multiple nodes
    const counter1 = new GCounter();
    const counter2 = new GCounter();

    for (let i = 0; i < nodeCount; i++) {
      counter1.increment(`node${i}`, Math.floor(Math.random() * 100));
      counter2.increment(`node${i}`, Math.floor(Math.random() * 100));
    }

    // Benchmark TypeScript implementations
    console.log('### TypeScript');

    const tsMerge = benchmark('G-Counter Merge', () => {
      const c1 = new GCounter();
      Object.assign(c1.counters, { ...counter1.counters });
      const c2 = new GCounter();
      Object.assign(c2.counters, { ...counter2.counters });
      c1.merge(c2);
    });
    console.log(`  G-Counter Merge: ${tsMerge.latency.toFixed(2)}μs (${tsMerge.throughput.toFixed(0)} ops/s)`);

    const pnCounter1 = new PNCounter();
    const pnCounter2 = new PNCounter();
    for (let i = 0; i < nodeCount; i++) {
      pnCounter1.increment(`node${i}`, Math.floor(Math.random() * 50));
      pnCounter1.decrement(`node${i}`, Math.floor(Math.random() * 20));
      pnCounter2.increment(`node${i}`, Math.floor(Math.random() * 50));
      pnCounter2.decrement(`node${i}`, Math.floor(Math.random() * 20));
    }

    const tsPNMerge = benchmark('PN-Counter Merge', () => {
      const c1 = new PNCounter();
      c1.p.counters = { ...pnCounter1.p.counters };
      c1.n.counters = { ...pnCounter1.n.counters };
      const c2 = new PNCounter();
      c2.p.counters = { ...pnCounter2.p.counters };
      c2.n.counters = { ...pnCounter2.n.counters };
      c1.merge(c2);
    });
    console.log(`  PN-Counter Merge: ${tsPNMerge.latency.toFixed(2)}μs (${tsPNMerge.throughput.toFixed(0)} ops/s)`);

    results.typeScript[nodeCount] = {
      gCounterMerge: tsMerge,
      pnCounterMerge: tsPNMerge,
    };

    // Benchmark Rust implementations if available
    if (nativeModule) {
      console.log('### Rust');

      // Native implementation would go here
      // For now, just note that it's available
      console.log('  Rust CRDT benchmarks not fully implemented');
    }
  }

  // Calculate averages
  let totalTsLatency = 0;
  let count = 0;

  for (const nodeCount of nodeCounts) {
    if (results.typeScript[nodeCount] && results.typeScript[nodeCount].gCounterMerge) {
      totalTsLatency += results.typeScript[nodeCount].gCounterMerge.latency;
      count++;
    }
  }

  const avgTsLatency = totalTsLatency / count;

  // Output JSON for aggregation
  console.log('\n## Summary');
  const result = {
    typeScript: {
      latency: avgTsLatency,
      throughput: 1000000 / avgTsLatency,
    },
    rust: null, // Not implemented yet
  };

  console.log(JSON.stringify(result));
}

runBenchmarks().catch(console.error);
