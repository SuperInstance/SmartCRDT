/**
 * TokenEstimator - Estimate token count for text without calling an API
 *
 * Uses heuristic-based estimation to approximate token counts for various
 * models. This avoids expensive API calls just for counting tokens.
 *
 * Estimation rules:
 * - English: ~1 token per 4 characters
 * - Code: ~1 token per 3.5 characters
 * - Words: ~0.75 tokens per word
 * - Chinese/Japanese: ~1 token per 1.5 characters
 *
 * Accuracy: ~90-95% compared to actual tokenizers
 */
/**
 * Token estimation result
 */
export interface TokenEstimate {
    /** Estimated input tokens */
    inputTokens: number;
    /** Estimated output tokens (if provided) */
    outputTokens?: number;
    /** Total tokens */
    totalTokens: number;
    /** Confidence in estimation (0-1) */
    confidence: number;
    /** Method used for estimation */
    method: "word" | "character" | "code" | "mixed";
}
/**
 * TokenEstimator class
 */
export declare class TokenEstimator {
    private readonly CHARS_PER_TOKEN_ENGLISH;
    private readonly CHARS_PER_TOKEN_CODE;
    private readonly CHARS_PER_TOKEN_CJK;
    private readonly WORDS_PER_TOKEN;
    /**
     * Estimate tokens for a text string
     */
    estimate(text: string): TokenEstimate;
    /**
     * Estimate tokens for input and output
     */
    estimateConversation(input: string, output?: string): TokenEstimate;
    /**
     * Estimate tokens from multiple messages (conversation history)
     */
    estimateMessages(messages: Array<{
        role: string;
        content: string;
    }>): TokenEstimate;
    /**
     * Detect the language/type of text
     */
    private detectLanguage;
    /**
     * Estimate tokens by language
     */
    private estimateByLanguage;
    /**
     * Get estimation method from language
     */
    private getEstimationMethod;
    /**
     * Estimate output tokens based on input (heuristic)
     */
    estimateOutputFromInput(inputTokens: number, queryComplexity?: number): number;
    /**
     * Calculate total tokens for a conversation with system prompt
     */
    estimateWithSystemPrompt(userMessage: string, systemPrompt: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>): TokenEstimate;
}
/**
 * Default singleton instance
 */
export declare const defaultTokenEstimator: TokenEstimator;
/**
 * Convenience function to estimate tokens
 */
export declare function estimateTokens(text: string): number;
/**
 * Convenience function to estimate conversation tokens
 */
export declare function estimateConversationTokens(input: string, output?: string): {
    input: number;
    output?: number;
    total: number;
};
//# sourceMappingURL=TokenEstimator.d.ts.map