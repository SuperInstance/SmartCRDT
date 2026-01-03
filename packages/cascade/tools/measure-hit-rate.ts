/**
 * Measure Semantic Cache Hit Rate
 *
 * This tool measures the semantic cache hit rate with realistic workloads.
 * It simulates user queries across different categories and measures:
 * - Total hit rate
 * - Exact hit rate
 * - Semantic hit rate
 * - Per-query-type statistics
 *
 * Usage:
 * ```bash
 * ts-node packages/cascade/tools/measure-hit-rate.ts
 * ```
 *
 * Or programmatically:
 * ```ts
 * import { measureHitRate } from './tools/measure-hit-rate.js';
 * const results = await measureHitRate(cache, 1000);
 * console.log(results);
 * ```
 */

import { SemanticCache } from '../src/refiner/SemanticCache.js';
import type { RefinedQuery, QueryType } from '../src/types.js';

/**
 * Workload item for hit rate testing
 */
export interface WorkloadItem {
  /** The query text */
  query: string;
  /** Query category */
  category: string;
  /** Query type */
  queryType: QueryType;
  /** Variations for testing semantic similarity */
  variations?: string[];
}

/**
 * Hit rate measurement results
 */
export interface HitRateResults {
  /** Total hit rate (0-1) */
  hitRate: number;
  /** Exact match hit rate (0-1) */
  exactHitRate: number;
  /** Semantic similarity hit rate (0-1) */
  semanticHitRate: number;
  /** Cache statistics */
  stats: ReturnType<SemanticCache['getStats']>;
  /** Per-category hit rates */
  byCategory: Record<string, { hits: number; total: number; hitRate: number }>;
}

/**
 * Create a mock refined query for testing
 */
function createMockRefinedQuery(
  query: string,
  queryType: QueryType = 'question',
  embedding?: number[]
): RefinedQuery {
  // Generate a fake embedding if not provided
  // In production, this would come from an actual embedding model
  const mockEmbedding = embedding || Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

  return {
    original: query,
    normalized: query.toLowerCase().trim(),
    staticFeatures: {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      queryType,
      complexity: 0.5,
      hasCode: false,
      hasSQL: false,
      hasUrl: false,
      hasEmail: false,
      questionMark: query.includes('?'),
      exclamationCount: (query.match(/!/g) || []).length,
      ellipsisCount: (query.match(/\.\.\./g) || []).length,
      capitalizationRatio: (query.match(/[A-Z]/g) || []).length / query.length,
      punctuationDensity: (query.match(/[.,;:!]/g) || []).length / query.split(/\s+/).length,
      technicalTerms: [],
      domainKeywords: [],
    },
    semanticFeatures: {
      embedding: mockEmbedding,
      embeddingDim: mockEmbedding.length,
      similarQueries: [],
      cluster: null,
      semanticComplexity: 0.5,
    },
    cacheKey: `${queryType}:${query.toLowerCase().trim()}`,
    suggestions: [],
    timestamp: Date.now(),
  };
}

/**
 * Generate similar embedding for semantic similarity testing
 * Creates embeddings that are cosine-similar to a base embedding
 */
function generateSimilarEmbedding(baseEmbedding: number[], targetSimilarity: number): number[] {
  // Create a vector with the desired similarity
  const result = new Array(baseEmbedding.length);

  // Start with base embedding
  for (let i = 0; i < baseEmbedding.length; i++) {
    // Mix base embedding with random noise to achieve target similarity
    const noise = (Math.random() * 2 - 1) * (1 - targetSimilarity);
    result[i] = baseEmbedding[i] * targetSimilarity + noise;
  }

  return result;
}

/**
 * Realistic workload for hit rate testing
 *
 * Distribution:
 * - 30% Programming queries (with variations)
 * - 30% General knowledge queries
 * - 20% Creative requests
 * - 20% Debugging/help requests
 */
