/**
 * @fileoverview Utility functions for Aequor LangChain integration
 */

import type { RouteDecision, RoutingMetadata } from "../llm/AequorLLM.js";

/**
 * Routing summary for display
 */
export interface RoutingSummary {
  route: string;
  confidence: string;
  latency: string;
  cost: string;
  cacheStatus: string;
  notes: string[];
}

/**
 * Format routing result for display
 *
 * @param result - Routing metadata
 * @returns Formatted summary
 */
export function formatRoutingResult(result: RoutingMetadata): RoutingSummary {
  return {
    route: result.route.toUpperCase(),
    confidence: `${(result.confidence * 100).toFixed(1)}%`,
    latency: `${result.estimatedLatency}ms`,
    cost: result.estimatedCost > 0 ? `$${result.estimatedCost.toFixed(4)}` : "FREE",
    cacheStatus: result.cacheHit ? `HIT (${(result.cacheSimilarity! * 100).toFixed(1)}%)` : "MISS",
    notes: result.notes || [],
  };
}

/**
 * Estimate token count for text
 *
 * Uses a simple heuristic: ~4 characters per token for English text.
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Simple heuristic: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate complexity score for text
 *
 * Considers length, sentence structure, and vocabulary complexity.
 *
 * @param text - Text to analyze
 * @returns Complexity score (0-1)
 */
export function calculateComplexity(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (words.length === 0) return 0;

  // Length complexity
  const lengthScore = Math.min(words.length / 100, 1);

  // Sentence complexity (average words per sentence)
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const structureScore = Math.min(avgWordsPerSentence / 25, 1);

  // Vocabulary complexity (average word length)
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const vocabScore = Math.min((avgWordLength - 3) / 5, 1); // Normalize around 3-8 chars

  // Combined score
  return (lengthScore * 0.4 + structureScore * 0.4 + vocabScore * 0.2);
}

/**
 * Format cache statistics for display
 *
 * @param stats - Cache statistics
 * @returns Formatted string
 */
export function formatCacheStats(stats: {
  size: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}): string {
  return [
    `Cache Size: ${stats.size} entries`,
    `Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`,
    `Total Hits: ${stats.totalHits}`,
    `Total Misses: ${stats.totalMisses}`,
  ].join("\n");
}

/**
 * Create a delay promise
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await delay(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}
