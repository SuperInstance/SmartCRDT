/**
 * Query Data Generator
 *
 * Generates synthetic query-intent pairs from templates with variations
 * for training intent classification models.
 *
 * @package vljepa/data
 */
declare enum IntentCategory {
    QUERY = "query",
    COMMAND = "command",
    CONVERSATION = "conversation",
    CODE_GENERATION = "code_generation",
    ANALYSIS = "analysis",
    CREATIVE = "creative",
    DEBUGGING = "debugging",
    SYSTEM = "system",
    UNKNOWN = "unknown"
}
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
type IntentCategoryType = IntentCategory.QUERY | IntentCategory.COMMAND | IntentCategory.ANALYSIS | IntentCategory.CREATIVE | IntentCategory.CONVERSATION | IntentCategory.CODE_GENERATION | IntentCategory.DEBUGGING;
/**
 * Query Data Generator
 *
 * Generates synthetic queries from templates with balanced distribution
 * across intent categories, domains, and variations.
 */
export declare class QueryDataGenerator {
    private templates;
    private domains;
    private variations;
    private rng;
    /**
     * Initialize generator with templates and variation options
     */
    constructor(seed?: number);
    /**
     * Generate N queries with balanced distribution across intents
     *
     * @param n - Number of queries to generate
     * @param balanced - Whether to balance distribution across intents
     * @returns Array of generated queries
     */
    generate(n: number, balanced?: boolean): GeneratedQuery[];
    /**
     * Generate a single query from templates
     */
    private generateOne;
    /**
     * Apply variation style to query
     */
    private applyVariation;
    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    private shuffle;
    /**
     * Get random intent category
     */
    private randomIntent;
    /**
     * Seeded random number generator
     */
    private seededRandom;
    /**
     * Generate queries with specific intent distribution
     *
     * @param distribution - Map of intent to count
     * @returns Array of generated queries
     */
    generateWithDistribution(distribution: Partial<Record<IntentCategoryType, number>>): GeneratedQuery[];
    /**
     * Get statistics about available templates
     */
    getTemplateStats(): Record<string, number>;
}
export {};
//# sourceMappingURL=generator.d.ts.map