export const DEFAULT_WORKLOAD: WorkloadItem[] = [
  // Programming queries (30%)
  {
    query: 'What is JavaScript?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'Explain JavaScript programming language',
      'Tell me about JS',
      'What does JavaScript do?',
      'JavaScript basics',
    ],
  },
  {
    query: 'How do I write a for loop?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'For loop syntax',
      'Explain for loops',
      'How to use for loops',
      'Loop in programming',
    ],
  },
  {
    query: 'What is a closure?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'Explain closures in JavaScript',
      'What are closures?',
      'Closure programming concept',
    ],
  },
  {
    query: 'How do I parse JSON?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'JSON parsing methods',
      'Parse JSON in JavaScript',
      'Working with JSON data',
    ],
  },
  {
    query: 'What is async/await?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'Explain async await',
      'Asynchronous programming',
      'How does async/await work?',
    ],
  },
  {
    query: 'What is TypeScript?',
    category: 'programming',
    queryType: 'question',
    variations: [
      'TypeScript vs JavaScript',
      'Introduction to TypeScript',
      'What is TS?',
    ],
  },

  // General knowledge (30%)
  {
    query: 'What is the capital of France?',
    category: 'general',
    queryType: 'question',
    variations: [
      'France capital city',
      'Capital of France?',
      'What is the capital of France?',
    ],
  },
  {
    query: 'Who wrote Romeo and Juliet?',
    category: 'general',
    queryType: 'question',
    variations: [
      'Author of Romeo and Juliet',
      'Romeo and Juliet playwright',
      'Who wrote the play Romeo and Juliet?',
    ],
  },
  {
    query: 'What is the speed of light?',
    category: 'general',
    queryType: 'question',
    variations: [
      'Speed of light in m/s',
      'How fast is light?',
      'Light speed',
    ],
  },
  {
    query: 'When was World War II?',
    category: 'general',
    queryType: 'question',
    variations: [
      'World War 2 dates',
      'When did WWII happen?',
      'WWII timeline',
    ],
  },
  {
    query: 'What is photosynthesis?',
    category: 'general',
    queryType: 'question',
    variations: [
      'Explain photosynthesis',
      'How does photosynthesis work?',
      'Photosynthesis process',
    ],
  },
  {
    query: 'Who painted the Mona Lisa?',
    category: 'general',
    queryType: 'question',
    variations: [
      'Mona Lisa artist',
      'Who painted the Mona Lisa?',
      'Mona Lisa painter',
    ],
  },

  // Creative (20%)
  {
    query: 'Write a poem about AI',
    category: 'creative',
    queryType: 'command',
    variations: [
      'Create a poem about artificial intelligence',
      'Compose AI poetry',
      'Write poetry about machine learning',
    ],
  },
  {
    query: 'Tell me a story',
    category: 'creative',
    queryType: 'command',
    variations: [
      'Create a story',
      'Write a short story',
      'Tell me an interesting story',
    ],
  },
  {
    query: 'Write a function to sort an array',
    category: 'creative',
    queryType: 'command',
    variations: [
      'Create sorting function',
      'Implement array sort',
      'Write code for sorting',
    ],
  },
  {
    query: 'Generate a random password',
    category: 'creative',
    queryType: 'command',
    variations: [
      'Create random password',
      'Generate password',
      'Make a secure password',
    ],
  },

  // Debugging (20%)
  {
    query: 'Why is my code not working?',
    category: 'debugging',
    queryType: 'question',
    variations: [
      'Code not working help',
      'Debug my code',
      'Fix my code',
    ],
  },
  {
    query: 'What does this error mean?',
    category: 'debugging',
    queryType: 'question',
    variations: [
      'Error message explanation',
      'Help with error',
      'Understanding this error',
    ],
  },
  {
    query: 'How do I fix this bug?',
    category: 'debugging',
    queryType: 'question',
    variations: [
      'Bug fix help',
      'Solve this bug',
      'Debugging assistance',
    ],
  },
  {
    query: 'Why is my variable undefined?',
    category: 'debugging',
    queryType: 'question',
    variations: [
      'Undefined variable error',
      'Variable is undefined',
      'Fix undefined variable',
    ],
  },
];

/**
 * Measure cache hit rate with a given workload
 *
 * @param cache - The SemanticCache instance to test
 * @param workload - The workload items to test with
 * @param iterations - Number of iterations to run
 * @param variationChance - Chance (0-1) to use a variation instead of base query
 * @returns Hit rate measurement results
 */
export async function measureHitRate(
  cache: SemanticCache,
  workload: WorkloadItem[] = DEFAULT_WORKLOAD,
  iterations: number = 1000,
  variationChance: number = 0.3
): Promise<HitRateResults> {
  let hits = 0;
  let exactHits = 0;
  let semanticHits = 0;

  const categoryStats: Record<string, { hits: number; total: number }> = {};

  // First pass: populate cache with base queries
  console.log(`Populating cache with ${workload.length} base queries...`);
  for (const item of workload) {
    const refinedQuery = createMockRefinedQuery(item.query, item.queryType);
    await cache.set(refinedQuery, { category: item.category, answer: 'test answer' });
  }

  console.log(`Running ${iterations} iterations...`);

  // Second pass: measure hits with variations
  for (let i = 0; i < iterations; i++) {
    const item = workload[i % workload.length];

    // Initialize category stats
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { hits: 0, total: 0 };
    }
    categoryStats[item.category].total++;

    // Decide whether to use a variation
    let queryToTest = item.query;
    if (item.variations && item.variations.length > 0 && Math.random() < variationChance) {
      // Use a variation for semantic similarity testing
      const variationIndex = Math.floor(Math.random() * item.variations.length);
      queryToTest = item.variations[variationIndex];

      // Generate a similar embedding to simulate semantic similarity
      const baseQuery = createMockRefinedQuery(item.query, item.queryType);
      const similarEmbedding = generateSimilarEmbedding(
        baseQuery.semanticFeatures!.embedding,
        0.88 // Target similarity for variations
      );
      const refinedQuery = createMockRefinedQuery(queryToTest, item.queryType, similarEmbedding);

      const result = await cache.get(refinedQuery);

      if (result.found) {
        hits++;
        categoryStats[item.category].hits++;
        if ('similarity' in result) {
          if (result.similarity === 1.0) {
            exactHits++;
          } else {
            semanticHits++;
          }
        }
      }
    } else {
      // Use base query (should hit exactly)
      const refinedQuery = createMockRefinedQuery(queryToTest, item.queryType);
      const result = await cache.get(refinedQuery);

      if (result.found) {
        hits++;
        exactHits++;
        categoryStats[item.category].hits++;
      }
    }
  }

  const stats = cache.getStats();

  // Calculate per-category hit rates
  const byCategory: Record<string, { hits: number; total: number; hitRate: number }> = {};
  for (const [category, data] of Object.entries(categoryStats)) {
    byCategory[category] = {
      hits: data.hits,
      total: data.total,
      hitRate: data.total > 0 ? data.hits / data.total : 0,
    };
  }

  return {
    hitRate: hits / iterations,
    exactHitRate: exactHits / iterations,
    semanticHitRate: semanticHits / iterations,
    stats,
    byCategory,
  };
}

