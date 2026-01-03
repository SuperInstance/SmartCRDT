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
 * Simple session context implementation
 */
export class SimpleSessionContext {
    queries = [];
    addQuery(query, timestamp, topic) {
        this.queries.push({
            query,
            timestamp,
            topic: topic || this.extractTopic(query),
        });
        // Keep last 100
        if (this.queries.length > 100) {
            this.queries.shift();
        }
    }
    getRecentQueries(count) {
        return this.queries.slice(-count).map(q => q.query);
    }
    getRecentTopics(count) {
        return this.queries.slice(-count).map(q => q.topic);
    }
    hasSeenTopicBefore(query) {
        const currentTopic = this.extractTopic(query);
        return this.queries.some(q => q.topic === currentTopic);
    }
    getTopicConsistency(count) {
        const recent = this.queries.slice(-count);
        if (recent.length < 2)
            return 1;
        const topics = recent.map(q => q.topic);
        const mainTopic = this.getMostCommon(topics);
        const mainCount = topics.filter(t => t === mainTopic).length;
        return mainCount / topics.length;
    }
    getAveragePauseMs(count) {
        const recent = this.queries.slice(-count);
        if (recent.length < 2)
            return 0;
        let totalPause = 0;
        for (let i = 1; i < recent.length; i++) {
            totalPause += recent[i].timestamp - recent[i - 1].timestamp;
        }
        return totalPause / (recent.length - 1);
    }
    isRepeatingQuery(query) {
        const recent = this.queries.slice(-5);
        const normalizedQuery = query.toLowerCase().trim();
        return recent.some(q => q.query.toLowerCase().trim() === normalizedQuery);
    }
    extractTopic(query) {
        // Simple topic extraction: first few words
        const words = query.toLowerCase().split(/\s+/).slice(0, 3);
        return words.join(" ");
    }
    getMostCommon(arr) {
        const counts = new Map();
        for (const item of arr) {
            counts.set(item, (counts.get(item) || 0) + 1);
        }
        let max = 0;
        let maxItem = arr[0];
        for (const [item, count] of counts) {
            if (count > max) {
                max = count;
                maxItem = item;
            }
        }
        return maxItem;
    }
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
export class MotivationEncoder {
    procrastinationPhrases = [
        "later",
        "eventually",
        "someday",
        "not now",
        "in a bit",
        "soon",
        "tomorrow",
        "next week",
        "put it off",
        "delay",
        "postpone",
    ];
    urgencyWords = [
        "urgent",
        "asap",
        "hurry",
        "quickly",
        "immediately",
        "emergency",
        "critical",
        "as soon as possible",
        "right now",
        "fast",
        "quick",
        "asap",
        "need to",
        "have to",
    ];
    socialWords = [
        "share",
        "show",
        "present",
        "collaborate",
        "team",
        "opinion",
        "think about this",
        "review",
        "feedback",
        "help me with",
        "together",
        "partner",
        "group",
    ];
    questionWords = [
        "why",
        "how",
        "what",
        "when",
        "where",
        "who",
        "which",
        "can",
        "could",
        "would",
        "should",
        "is",
        "are",
        "do",
        "does",
        "?",
    ];
    /**
     * Encode user's motivational state from a query
     * @param text - The user's query
     * @param context - Session context for pattern detection
     * @returns UserMotivation with all dimensions (0-1 each)
     */
    encode(text, context) {
        const lowerText = text.toLowerCase();
        const motivation = {
            procrastination: this.detectProcrastination(text, lowerText, context),
            curiosity: this.detectCuriosity(text, lowerText, context),
            social: this.detectSocial(text, lowerText),
            flow: this.detectFlow(text, context),
            anxiety: this.detectAnxiety(text, lowerText, context),
        };
        return motivation;
    }
    /**
     * Detect procrastination signals
     */
    detectProcrastination(text, lowerText, context) {
        let score = 0;
        // Check for procrastination phrases
        for (const phrase of this.procrastinationPhrases) {
            if (lowerText.includes(phrase)) {
                score += 0.4;
                break;
            }
        }
        // Check for topic switching (sign of avoiding)
        const recentTopics = context.getRecentTopics(5);
        if (recentTopics.length >= 3) {
            const uniqueTopics = new Set(recentTopics);
            if (uniqueTopics.size >= 3) {
                score += 0.3; // Switching between topics
            }
        }
        // Check for short, vague queries
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount < 5 && !lowerText.includes("?")) {
            score += 0.2;
        }
        return Math.min(score, 1);
    }
    /**
     * Detect curiosity signals
     */
    detectCuriosity(text, lowerText, context) {
        let score = 0;
        // Check for question words
        for (const word of this.questionWords) {
            if (lowerText.includes(word)) {
                score += 0.2;
            }
        }
        // Check for explicit curiosity phrases
        const curiosityPhrases = [
            "wonder",
            "curious",
            "interested in",
            "want to know",
            "how does",
            "why does",
            "what if",
            "explore",
            "learn about",
        ];
        for (const phrase of curiosityPhrases) {
            if (lowerText.includes(phrase)) {
                score += 0.3;
                break;
            }
        }
        // Check if topic is new
        if (!context.hasSeenTopicBefore(text)) {
            score += 0.3;
        }
        // Check for follow-up (recent related queries)
        const recentQueries = context.getRecentQueries(3);
        const relatedCount = recentQueries.filter(q => q.toLowerCase().includes(this.extractTopic(text))).length;
        if (relatedCount >= 2) {
            score += 0.2;
        }
        return Math.min(score, 1);
    }
    /**
     * Detect social signals
     */
    detectSocial(text, lowerText) {
        let score = 0;
        // Check for social words
        for (const word of this.socialWords) {
            if (lowerText.includes(word)) {
                score += 0.25;
            }
        }
        // Check for collaboration indicators
        const collabPhrases = [
            "what do you think",
            "your opinion",
            "help me",
            "let's work",
            "together",
            "review this",
        ];
        for (const phrase of collabPhrases) {
            if (lowerText.includes(phrase)) {
                score += 0.3;
                break;
            }
        }
        return Math.min(score, 1);
    }
    /**
     * Detect flow state signals
     */
    detectFlow(text, context) {
        let score = 0;
        // Check for detailed query (indicates focus)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 30) {
            score += 0.3;
        }
        else if (wordCount > 15) {
            score += 0.15;
        }
        // Check for topic consistency
        const consistency = context.getTopicConsistency(5);
        if (consistency > 0.7) {
            score += 0.4;
        }
        else if (consistency > 0.5) {
            score += 0.2;
        }
        // Check for continuous interaction (short pauses)
        const avgPause = context.getAveragePauseMs(5);
        if (avgPause < 5000) {
            score += 0.3;
        }
        else if (avgPause < 10000) {
            score += 0.15;
        }
        return Math.min(score, 1);
    }
    /**
     * Detect anxiety signals
     */
    detectAnxiety(text, lowerText, context) {
        let score = 0;
        // Check for urgency words
        for (const word of this.urgencyWords) {
            if (lowerText.includes(word)) {
                score += 0.4;
            }
        }
        // Check for repetition (sign of anxiety/stuck)
        if (context.isRepeatingQuery(text)) {
            score += 0.4;
        }
        // Check for rapid fire (very short pauses)
        const avgPause = context.getAveragePauseMs(3);
        if (avgPause < 2000) {
            score += 0.2;
        }
        // Check for exclamation marks (anxiety/urgency)
        const exclamationCount = (text.match(/!/g) || []).length;
        if (exclamationCount > 0) {
            score += Math.min(exclamationCount * 0.1, 0.2);
        }
        return Math.min(score, 1);
    }
    /**
     * Extract simple topic from text (first few words)
     */
    extractTopic(text) {
        const words = text.toLowerCase().split(/\s+/).slice(0, 3);
        return words.join(" ");
    }
    /**
     * Get the dominant motivation (highest score)
     */
    getDominantMotivation(motivation) {
        const entries = Object.entries(motivation);
        let max = 0;
        let maxKey = "curiosity";
        for (const [key, value] of entries) {
            if (value > max) {
                max = value;
                maxKey = key;
            }
        }
        return maxKey;
    }
    /**
     * Get a human-readable description of motivational state
     */
    describe(motivation) {
        const dominant = this.getDominantMotivation(motivation);
        const descriptions = {
            procrastination: "User seems to be delaying or avoiding",
            curiosity: "User is exploring and learning",
            social: "User is seeking collaboration",
            flow: "User is in focused flow state",
            anxiety: "User seems anxious or urgent",
        };
        let desc = descriptions[dominant];
        // Add nuance for mixed states
        const scores = Object.entries(motivation).filter(([, v]) => v > 0.5);
        if (scores.length > 1) {
            const otherStates = scores
                .filter(([k]) => k !== dominant)
                .map(([k]) => k)
                .slice(0, 2)
                .join(", ");
            desc += ` (also showing: ${otherStates})`;
        }
        return desc;
    }
}
/**
 * Default export
 */
export default MotivationEncoder;
//# sourceMappingURL=MotivationEncoder.js.map