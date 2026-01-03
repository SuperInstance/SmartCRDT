/**
 * Query Data Generator
 *
 * Generates synthetic query-intent pairs from templates with variations
 * for training intent classification models.
 *
 * @package vljepa/data
 */

// Local IntentCategory enum to avoid module resolution issues
// TODO: Use @lsi/protocol import when package is properly set up
enum IntentCategory {
  QUERY = "query",
  COMMAND = "command",
  CONVERSATION = "conversation",
  CODE_GENERATION = "code_generation",
  ANALYSIS = "analysis",
  CREATIVE = "creative",
  DEBUGGING = "debugging",
  SYSTEM = "system",
  UNKNOWN = "unknown",
}

import {
  ALL_TEMPLATES,
  QueryTemplate,
  QUERY_TEMPLATES,
  COMMAND_TEMPLATES,
  ANALYSIS_TEMPLATES,
  CREATIVE_TEMPLATES,
  CONVERSATION_TEMPLATES,
  REASONING_TEMPLATES,
  DEBUGGING_TEMPLATES,
  LEARNING_TEMPLATES,
  OPTIMIZATION_TEMPLATES,
} from "./templates";

/**
 * Generated query with metadata
 */
export interface GeneratedQuery {
  /** The generated query text */
  query: string;
  /** Intent category */
  intent: IntentCategory;
  /** Metadata about the generation */
  metadata: {
    /** Template used */
    template: string;
    /** Difficulty level */
    difficulty: string;
    /** Domain category */
    domain: string;
    /** Variation style */
    variation: string;
  };
}

/**
 * Type for intent categories used in generation
 */
type IntentCategoryType =
  | IntentCategory.QUERY
  | IntentCategory.COMMAND
  | IntentCategory.ANALYSIS
  | IntentCategory.CREATIVE
  | IntentCategory.CONVERSATION
  | IntentCategory.CODE_GENERATION
  | IntentCategory.DEBUGGING;

/**
 * Query Data Generator
 *
 * Generates synthetic queries from templates with balanced distribution
 * across intent categories, domains, and variations.
 */
export class QueryDataGenerator {
  private templates: Map<IntentCategoryType, QueryTemplate[]>;
  private domains: string[];
  private variations: string[];
  private rng: () => number;

  /**
   * Initialize generator with templates and variation options
   */
  constructor(seed?: number) {
    // Initialize random number generator with optional seed
    this.rng = seed ? this.seededRandom(seed) : Math.random;

    // Map intent categories to their templates
    this.templates = new Map<IntentCategoryType, QueryTemplate[]>([
      [IntentCategory.QUERY, QUERY_TEMPLATES],
      [IntentCategory.COMMAND, COMMAND_TEMPLATES],
      [IntentCategory.ANALYSIS, ANALYSIS_TEMPLATES],
      [IntentCategory.CREATIVE, CREATIVE_TEMPLATES],
      [IntentCategory.CONVERSATION, CONVERSATION_TEMPLATES],
      [IntentCategory.CODE_GENERATION, REASONING_TEMPLATES],
      [IntentCategory.DEBUGGING, DEBUGGING_TEMPLATES],
      [IntentCategory.ANALYSIS, LEARNING_TEMPLATES], // Maps to ANALYSIS
      [IntentCategory.ANALYSIS, OPTIMIZATION_TEMPLATES], // Maps to ANALYSIS
    ]);

    // Domain categories for metadata
    this.domains = [
      "web-development",
      "mobile-development",
      "data-science",
      "devops",
      "machine-learning",
      "blockchain",
      "gamedev",
      "embedded-systems",
      "cloud",
      "security",
      "database",
      "api-design",
      "system-design",
      "frontend",
      "backend",
      "fullstack",
      "testing",
      "monitoring",
      "performance",
      "architecture",
    ];

    // Variation styles for query phrasing
    this.variations = [
      "standard",
      "casual",
      "formal",
      "urgent",
      "confused",
      "curious",
      "frustrated",
      "detailed",
      "concise",
      "technical",
      "beginner-friendly",
      "expert",
    ];
  }

