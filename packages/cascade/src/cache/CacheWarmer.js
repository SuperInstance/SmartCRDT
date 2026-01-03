/**
 * Cache Warmer - Pre-populate cache with common queries
 *
 * Cache warming improves cold-start performance by pre-loading
 * the cache with expected common queries. This reduces initial
 * cache misses and improves perceived performance.
 *
 * Features:
 * - Batch processing with configurable sizes
 * - Delay between batches to avoid overwhelming the system
 * - Error handling and reporting
 * - Default common query sets by category
 *
 * Example:
 * ```ts
 * const warmer = new CacheWarmer(router, {
 *   commonQueries: CacheWarmer.getDefaultCommonQueries(),
 *   batchSize: 10,
 *   delayBetweenBatches: 100,
 * });
 * const result = await warmer.warm();
 * console.log(`Warmed ${result.successful} queries in ${result.duration}ms`);
 * ```
 */
/**
 * CacheWarmer - Pre-populate cache with common queries
 */
export class CacheWarmer {
    router;
    config;
    constructor(router, config) {
        this.router = router;
        this.config = {
            batchSize: config.batchSize ?? 10,
            delayBetweenBatches: config.delayBetweenBatches ?? 100,
            commonQueries: config.commonQueries,
            context: config.context ?? {
                timestamp: Date.now(),
                sessionId: "warmup",
                query: "",
            },
        };
    }
    /**
     * Warm cache with common queries
     *
     * Processes queries in batches with delays between batches
     * to avoid overwhelming the system. Returns statistics
     * about the warming process.
     *
     * @returns Cache warming statistics
     */
    async warm() {
        const startTime = Date.now();
        let successful = 0;
        let failed = 0;
        const failedQueries = [];
        const queries = this.config.commonQueries;
        const batchSize = this.config.batchSize;
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            const results = await Promise.allSettled(batch.map(async (query) => {
                try {
                    // Route the query (this will cache it automatically with routeWithCache)
                    const decision = await this.router.route(query, this.config.context);
                    // Explicitly cache if not already cached
                    if (!decision.notes?.includes("Cache hit")) {
                        await this.router.cacheResult?.((await this.router
                            .getSessionContext()
                            ?.getRecentQueries(1)[0]), decision);
                    }
                    return { success: true };
                }
                catch (error) {
                    return {
                        success: false,
                        query,
                        error: error instanceof Error ? error.message : String(error),
                    };
                }
            }));
            // Process results
            for (const result of results) {
                if (result.status === "fulfilled") {
                    if (result.value.success) {
                        successful++;
                    }
                    else {
                        failed++;
                        failedQueries.push({
                            query: result.value.query ?? "unknown",
                            error: result.value.error ?? "Unknown error",
                        });
                    }
                }
                else {
                    failed++;
                    failedQueries.push({
                        query: "unknown",
                        error: result.reason?.message || "Unknown error",
                    });
                }
            }
            // Delay between batches (except after the last batch)
            if (i + batchSize < queries.length) {
                await this.delay(this.config.delayBetweenBatches);
            }
        }
        const duration = Date.now() - startTime;
        console.log(`[CacheWarmer] Warming complete: ${successful} successful, ${failed} failed, ${duration}ms`);
        return { successful, failed, duration, failedQueries };
    }
    /**
     * Warm cache progressively in background
     *
     * Starts warming without blocking. Useful for startup initialization.
     * Returns a promise that resolves when warming is complete.
     *
     * @returns Promise that resolves when warming is complete
     */
    async warmInBackground() {
        console.log("[CacheWarmer] Starting background cache warming...");
        // Don't await - let it run in background
        return this.warm();
    }
    /**
     * Get default common queries for warming
     *
     * Returns a curated list of common queries across different
     * categories: programming, general knowledge, how-to questions,
     * and debugging scenarios.
     *
     * @returns Default common queries array
     */
    static getDefaultCommonQueries() {
        return [
            // ========== Programming (20%) ==========
            "What is JavaScript?",
            "How do I write a for loop in Python?",
            "Explain recursion",
            "What is a closure in JavaScript?",
            "How do I parse JSON in Python?",
            "What is the difference between let and const?",
            "How do I create a class in Java?",
            "What is async/await?",
            "Explain map, filter, and reduce",
            "How do I handle errors in JavaScript?",
            "What is a Promise in JavaScript?",
            "How do I make an HTTP request in Python?",
            "What is TypeScript?",
            "Explain object-oriented programming",
            "How do I debug code?",
            // ========== General Knowledge (30%) ==========
            "What is the capital of France?",
            "Who wrote Romeo and Juliet?",
            "What is the speed of light?",
            "When was World War II?",
            "What is the largest ocean?",
            "Who painted the Mona Lisa?",
            "What is photosynthesis?",
            "What is the boiling point of water?",
            "Who was the first person on the moon?",
            "What is the currency of Japan?",
            "What is the tallest mountain?",
            "Who discovered America?",
            "What is the population of China?",
            "What is the square root of 64?",
            "What is the chemical symbol for gold?",
            // ========== How-To Questions (25%) ==========
            "How do I bake a cake?",
            "How do I change a tire?",
            "How do I tie a tie?",
            "How do I write a resume?",
            "How do I create a website?",
            "How do I lose weight?",
            "How do I learn a new language?",
            "How do I take a screenshot?",
            "How do I reset my password?",
            "How do I backup my computer?",
            "How do I meditate?",
            "How do I invest in stocks?",
            "How do I write a cover letter?",
            "How do I clean my computer?",
            "How do I make coffee?",
            // ========== Debugging (15%) ==========
            "Why is my code not working?",
            "How do I fix a syntax error?",
            "What does null pointer exception mean?",
            "Why is my program slow?",
            "How do I fix a memory leak?",
            "What is a segmentation fault?",
            "Why is my loop infinite?",
            "How do I debug JavaScript?",
            "What does 404 error mean?",
            "How do I fix CORS errors?",
            // ========== Comparison (10%) ==========
            "What is the difference between Python and JavaScript?",
            "Mac vs PC?",
            "iOS vs Android?",
            "Coffee vs tea?",
            "What is better: SQL or NoSQL?",
            "React vs Angular?",
            "Git vs SVN?",
            "TCP vs UDP?",
            "REST vs GraphQL?",
            "Vue vs React?",
        ];
    }
    /**
     * Get programming-specific queries for warming
     *
     * Returns queries focused on programming and software development.
     *
     * @returns Programming queries array
     */
    static getProgrammingQueries() {
        return [
            "What is JavaScript?",
            "How do I write a for loop in Python?",
            "Explain recursion",
            "What is a closure in JavaScript?",
            "How do I parse JSON in Python?",
            "What is the difference between let and const?",
            "How do I create a class in Java?",
            "What is async/await?",
            "Explain map, filter, and reduce",
            "How do I handle errors in JavaScript?",
            "What is a Promise in JavaScript?",
            "How do I make an HTTP request in Python?",
            "What is TypeScript?",
            "Explain object-oriented programming",
            "How do I debug code?",
            "What is a REST API?",
            "How do I use Git?",
            "What is SQL?",
            "How do I optimize my code?",
            "What is unit testing?",
        ];
    }
    /**
     * Get general knowledge queries for warming
     *
     * Returns queries focused on general knowledge and facts.
     *
     * @returns General knowledge queries array
     */
    static getGeneralKnowledgeQueries() {
        return [
            "What is the capital of France?",
            "Who wrote Romeo and Juliet?",
            "What is the speed of light?",
            "When was World War II?",
            "What is the largest ocean?",
            "Who painted the Mona Lisa?",
            "What is photosynthesis?",
            "What is the boiling point of water?",
            "Who was the first person on the moon?",
            "What is the currency of Japan?",
            "What is the tallest mountain?",
            "Who discovered America?",
            "What is the population of China?",
            "What is the square root of 64?",
            "What is the chemical symbol for gold?",
        ];
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * Get common queries for cache warming
 * Alias for getDefaultCommonQueries for easier import
 */
export function getCommonQueries() {
    return CacheWarmer.getDefaultCommonQueries();
}
/**
 * Default configuration
 */
export const DEFAULT_CACHE_WARMER_CONFIG = {
    batchSize: 10,
    delayBetweenBatches: 100,
};
//# sourceMappingURL=CacheWarmer.js.map