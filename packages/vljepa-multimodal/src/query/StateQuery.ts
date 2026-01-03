/**
 * StateQuery - Direct state querying
 *
 * Query states by exact field matching and filtering.
 */

import type {
  QueryConfig,
  Match,
  MultiModalState,
  ModalityType,
} from "../types.js";

/**
 * State query manager
 */
export class StateQuery {
  /**
   * Query by text content
   */
  queryByText(
    states: MultiModalState[],
    query: string,
    config: QueryConfig
  ): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      // Check text input
      const textSimilarity = this.textSimilarity(query, state.text.input);

      // Check intent
      const intentSimilarity = this.textSimilarity(query, state.text.intent);

      // Use best match
      const similarity = Math.max(textSimilarity, intentSimilarity);

      if (similarity >= config.threshold) {
        matches.push({
          state,
          similarity,
          modality: "text",
          highlights: this.extractHighlights(query, state.text.input),
        });
      }
    }

    return matches.slice(0, config.limit);
  }

  /**
   * Query by confidence range
   */
  queryByConfidence(
    states: MultiModalState[],
    minConfidence: number,
    maxConfidence: number
  ): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      if (
        state.confidence >= minConfidence &&
        state.confidence <= maxConfidence
      ) {
        matches.push({
          state,
          similarity: state.confidence,
          modality: "embedding",
        });
      }
    }

    return matches;
  }

  /**
   * Query by tags
   */
  queryByTags(states: MultiModalState[], tags: string[]): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      const stateTags = new Set(state.metadata.tags);
      let matchCount = 0;

      for (const tag of tags) {
        if (stateTags.has(tag)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        matches.push({
          state,
          similarity: matchCount / tags.length,
          modality: "text",
        });
      }
    }

    return matches;
  }

  /**
   * Query by version
   */
  queryByVersion(states: MultiModalState[], version: number): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      if (state.version === version) {
        matches.push({
          state,
          similarity: 1,
          modality: "text",
        });
      }
    }

    return matches;
  }

  /**
   * Query by date range
   */
  queryByDateRange(
    states: MultiModalState[],
    startDate: number,
    endDate: number
  ): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      if (state.timestamp >= startDate && state.timestamp <= endDate) {
        matches.push({
          state,
          similarity: 1,
          modality: "text",
        });
      }
    }

    return matches;
  }

  /**
   * Query by author
   */
  queryByAuthor(states: MultiModalState[], author: string): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      if (state.metadata.author === author) {
        matches.push({
          state,
          similarity: 1,
          modality: "text",
        });
      }
    }

    return matches;
  }

  /**
   * Filter states by predicate
   */
  filter(
    states: MultiModalState[],
    predicate: (state: MultiModalState) => boolean
  ): Match[] {
    const matches: Match[] = [];

    for (const state of states) {
      if (predicate(state)) {
        matches.push({
          state,
          similarity: 1,
          modality: "text",
        });
      }
    }

    return matches;
  }

  /**
   * Calculate text similarity
   */
  private textSimilarity(query: string, text: string): number {
    if (!query || !text) {
      return 0;
    }

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) {
      return 1;
    }

    // Contains match
    if (textLower.includes(queryLower)) {
      return 0.8;
    }

    // Word overlap
    const queryWords = new Set(queryLower.split(/\s+/));
    const textWords = new Set(textLower.split(/\s+/));

    let overlap = 0;
    for (const word of queryWords) {
      if (textWords.has(word)) {
        overlap++;
      }
    }

    return queryWords.size > 0 ? overlap / queryWords.size : 0;
  }

  /**
   * Extract highlights from text
   */
  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    let index = 0;
    while ((index = textLower.indexOf(queryLower, index)) >= 0) {
      const start = Math.max(0, index - 30);
      const end = Math.min(text.length, index + query.length + 30);
      let highlight = text.substring(start, end);

      if (start > 0) highlight = "..." + highlight;
      if (end < text.length) highlight = highlight + "...";

      highlights.push(highlight);
      index += query.length;
    }

    return highlights;
  }
}