  /**
   * Generate N queries with balanced distribution across intents
   *
   * @param n - Number of queries to generate
   * @param balanced - Whether to balance distribution across intents
   * @returns Array of generated queries
   */
  generate(n: number, balanced: boolean = true): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];

    if (balanced) {
      // Balance across 7 main intent categories
      const intents: IntentCategoryType[] = [
        IntentCategory.QUERY,
        IntentCategory.COMMAND,
        IntentCategory.ANALYSIS,
        IntentCategory.CREATIVE,
        IntentCategory.CONVERSATION,
        IntentCategory.CODE_GENERATION,
        IntentCategory.DEBUGGING,
      ];

      const perIntent = Math.floor(n / intents.length);

      for (const intent of intents) {
        const templates = this.templates.get(intent);
        if (!templates || templates.length === 0) {
          console.warn(`No templates found for intent: ${intent}`);
          continue;
        }

        for (let i = 0; i < perIntent; i++) {
          const query = this.generateOne(intent, templates);
          queries.push(query);
        }
      }

      // Fill remainder with random intents
      while (queries.length < n) {
        const randomIntent = this.randomIntent();
        const templates = this.templates.get(randomIntent);
        if (templates && templates.length > 0) {
          queries.push(this.generateOne(randomIntent, templates));
        }
      }
    } else {
      // Unbiased random generation
      for (let i = 0; i < n; i++) {
        const randomIntent = this.randomIntent();
        const templates = this.templates.get(randomIntent);
        if (templates && templates.length > 0) {
          queries.push(this.generateOne(randomIntent, templates));
        }
      }
    }

    return this.shuffle(queries);
  }

  /**
   * Generate a single query from templates
   */
  private generateOne(
    intent: IntentCategoryType,
    templates: QueryTemplate[]
  ): GeneratedQuery {
    const template = templates[Math.floor(this.rng() * templates.length)];
    const domain = this.domains[Math.floor(this.rng() * this.domains.length)];
    const variation =
      this.variations[Math.floor(this.rng() * this.variations.length)];

    // Fill slots with random values
    let query = template.template;

    for (const [slot, values] of Object.entries(template.slots)) {
      const value = values[Math.floor(this.rng() * values.length)];
      query = query.replace(`{${slot}}`, value);
    }

    // Apply variation style
    query = this.applyVariation(query, variation);

    return {
      query,
      intent,
      metadata: {
        template: template.template,
        difficulty: template.difficulty,
        domain,
        variation,
      },
    };
  }

  /**
   * Apply variation style to query
   */
  private applyVariation(query: string, variation: string): string {
    const variations: Record<string, string> = {
      standard: query,
      casual: `hey, ${query.charAt(0).toLowerCase() + query.slice(1)}`,
      formal: `I would like to know: ${query}`,
      urgent: `${query} - this is urgent!`,
      confused: `I'm not sure, but ${query.charAt(0).toLowerCase() + query.slice(1)}`,
      curious: `Just wondering, ${query.charAt(0).toLowerCase() + query.slice(1)}?`,
      frustrated: `Ugh, ${query.charAt(0).toLowerCase() + query.slice(1)}???`,
      detailed: `${query}. Can you explain in detail with examples?`,
      concise: query.replace(/\s+/g, " ").trim(),
      technical: `${query} (technical details please)`,
      "beginner-friendly": `${query} - please explain for a beginner`,
      expert: `${query} (advanced/expert level)`,
    };

    return variations[variation] || query;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get random intent category
   */
  private randomIntent(): IntentCategoryType {
    const intents: IntentCategoryType[] = [
      IntentCategory.QUERY,
      IntentCategory.COMMAND,
      IntentCategory.ANALYSIS,
      IntentCategory.CREATIVE,
      IntentCategory.CONVERSATION,
      IntentCategory.CODE_GENERATION,
      IntentCategory.DEBUGGING,
    ];
    return intents[Math.floor(this.rng() * intents.length)];
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Generate queries with specific intent distribution
   *
   * @param distribution - Map of intent to count
   * @returns Array of generated queries
   */
  generateWithDistribution(
    distribution: Partial<Record<IntentCategoryType, number>>
  ): GeneratedQuery[] {
    const queries: GeneratedQuery[] = [];

    for (const [intent, count] of Object.entries(distribution)) {
      const templates = this.templates.get(intent as IntentCategoryType);
      if (!templates || templates.length === 0) {
        console.warn(`No templates found for intent: ${intent}`);
        continue;
      }

      for (let i = 0; i < count!; i++) {
        queries.push(this.generateOne(intent as IntentCategoryType, templates));
      }
    }

    return this.shuffle(queries);
  }

  /**
   * Get statistics about available templates
   */
  getTemplateStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [intent, templates] of this.templates) {
      stats[intent] = templates.length;
    }

    return stats;
  }
}
