/**
 * @file metrics.ts - CRDT-based metrics aggregation across agents
 * @module @lsi/fleet-collab/metrics
 *
 * Uses G-Counter for monotonic metrics and PN-Counter for adjustable metrics.
 * Supports per-agent breakdown, tagging, and metric aggregation.
 */

import { AgentId } from './types.js';
import { GCounter, PNCounter } from './crdt-primitives.js';

export interface MetricSnapshot {
  name: string;
  total: number;
  positive: number;
  negative: number;
  perAgent: Record<string, number>;
  counterType: 'gcounter' | 'pncounter';
  lastUpdated: number;
}

export class MetricsAggregator {
  /** name -> GCounter (monotonic counters) */
  private gCounters: Map<string, GCounter> = new Map();
  /** name -> PNCounter (increment/decrement counters) */
  private pnCounters: Map<string, PNCounter> = new Map();
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  /** Increment a monotonic metric (tasks completed, messages sent, etc.) */
  increment(name: string, amount: number = 1): void {
    let counter = this.gCounters.get(name);
    if (!counter) {
      counter = new GCounter();
      this.gCounters.set(name, counter);
    }
    counter.increment(this.replicaId, amount);
  }

  /** Increment an adjustable metric */
  incrementPn(name: string, amount: number = 1): void {
    let counter = this.pnCounters.get(name);
    if (!counter) {
      counter = new PNCounter();
      this.pnCounters.set(name, counter);
    }
    counter.increment(this.replicaId, amount);
  }

  /** Decrement an adjustable metric (error count corrections, queue depth, etc.) */
  decrementPn(name: string, amount: number = 1): void {
    let counter = this.pnCounters.get(name);
    if (!counter) {
      counter = new PNCounter();
      this.pnCounters.set(name, counter);
    }
    counter.decrement(this.replicaId, amount);
  }

  /** Record an increment from another agent (for when forwarding) */
  recordIncrement(name: string, agentId: AgentId, amount: number = 1): void {
    let counter = this.gCounters.get(name);
    if (!counter) {
      counter = new GCounter();
      this.gCounters.set(name, counter);
    }
    counter.increment(agentId, amount);
  }

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  /** Get the value of a G-Counter metric */
  getGValue(name: string): number {
    return this.gCounters.get(name)?.value() || 0;
  }

  /** Get the value of a PN-Counter metric */
  getPnValue(name: string): number {
    return this.pnCounters.get(name)?.value() || 0;
  }

  /** Get per-agent breakdown for a G-Counter */
  getGPerAgent(name: string): Record<string, number> {
    const counter = this.gCounters.get(name);
    if (!counter) return {};
    const result: Record<string, number> = {};
    for (const node of counter.getNodes()) {
      result[node] = counter.getNodeCount(node);
    }
    return result;
  }

  /** Get positive/negative breakdown for a PN-Counter */
  getPnBreakdown(name: string): { positive: number; negative: number; net: number } {
    const counter = this.pnCounters.get(name);
    if (!counter) return { positive: 0, negative: 0, net: 0 };
    return {
      positive: counter.positiveValue(),
      negative: counter.negativeValue(),
      net: counter.value(),
    };
  }

  /** List all metric names */
  getMetricNames(): string[] {
    return [
      ...Array.from(this.gCounters.keys()).map(n => `g:${n}`),
      ...Array.from(this.pnCounters.keys()).map(n => `pn:${n}`),
    ];
  }

  /** Get snapshot of all metrics */
  getAllSnapshots(): Record<string, MetricSnapshot> {
    const result: Record<string, MetricSnapshot> = {};
    for (const [name, counter] of this.gCounters) {
      result[`g:${name}`] = {
        name,
        total: counter.value(),
        positive: counter.value(),
        negative: 0,
        perAgent: this.getGPerAgent(name),
        counterType: 'gcounter',
        lastUpdated: Date.now(),
      };
    }
    for (const [name, counter] of this.pnCounters) {
      result[`pn:${name}`] = {
        name,
        total: counter.value(),
        positive: counter.positiveValue(),
        negative: counter.negativeValue(),
        perAgent: {},
        counterType: 'pncounter',
        lastUpdated: Date.now(),
      };
    }
    return result;
  }

  // ------------------------------------------------------------------
  // MERGE
  // ------------------------------------------------------------------

  /** Merge metrics from another aggregator */
  merge(other: MetricsAggregator): void {
    for (const [name, counter] of other.gCounters) {
      let mine = this.gCounters.get(name);
      if (!mine) {
        mine = new GCounter();
        this.gCounters.set(name, mine);
      }
      mine.merge(counter);
    }
    for (const [name, counter] of other.pnCounters) {
      let mine = this.pnCounters.get(name);
      if (!mine) {
        mine = new PNCounter();
        this.pnCounters.set(name, mine);
      }
      mine.merge(counter);
    }
  }

  /** Export all state */
  exportState(): { gCounters: Record<string, unknown>; pnCounters: Record<string, unknown> } {
    const gc: Record<string, unknown> = {};
    for (const [k, v] of this.gCounters) gc[k] = v.toJSON();
    const pn: Record<string, unknown> = {};
    for (const [k, v] of this.pnCounters) pn[k] = v.toJSON();
    return { gCounters: gc, pnCounters: pn };
  }

  /** Import state */
  importState(data: { gCounters: Record<string, unknown>; pnCounters: Record<string, unknown> }): void {
    this.gCounters = new Map();
    for (const [k, v] of Object.entries(data.gCounters)) {
      this.gCounters.set(k, GCounter.fromJSON(v as Record<string, number>));
    }
    this.pnCounters = new Map();
    for (const [k, v] of Object.entries(data.pnCounters)) {
      this.pnCounters.set(k, PNCounter.fromJSON(v as { p: Record<string, number>; n: Record<string, number> }));
    }
  }
}