/**
 * Format hit rate results for display
 */
export function formatHitRateResults(results: HitRateResults): string {
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '           CACHE HIT RATE MEASUREMENT RESULTS',
    '═══════════════════════════════════════════════════════════',
    '',
    'Overall Performance:',
    `  Total Hit Rate:    ${(results.hitRate * 100).toFixed(1)}%`,
    `  Exact Hit Rate:    ${(results.exactHitRate * 100).toFixed(1)}%`,
    `  Semantic Hit Rate: ${(results.semanticHitRate * 100).toFixed(1)}%`,
    '',
    'Cache Statistics:',
    `  Cache Size:        ${results.stats.size}`,
    `  Total Requests:    ${results.stats.totalHits + results.stats.totalMisses}`,
    `  Total Hits:        ${results.stats.totalHits}`,
    `  Total Misses:      ${results.stats.totalMisses}`,
    '',
    'Per-Category Hit Rates:',
  ];

  for (const [category, data] of Object.entries(results.byCategory)) {
    lines.push(`  ${category.padEnd(15)} ${data.hits.toString().padStart(4)}/${data.total.toString().padEnd(4)}  ${(data.hitRate * 100).toFixed(1)}%`);
  }

  lines.push(
    '',
    'Per-Query-Type Statistics:',
    `  question:     ${results.stats.byQueryType.question.hits} hits, ${results.stats.byQueryType.question.misses} misses, ${(results.stats.byQueryType.question.hitRate * 100).toFixed(1)}% hit rate`,
    `  command:      ${results.stats.byQueryType.command.hits} hits, ${results.stats.byQueryType.command.misses} misses, ${(results.stats.byQueryType.command.hitRate * 100).toFixed(1)}% hit rate`,
    `  code:         ${results.stats.byQueryType.code.hits} hits, ${results.stats.byQueryType.code.misses} misses, ${(results.stats.byQueryType.code.hitRate * 100).toFixed(1)}% hit rate`,
    `  explanation:  ${results.stats.byQueryType.explanation.hits} hits, ${results.stats.byQueryType.explanation.misses} misses, ${(results.stats.byQueryType.explanation.hitRate * 100).toFixed(1)}% hit rate`,
    `  comparison:   ${results.stats.byQueryType.comparison.hits} hits, ${results.stats.byQueryType.comparison.misses} misses, ${(results.stats.byQueryType.comparison.hitRate * 100).toFixed(1)}% hit rate`,
    `  debug:        ${results.stats.byQueryType.debug.hits} hits, ${results.stats.byQueryType.debug.misses} misses, ${(results.stats.byQueryType.debug.hitRate * 100).toFixed(1)}% hit rate`,
    `  general:      ${results.stats.byQueryType.general.hits} hits, ${results.stats.byQueryType.general.misses} misses, ${(results.stats.byQueryType.general.hitRate * 100).toFixed(1)}% hit rate`,
    '',
    'Cache Configuration:',
    `  Current Threshold:        ${results.stats.currentThreshold.toFixed(3)}`,
    `  Threshold Adjustments:    ${results.stats.thresholdAdjustments}`,
    '',
    '═══════════════════════════════════════════════════════════'
  );

  return lines.join('\n');
}

/**
 * CLI entry point
 */
export async function main() {
  console.log('\n🚀 Starting Cache Hit Rate Measurement...\n');

  // Create cache with production configuration
  const cache = new SemanticCache({
    maxSize: 1000,
    ttl: 300000, // 5 minutes
    similarityThreshold: 0.85,
    enableAdaptiveThreshold: true,
    enableQueryTypeThresholds: true,
    queryTypeThresholds: {
      code: 0.92,
      debug: 0.88,
    },
  });

  // Measure hit rate
  const results = await measureHitRate(cache, DEFAULT_WORKLOAD, 1000, 0.3);

  // Display results
  console.log('\n' + formatHitRateResults(results));

  // Check if we meet the 80% target
  if (results.hitRate >= 0.80) {
    console.log('\n✅ SUCCESS: Cache hit rate meets 80% target!');
  } else {
    console.log(`\n⚠️  WARNING: Cache hit rate (${(results.hitRate * 100).toFixed(1)}%) is below 80% target`);
  }

  return results;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
