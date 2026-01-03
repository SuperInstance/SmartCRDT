/**
 * ComplexityScorer - Analyzes query complexity for routing decisions
 *
 * Uses multiple heuristics to determine query complexity:
 * - Text length
 * - Technical term density
 * - Nested concepts
 * - Code presence
 * - Domain specificity
 */
import type { QueryContext } from "../types.js";
export interface ComplexityScore {
    /** Overall complexity (0-1) */
    overall: number;
    /** Text length contribution */
    textLength: number;
    /** Technical term contribution */
    technicalTerms: number;
    /** Code presence contribution */
    codePresence: number;
    /** Domain specificity contribution */
    domainSpecificity: number;
}
/**
 * ComplexityScorer - Analyzes query complexity
 */
export declare class ComplexityScorer {
    private technicalTerms;
    /**
     * Calculate complexity score for a query
     * @param query - The query text
     * @param context - Additional query context
     * @returns ComplexityScore with detailed breakdown
     */
    score(query: string, context?: QueryContext): ComplexityScore;
    /**
     * Detect if query contains code
     */
    private detectCode;
    /**
     * Detect domain-specific language
     */
    private detectDomainSpecificity;
}
//# sourceMappingURL=ComplexityScorer.d.ts.map