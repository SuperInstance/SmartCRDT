/**
 * @file config-registry.ts - CRDT-based configuration registry using LWW-Register
 * @module @lsi/fleet-collab/config-registry
 *
 * Fleet-wide configuration values stored in a LWW-Map so all replicas converge.
 */

import { AgentId, type CollabEvent, CollabEventType, type EventListener } from './types.js';
import { LWWMap } from './crdt-primitives.js';

export class ConfigRegistry {
  private config: LWWMap = new LWWMap();
  private listeners: Set<EventListener> = new Set();
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  /** Set a configuration value */
  set(key: string, value: unknown): void {
    const prev = this.config.get(key);
    this.config.set(key, value, this.replicaId);
    this.emit({
      type: CollabEventType.CONFIG_UPDATED,
      agentId: this.replicaId,
      timestamp: Date.now(),
      payload: { key, value, previousValue: prev },
    });
  }

  /** Get a configuration value */
  get(key: string): unknown {
    return this.config.get(key);
  }

  /** Get with a default fallback */
  getWithDefault<T>(key: string, defaultValue: T): T {
    const val = this.config.get(key);
    return (val !== undefined && val !== null) ? (val as T) : defaultValue;
  }

  /** Get as string */
  getString(key: string, defaultValue: string = ''): string {
    return String(this.getWithDefault(key, defaultValue));
  }

  /** Get as number */
  getNumber(key: string, defaultValue: number = 0): number {
    const val = this.get(key);
    if (typeof val === 'number') return val;
    const parsed = Number(val);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /** Get as boolean */
  getBoolean(key: string, defaultValue: boolean = false): boolean {
    const val = this.get(key);
    if (typeof val === 'boolean') return val;
    return defaultValue;
  }

  /** Check if a key exists */
  has(key: string): boolean {
    return this.config.has(key);
  }

  /** Delete a configuration key */
  delete(key: string): void {
    this.config.delete(key, this.replicaId);
  }

  /** Get all configuration key-value pairs */
  getAll(): Array<[string, unknown]> {
    return this.config.entries_list();
  }

  /** Get all configuration as a plain object */
  toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of this.config.entries_list()) {
      obj[k] = v;
    }
    return obj;
  }

  /** Get all keys */
  keys(): string[] {
    return this.config.keys();
  }

  /** Number of config entries */
  size(): number {
    return this.config.size();
  }

  // ------------------------------------------------------------------
  // MERGE
  // ------------------------------------------------------------------

  merge(other: ConfigRegistry): void {
    this.config.merge(other.config);
  }

  exportState(): Record<string, unknown> {
    return this.config.toJSON();
  }

  importState(data: Record<string, unknown>): void {
    this.config = LWWMap.fromJSON(data as any);
  }

  // ------------------------------------------------------------------
  // EVENTS
  // ------------------------------------------------------------------

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: CollabEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch (_) { /* swallow */ }
    }
  }
}
