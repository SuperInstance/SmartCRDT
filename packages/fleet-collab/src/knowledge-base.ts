/**
 * @file knowledge-base.ts - CRDT-based shared knowledge base
 * @module @lsi/fleet-collab/knowledge-base
 *
 * Agents contribute findings that auto-merge via LWW per entry.
 * Supports categorization, tagging, confidence scoring, and search.
 */

import {
  KnowledgeEntry, AgentId,
  type CollabEvent, CollabEventType, type EventListener,
} from './types.js';
import { LWWMap } from './crdt-primitives.js';

export class KnowledgeBase {
  /** Key: knowledgeId, Value: LWWRegister<KnowledgeEntry> */
  private entries: LWWMap = new LWWMap();
  private listeners: Set<EventListener> = new Set();
  private replicaId: AgentId;

  constructor(replicaId: AgentId) {
    this.replicaId = replicaId;
  }

  /** Add a new knowledge entry */
  contribute(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): KnowledgeEntry {
    const id = `kb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const fullEntry: KnowledgeEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(id, fullEntry, this.replicaId);
    this.emit({
      type: CollabEventType.KNOWLEDGE_CONTRIBUTED,
      agentId: this.replicaId,
      timestamp: now,
      payload: { entry: fullEntry },
    });
    return fullEntry;
  }

  /** Update an existing knowledge entry (only creator can update) */
  update(id: string, updates: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'category' | 'tags' | 'confidence' | 'metadata'>>): KnowledgeEntry | null {
    const existing = this.getEntry(id);
    if (!existing) return null;
    if (existing.createdBy !== this.replicaId) return null;

    const now = Date.now();
    const updated: KnowledgeEntry = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
    this.entries.set(id, updated, this.replicaId);
    this.emit({
      type: CollabEventType.KNOWLEDGE_UPDATED,
      agentId: this.replicaId,
      timestamp: now,
      payload: { entry: updated },
    });
    return updated;
  }

  // ------------------------------------------------------------------
  // QUERIES
  // ------------------------------------------------------------------

  getEntry(id: string): KnowledgeEntry | null {
    const val = this.entries.get(id);
    if (val === undefined || val === null) return null;
    return val as KnowledgeEntry;
  }

  getAllEntries(): KnowledgeEntry[] {
    return this.entries.entries_list()
      .map(([, v]) => v as KnowledgeEntry)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getByCategory(category: string): KnowledgeEntry[] {
    return this.getAllEntries().filter(e => e.category === category);
  }

  getByTag(tag: string): KnowledgeEntry[] {
    return this.getAllEntries().filter(e => e.tags.includes(tag));
  }

  getByAgent(agentId: AgentId): KnowledgeEntry[] {
    return this.getAllEntries().filter(e => e.createdBy === agentId);
  }

  /** Simple text search across title and content */
  search(query: string): KnowledgeEntry[] {
    const lower = query.toLowerCase();
    return this.getAllEntries().filter(e =>
      e.title.toLowerCase().includes(lower) ||
      e.content.toLowerCase().includes(lower)
    );
  }

  /** Get entries with confidence >= threshold */
  getByConfidence(minConfidence: number): KnowledgeEntry[] {
    return this.getAllEntries().filter(e => e.confidence >= minConfidence);
  }

  /** Get all unique categories */
  getCategories(): string[] {
    const cats = new Set<string>();
    for (const e of this.getAllEntries()) cats.add(e.category);
    return Array.from(cats);
  }

  /** Get all unique tags */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const e of this.getAllEntries()) e.tags.forEach(t => tags.add(t));
    return Array.from(tags);
  }

  size(): number {
    return this.entries.size();
  }

  // ------------------------------------------------------------------
  // MERGE
  // ------------------------------------------------------------------

  merge(other: KnowledgeBase): number {
    this.entries.merge(other.entries);
    return this.entries.size();
  }

  exportState(): Record<string, unknown> {
    return this.entries.toJSON();
  }

  importState(data: Record<string, unknown>): void {
    this.entries = LWWMap.fromJSON(data as any);
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
