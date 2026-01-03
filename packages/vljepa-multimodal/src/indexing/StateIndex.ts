/**
 * StateIndex - Basic state indexing
 *
 * Simple indexing structure for state lookups.
 */

import type { MultiModalState } from "../types.js";

/**
 * State index manager
 */
export class StateIndex {
  private index: Map<string, MultiModalState> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private authorIndex: Map<string, Set<string>> = new Map();
  private confidenceIndex: Map<number, Set<string>> = new Map(); // Bucket-based

  /**
   * Add state to index
   */
  add(state: MultiModalState): void {
    this.index.set(state.id, state);

    // Index tags
    for (const tag of state.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(state.id);
    }

    // Index author
    if (!this.authorIndex.has(state.metadata.author)) {
      this.authorIndex.set(state.metadata.author, new Set());
    }
    this.authorIndex.get(state.metadata.author)!.add(state.id);

    // Index confidence (bucket to 2 decimal places)
    const bucket = Math.floor(state.confidence * 100) / 100;
    if (!this.confidenceIndex.has(bucket)) {
      this.confidenceIndex.set(bucket, new Set());
    }
    this.confidenceIndex.get(bucket)!.add(state.id);
  }

  /**
   * Get state by ID
   */
  get(id: string): MultiModalState | undefined {
    return this.index.get(id);
  }

  /**
   * Get states by tag
   */
  getByTag(tag: string): MultiModalState[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.index.get(id))
      .filter((s): s is MultiModalState => s !== undefined);
  }

  /**
   * Get states by author
   */
  getByAuthor(author: string): MultiModalState[] {
    const ids = this.authorIndex.get(author);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.index.get(id))
      .filter((s): s is MultiModalState => s !== undefined);
  }

  /**
   * Get states by confidence range
   */
  getByConfidence(min: number, max: number): MultiModalState[] {
    const results: MultiModalState[] = [];

    for (const [bucket, ids] of this.confidenceIndex) {
      if (bucket >= min && bucket <= max) {
        for (const id of ids) {
          const state = this.index.get(id);
          if (state) {
            results.push(state);
          }
        }
      }
    }

    return results;
  }

  /**
   * Remove state from index
   */
  remove(id: string): boolean {
    const state = this.index.get(id);
    if (!state) {
      return false;
    }

    this.index.delete(id);

    // Remove from tag index
    for (const tag of state.metadata.tags) {
      const ids = this.tagIndex.get(tag);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Remove from author index
    const authorIds = this.authorIndex.get(state.metadata.author);
    if (authorIds) {
      authorIds.delete(id);
      if (authorIds.size === 0) {
        this.authorIndex.delete(state.metadata.author);
      }
    }

    // Remove from confidence index
    const bucket = Math.floor(state.confidence * 100) / 100;
    const confIds = this.confidenceIndex.get(bucket);
    if (confIds) {
      confIds.delete(id);
      if (confIds.size === 0) {
        this.confidenceIndex.delete(bucket);
      }
    }

    return true;
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.index.clear();
    this.tagIndex.clear();
    this.authorIndex.clear();
    this.confidenceIndex.clear();
  }

  /**
   * Get index size
   */
  size(): number {
    return this.index.size;
  }

  /**
   * Get all state IDs
   */
  getAllIds(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * Check if state exists
   */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalStates: number;
    totalTags: number;
    totalAuthors: number;
    confidenceBuckets: number;
  } {
    return {
      totalStates: this.index.size,
      totalTags: this.tagIndex.size,
      totalAuthors: this.authorIndex.size,
      confidenceBuckets: this.confidenceIndex.size,
    };
  }
}
