/**
 * MotivationEncoder - Emotional intelligence for empathetic AI routing
 *
 * Detects user's latent motivational state from their queries:
 * - Procrastination: "later", "eventually", topic switching
 * - Curiosity: Questions, new topics, follow-ups
 * - Social: Sharing, collaboration words
 * - Flow: Long detailed queries, consistent topic, continuous
 * - Anxiety: Urgency words, repetition, rapid fire
 *
 * This enables "Soulful Routing" - adapting to user's emotional state:
 * - High anxiety → Prefer faster, more certain routes
 * - High curiosity → Explore, allow cloud for broader knowledge
 * - High flow → Don't interrupt, use fastest route
 * - High procrastination → Suggest breakdown, offer help
 * - High social → Suggest collaboration features
 */
/**
 * User's motivational state (all values 0-1)
 */
export interface UserMotivation {
    /** User is delaying or avoiding (0-1) */
    procrastination: number;
    /** User is exploring/learning (0-1) */
    curiosity: number;
    /** User is seeking social interaction (0-1) */
    social: number;
    /** User is in focused flow state (0-1) */
    flow: number;
    /** User is anxious or urgent (0-1) */
    anxiety: number;
}
/**
 * Session context for motivation detection
 */
export interface MotivationSessionContext {
    /** Get recent queries */
    getRecentQueries(count: number): string[];
    /** Get recent topics */
    getRecentTopics(count: number): string[];
    /** Check if topic was seen before */
    hasSeenTopicBefore(query: string): boolean;
    /** Get topic consistency (0-1) */
    getTopicConsistency(count: number): number;
    /** Get average pause between queries (ms) */
    getAveragePauseMs(count: number): number;
    /** Check if this is a repeating query */
    isRepeatingQuery(query: string): boolean;
}
/**
 * Simple session context implementation
 */
export declare class SimpleSessionContext implements MotivationSessionContext {
    private queries;
    addQuery(query: string, timestamp: number, topic?: string): void;
    getRecentQueries(count: number): string[];
    getRecentTopics(count: number): string[];
    hasSeenTopicBefore(query: string): boolean;
    getTopicConsistency(count: number): number;
    getAveragePauseMs(count: number): number;
    isRepeatingQuery(query: string): boolean;
    private extractTopic;
    private getMostCommon;
}
/**
 * MotivationEncoder - Detect user's motivational state
 *
 * Example usage:
 * ```ts
 * const encoder = new MotivationEncoder();
 * const sessionContext = new SimpleSessionContext();
 * sessionContext.addQuery("How do I fix this bug?", Date.now());
 *
 * const motivation = encoder.encode(
 *   "What if I tried a different approach?",
 *   sessionContext
 * );
 *
 * if (motivation.curiosity > 0.7) {
 *   // User is exploring - allow broader search
 * }
 * ```
 */
export declare class MotivationEncoder {
    private procrastinationPhrases;
    private urgencyWords;
    private socialWords;
    private questionWords;
    /**
     * Encode user's motivational state from a query
     * @param text - The user's query
     * @param context - Session context for pattern detection
     * @returns UserMotivation with all dimensions (0-1 each)
     */
    encode(text: string, context: MotivationSessionContext): UserMotivation;
    /**
     * Detect procrastination signals
     */
    private detectProcrastination;
    /**
     * Detect curiosity signals
     */
    private detectCuriosity;
    /**
     * Detect social signals
     */
    private detectSocial;
    /**
     * Detect flow state signals
     */
    private detectFlow;
    /**
     * Detect anxiety signals
     */
    private detectAnxiety;
    /**
     * Extract simple topic from text (first few words)
     */
    private extractTopic;
    /**
     * Get the dominant motivation (highest score)
     */
    getDominantMotivation(motivation: UserMotivation): keyof UserMotivation;
    /**
     * Get a human-readable description of motivational state
     */
    describe(motivation: UserMotivation): string;
}
/**
 * Type for motivation detector function
 */
export type MotivationDetector = (text: string, context: MotivationSessionContext) => UserMotivation;
/**
 * Default export
 */
export default MotivationEncoder;
//# sourceMappingURL=MotivationEncoder.d.ts.map